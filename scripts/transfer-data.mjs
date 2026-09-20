import {createHash,randomBytes,pbkdf2Sync} from 'node:crypto';
const kinds=new Set(['pin','note','character','journal','secret','treasure','faction','event','folder','map','table','combat']);
const check=(ok,message)=>{if(!ok)throw new Error(message);};
export function prepareTransfer(backups,seeds){
 check(backups.length>0,'Indica almeno un file di esportazione.');
 const users=new Map(),records=new Map(),uploads=new Map(),exporters=new Set();let campaign;
 for(const backup of backups){
  check(backup.format==='barovia-transfer'&&backup.schemaVersion===1,'Esportazione non compatibile: scaricala dal sito aggiornato.');
  check(Array.isArray(backup.users)&&Array.isArray(backup.records)&&Array.isArray(backup.uploads),'Esportazione incompleta.');
  const author=backup.users.find(u=>u.id===backup.exportedBy);check(author,'Autore dell’esportazione mancante.');exporters.add(author.id);
  for(const u of backup.users){check(typeof u.id==='string'&&u.id.length<=80&&typeof u.name==='string'&&u.name.length<=40&&['dm','player'].includes(u.role),'Account non valido.');check(u.role!=='dm'||u.id==='dm','Account DM non riconosciuto.');if(author.role==='dm'||!users.has(u.id))users.set(u.id,{...u});}
  if(author.role==='dm'&&backup.settings&&(!campaign||backup.exportedAt>campaign.exportedAt))campaign=backup;
  for(const r of backup.records){
   check(typeof r.id==='string'&&r.id.length<=80&&kinds.has(r.kind)&&typeof r.title==='string'&&r.title.length<=160&&typeof r.body==='string'&&r.body.length<=60000&&Array.isArray(r.audience)&&Array.isArray(r.links)&&r.data&&Number.isSafeInteger(r.version)&&r.version>0&&Number.isSafeInteger(r.updated),'Pagina non valida.');
   const current=records.get(r.id);if(!current||r.version>current.record.version||(r.version===current.record.version&&author.id===r.owner))records.set(r.id,{record:r,exporter:author.id});
  }
  for(const image of backup.uploads){
   check(typeof image.id==='string'&&/^[0-9a-f-]{36}$/.test(image.id)&&typeof image.base64==='string'&&image.base64.length<5600000,'Immagine non valida o superiore a 4 MB.');
   const bytes=Buffer.from(image.base64,'base64');check(bytes.length>=12&&bytes.length<=4194304,'Immagine non valida.');
   const mime=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':'';
   check(mime&&mime===image.mime,'Formato immagine non valido.');
   const hash=createHash('sha256').update(bytes).digest('hex');const old=uploads.get(image.id);check(!old||old.hash===hash,'Due esportazioni contengono immagini diverse con lo stesso identificatore.');
   uploads.set(image.id,{...image,bytes,hash});
  }
 }
 check(campaign&&users.has('dm'),'Serve anche l’esportazione del DM per impostazioni, provviste e incontri.');
 const names=new Set();for(const u of users.values()){check(!names.has(u.name.toLowerCase()),'Nomi account duplicati.');names.add(u.name.toLowerCase());}
 for(const {record:r} of records.values()){check(users.has(r.owner),'Manca l’account proprietario di una pagina.');check(r.kind!=='secret'||users.get(r.owner).role==='dm','Proprietario di una nota DM non valido.');}
 const accounts=Array.from(users.values()).map(u=>{const seed=seeds.find(s=>s.id===u.id);const salt=seed?.salt||randomBytes(16).toString('hex');return {...u,salt,hash:seed?.hash||pbkdf2Sync(randomBytes(32),Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex'),active:seed?(u.active?1:0):0,changed:0};});
 const incomplete=Array.from(users.values()).filter(u=>!exporters.has(u.id)).map(u=>u.name);
 const pages=Array.from(records.values()).map(r=>r.record);
 const referenced=new Set(pages.flatMap(r=>[r.data.image,r.data.markerImage,...(r.data.images||[]).map(i=>i.id)]).concat(campaign.settings.partyImage).filter(Boolean));
 check([...referenced].every(id=>uploads.has(id)),'Mancano immagini referenziate: aggiungi le esportazioni degli altri utenti.');
 const raw=campaign.supplies||{};
 const supplies={rations:raw.rations??0,partySize:raw.partySize??6,foodPerPerson:raw.foodPerPerson??1,targetDays:raw.targetDays??7,history:(raw.history||[]).map(m=>({id:m.id,at:m.at,by:m.by,note:m.note,rations:m.rations,before:{rations:m.before.rations},reversed:m.reversed}))};
 return {accounts,records:pages,uploads:Array.from(uploads.values()),settings:campaign.settings,supplies,dmBoard:campaign.dmBoard||{round:1,turnId:'',combatants:[]},bestiary:campaign.bestiary||{creatures:[]},missingExports:incomplete};
}
export async function writeTransfer(sql,data){
 await sql.begin(async tx=>{
  // Refuse any overwrite, including a database already initialized by a login.
  await tx.unsafe('LOCK TABLE barovia.users,barovia.records,barovia.settings,barovia.uploads IN ACCESS EXCLUSIVE MODE');
  const count=await tx.unsafe('SELECT (SELECT count(*) FROM barovia.users)+(SELECT count(*) FROM barovia.records)+(SELECT count(*) FROM barovia.settings)+(SELECT count(*) FROM barovia.uploads) AS n');
  if(Number(count[0].n)!==0)throw new Error('Il database contiene già dati. L’importazione richiede un database vuoto e non sovrascrive la campagna.');
  for(const u of data.accounts)await tx.unsafe('INSERT INTO barovia.users (id,name,role,hash,salt,active,changed) VALUES ($1,$2,$3,$4,$5,$6,0)',[u.id,u.name,u.role,u.hash,u.salt,u.active]);
  for(const r of data.records)await tx.unsafe('INSERT INTO barovia.records (id,kind,title,body,owner,audience,folder,data,links,version,updated,editor) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[r.id,r.kind,r.title,r.body,r.owner,JSON.stringify(r.audience),r.folder||'',JSON.stringify(r.data),JSON.stringify(r.links),r.version,r.updated,r.editor||r.owner]);
  for(const i of data.uploads)await tx.unsafe('INSERT INTO barovia.uploads (id,owner,mime,created) VALUES ($1,$2,$3,$4)',[i.id,i.owner,i.mime,i.created]);
  for(const [id,value] of [['campaign',data.settings],['supplies',data.supplies],['dm-board',data.dmBoard],['bestiary',data.bestiary||{creatures:[]}],['initialized',true],['transfer-imported',{at:new Date().toISOString()}]])await tx.unsafe('INSERT INTO barovia.settings (id,value,version) VALUES ($1,$2,1)',[id,JSON.stringify(value)]);
 });
}
