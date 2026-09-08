import { getDb,type Database as D1Database } from '../db';
import { accountSeed } from './account-seed';
import { DEFAULTS, DEFAULT_SUPPLIES, DEFAULT_DM_BOARD, DEFAULT_BESTIARY, readSupplies, imageIds, inlineReferences, KINDS, visible, editable, deletable, type Entry, type Member, type Settings } from './campaign';
export type ObjectBucket={put:(id:string,bytes:ArrayBuffer,options:{httpMetadata:{contentType:string}})=>Promise<unknown>;get:(id:string)=>Promise<{body:ReadableStream<Uint8Array>}|null>;delete:(id:string)=>Promise<unknown>};
export type Bindings={DB:D1Database;BUCKET:ObjectBucket};
const COOKIE='barovia_session';
/** Durata della sessione: un mese, così una scadenza non cade proprio a ridosso della serata di gioco. */
const SESSION_MS=2592000000;
/** Sotto questa soglia residua la sessione viene prolungata mentre si usa il sito. */
const SESSION_RENEW_MS=2160000000;
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
const fromHex=(s:string)=>new Uint8Array(s.match(/../g)!.map(x=>parseInt(x,16)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
async function digest(s:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}
export async function passwordHash(key:string,salt:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:fromHex(salt),iterations:100000,hash:'SHA-256'},k,256));}
function equal(a:string,b:string){let x=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)x|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return x===0;}
class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
function fail(status:number,message:string):never {throw new ApiError(status,message);}
function json(data:unknown,status=200,headers:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
function unpack(r:any):Entry{return {...r,audience:JSON.parse(r.audience),data:JSON.parse(r.data),links:JSON.parse(r.links)};}
function member(u:any):Member{return{id:u.id,name:u.name,role:u.role,active:u.active,changed:u.changed,seen:Number(u.seen)||0};}
async function body(req:Request){const str=await req.text();if(str.length>150000)fail(413,'Il contenuto è troppo grande.');try{return JSON.parse(str);}catch{fail(400,'Richiesta non valida.');}}
/** Netlify espone l'indirizzo del visitatore con intestazioni proprie: cf-connecting-ip
 *  appartiene a Cloudflare e resta solo come ripiego per l'ambiente di partenza. */
function clientAddress(req:Request){
 const direct=req.headers.get('x-nf-client-connection-ip')||req.headers.get('client-ip')||req.headers.get('cf-connecting-ip');
 if(direct?.trim())return direct.trim();
 const forwarded=req.headers.get('x-forwarded-for');
 const first=forwarded?.split(',')[0].trim();
 return first||'unknown';
}
function checkOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)fail(403,'Origine della richiesta non consentita.');if(req.headers.get('sec-fetch-site')==='cross-site')fail(403,'Richiesta non consentita.');}
async function init(db:D1Database){
 if(await db.prepare('SELECT id FROM settings WHERE id = ?').bind('initialized').first())return;
 const now=Date.now();const statements=accountSeed.map(u=>db.prepare('INSERT OR IGNORE INTO users (id,name,role,hash,salt,active,changed) VALUES (?,?,?,?,?,1,0)').bind(u.id,u.name,u.role,u.hash,u.salt));
 statements.push(db.prepare('INSERT OR IGNORE INTO settings (id,value,version) VALUES (?,?,1)').bind('campaign',JSON.stringify(DEFAULTS)));
 const places=[['barovia','Villaggio di Barovia',.788,.619,'insediamento'],['vallaki','Vallaki',.4,.327,'insediamento'],['krezk','Krezk',.114,.311,'insediamento'],['ravenloft','Castello Ravenloft',.715,.512,'luogo'],['tser','Pozza Tser',.677,.626,'natura'],['zarovich','Lago Zarovich',.441,.246,'natura']];
 for(const [id,title,x,y,category]of places)statements.push(db.prepare('INSERT OR IGNORE INTO records (id,kind,title,body,owner,audience,folder,data,links,version,updated,editor) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)').bind(id,'pin',title,'','dm','["*"]','',JSON.stringify({x,y,category}),'[]',now,'dm'));
 statements.push(db.prepare('INSERT OR IGNORE INTO settings (id,value,version) VALUES (?,?,1)').bind('initialized','true'));
 await db.batch(statements);
}
function sessionToken(req:Request){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
async function session(req:Request,db:D1Database){const token=sessionToken(req);if(!token)return null;return await db.prepare('SELECT users.*, sessions.expires AS session_expires FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires > ? AND users.active = 1').bind(await digest(token),Date.now()).first<any>();}
/** Rinnova la sessione solo quando si è consumata davvero, per non scrivere a ogni aggiornamento automatico. */
async function renewSession(req:Request,db:D1Database,expires:number){const token=sessionToken(req);const now=Date.now();if(!token||expires-now>SESSION_RENEW_MS)return null;await db.prepare('UPDATE sessions SET expires = ? WHERE token = ?').bind(now+SESSION_MS,await digest(token)).run();return setCookie(token,req);}
function setCookie(token:string,req:Request,maxAge=SESSION_MS/1000){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
async function readRecord(db:D1Database,id:string){const row=await db.prepare('SELECT * FROM records WHERE id = ?').bind(id).first();return row?unpack(row):null;}
async function allRecords(db:D1Database){return (await db.prepare('SELECT * FROM records ORDER BY updated DESC').all()).results.map(unpack);}
async function allUsers(db:D1Database){return (await db.prepare('SELECT id,name,role,active,changed,seen FROM users ORDER BY role,name').all()).results as Member[];}
/** Conserva la stesura precedente di una voce, tenendo solo le ultime dieci. */
async function storeRevision(db:D1Database,old:Entry){
 await db.prepare('INSERT INTO revisions (id,record_id,at,editor,title,body,data) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),old.id,old.updated,old.editor,old.title,old.body,JSON.stringify(old.data)).run();
 const rows=(await db.prepare('SELECT id,at FROM revisions WHERE record_id = ? ORDER BY at DESC').bind(old.id).all<any>()).results;
 for(const extra of rows.slice(10))await db.prepare('DELETE FROM revisions WHERE id = ?').bind(extra.id).run();
}
function cleanText(v:unknown,max:number,fallback=''){return typeof v==='string'?v.trim().slice(0,max):fallback;}
function number(v:unknown,min:number,max:number,fallback:number){return typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;}
function optional(v:unknown,min:number,max:number){return typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):undefined;}
function tagList(v:unknown){return Array.isArray(v)?Array.from(new Set(v.map((t:any)=>cleanText(t,40).toLocaleLowerCase('it')).filter(Boolean))).slice(0,12):[];}
function validateKey(key:unknown){if(typeof key!=='string'||key.length<10||key.length>128)fail(400,'La chiave deve contenere da 10 a 128 caratteri.');return key as string;}
function point(p:any){return {x:number(p?.x,0,1,.5),y:number(p?.y,0,1,.5)};}
function cleanData(kind:string,d:any){d=d&&typeof d==='object'?d:{};const result:any={images:Array.isArray(d.images)?d.images.slice(0,12).map((x:any)=>({id:cleanText(x?.id,80),caption:cleanText(x?.caption,240)})).filter((x:any)=>x.id):[],tags:tagList(d.tags)};
 if(kind==='pin'||kind==='event'){Object.assign(result,point(d));result.category=cleanText(d.category,40,'luogo');if(kind==='pin'){result.markerImage=cleanText(d.markerImage,80);result.markerIcon=cleanText(d.markerIcon,30,'pin');result.map=cleanText(d.map,80);}}
 // Una mappa aggiuntiva: immagine, proporzioni, scala propria e posizione sulla mappa
 // che la contiene. La mappa principale resta quella del sito e non e un contenuto.
 if(kind==='map'){Object.assign(result,point(d));result.image=cleanText(d.image,80);result.ratio=number(d.ratio,.05,20,1.558);result.widthMiles=number(d.widthMiles,.001,10000,1);result.calibrated=d.calibrated===true;result.parent=cleanText(d.parent,80);result.markerIcon=cleanText(d.markerIcon,30,'castle');}
 if(kind==='table'){result.entries=Array.isArray(d.entries)?d.entries.slice(0,200).map((x:any)=>({id:cleanText(x?.id,80)||crypto.randomUUID(),text:cleanText(x?.text,300)})).filter((x:any)=>x.text):[];result.dice=cleanText(d.dice,20);}
 if(kind==='event'){result.minutes=Math.floor(number(d.minutes,0,500000000,480));result.path=Array.isArray(d.path)?d.path.slice(0,1000).map(point):[];result.routeVersion=d.routeVersion===2?2:1;result.curve=d.curve===true;}
 if(kind==='character'){result.subtitle=cleanText(d.subtitle,180);result.status=cleanText(d.status,50,'Sconosciuto');result.image=cleanText(d.image,80);
  // Scheda del personaggio giocante: presente solo se qualcuno la compila, cosi i
  // personaggi non giocanti gia salvati restano esattamente come sono.
  result.pc=d.pc===true;
  if(result.pc){result.player=cleanText(d.player,60);result.role=cleanText(d.role,80);result.level=optional(d.level,1,30);result.hp=optional(d.hp,-999,9999);result.maxHp=optional(d.maxHp,0,9999);result.ac=optional(d.ac,0,99);result.passive=optional(d.passive,0,99);result.speed=optional(d.speed,0,999);}}
 if(kind==='secret'){result.section=['session','scene','npc','clue','rules'].includes(d.section)?d.section:'session';result.pinned=d.pinned===true;result.tasks=Array.isArray(d.tasks)?d.tasks.slice(0,100).map((t:any)=>({id:cleanText(t?.id,80),text:cleanText(t?.text,250),done:t?.done===true})).filter((t:any)=>t.text):[];}
 if(kind==='journal'){result.session=Math.floor(number(d.session,1,10000,1));result.date=cleanText(d.date,40);const from=optional(d.minutes,0,500000000);const to=optional(d.endMinutes,0,500000000);if(from!==undefined)result.minutes=Math.floor(from);if(to!==undefined)result.endMinutes=Math.floor(to);}
 if(kind==='treasure'){result.quantity=number(d.quantity,0,1000000,1);result.value=number(d.value,0,1000000000,0);result.holder=cleanText(d.holder,100,'Gruppo');result.category=cleanText(d.category,60,'Oggetto');result.currency=['mr','ma','me','mo','mp'].includes(d.currency)?d.currency:'mo';}
 if(kind==='faction'){result.reputation=number(d.reputation,-100,100,0);result.subtitle=cleanText(d.subtitle,180);}
 return result;
}
async function saveStateRow(db:D1Database,id:string,data:unknown,version:number){
 const result=version===0?await db.prepare('INSERT INTO settings (id,value,version) VALUES (?,?,1) ON CONFLICT(id) DO NOTHING').bind(id,JSON.stringify(data)).run():await db.prepare('UPDATE settings SET value = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(data),id,version).run();
 if(!result.meta.changes)fail(409,'Dati aggiornati da un altro accesso. Ricarica prima di riprovare.');
}
export async function handleCampaign(req:Request,env:Bindings):Promise<Response>{
 try{
 if(!env.DB)fail(503,'L’archivio non è disponibile. Riprova tra poco.');
 const db=getDb(env);const url=new URL(req.url);const path=url.pathname;
 if(req.method!=='GET')checkOrigin(req);
 await init(db);
 if(path==='/api/auth'&&req.method==='POST'){
 const b=await body(req);
 if(b.action==='login'){
 const name=cleanText(b.name,50).toLowerCase();const key=typeof b.key==='string'?b.key.slice(0,128):'';
 const now=Date.now();const address=clientAddress(req);
 // Due contatori distinti: sul nome per proteggere il singolo account, sull'indirizzo
 // per fermare chi prova molte chiavi cambiando nome a ogni tentativo.
 const nameBucket=await digest('name:'+name);const addressBucket=await digest('addr:'+address);
 const tally=async(key:string)=>((await db.prepare('INSERT INTO attempts (key,count,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN reset < ? THEN 1 ELSE count + 1 END, reset = CASE WHEN reset < ? THEN ? ELSE reset END RETURNING count').bind(key,now+900000,now,now,now+900000).first<any>())?.count??0);
 const perName=await tally(nameBucket);const perAddress=address==='unknown'?0:await tally(addressBucket);
 if(perName>10||perAddress>30)fail(429,'Troppi tentativi. Riprova fra 15 minuti.');
 const u=await db.prepare('SELECT * FROM users WHERE lower(name) = ? AND active = 1').bind(name).first<any>();const salt=u?.salt||accountSeed[0].salt;const hash=await passwordHash(key,salt);
 if(!u||!equal(hash,u.hash))fail(401,'Nome o chiave non corretti.');
 const token=random();await db.batch([db.prepare('INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)').bind(await digest(token),u.id,now+SESSION_MS),db.prepare('DELETE FROM attempts WHERE key = ? OR key = ? OR reset < ?').bind(nameBucket,addressBucket,now),db.prepare('DELETE FROM sessions WHERE expires < ?').bind(now)]);
 return json({user:member(u)},200,{'Set-Cookie':setCookie(token,req)});
 }
 if(b.action==='logout'){const t=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(t)await db.prepare('DELETE FROM sessions WHERE token = ?').bind(await digest(t)).run();return json({ok:true},200,{'Set-Cookie':setCookie('',req,0)});}
 const u=await session(req,db);if(!u)fail(401,'Accedi per continuare.');
 if(b.action==='change'){const key=validateKey(b.newKey);if(typeof b.oldKey!=='string'||!equal(await passwordHash(b.oldKey,u.salt),u.hash))fail(400,'La chiave attuale non è corretta.');const salt=random().slice(0,32);const hash=await passwordHash(key,salt);const token=random();await db.batch([db.prepare('UPDATE users SET hash = ?, salt = ?, changed = 1 WHERE id = ?').bind(hash,salt,u.id),db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),db.prepare('INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)').bind(await digest(token),u.id,Date.now()+SESSION_MS)]);return json({ok:true},200,{'Set-Cookie':setCookie(token,req)});}
 fail(400,'Azione non valida.');
 }
 const rawUser=await session(req,db);if(!rawUser)fail(401,'Accedi per continuare.');const user=member(rawUser);
 if((path==='/api/state'||path==='/api/export')&&req.method==='GET'){
 const [rows,users,s]=await Promise.all([allRecords(db),allUsers(db),db.prepare('SELECT * FROM settings WHERE id = ?').bind('campaign').first<any>()]);
 const allowed=rows.filter(r=>visible(r,user));const ids=new Set(allowed.map(r=>r.id));
 const suppliesRow=await db.prepare('SELECT value,version FROM settings WHERE id = ?').bind('supplies').first<any>();
 const dmRow=user.role==='dm'?await db.prepare('SELECT value,version FROM settings WHERE id = ?').bind('dm-board').first<any>():null;
 const bestiaryRow=user.role==='dm'?await db.prepare('SELECT value,version FROM settings WHERE id = ?').bind('bestiary').first<any>():null;
 const state={user,users:users.filter(u=>u.active||user.role==='dm').map(u=>({...u,changed:u.id===user.id?u.changed:undefined,seen:u.id===user.id?u.seen:undefined})),records:allowed.map(r=>({...r,body:r.body.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,(token,id)=>ids.has(id)?token:'[['+id+']]'),links:r.links.filter(id=>ids.has(id)),folder:ids.has(r.folder)?r.folder:''})),settings:{...DEFAULTS,locationRadiusMiles:.25,...JSON.parse(s.value)},settingsVersion:s.version,supplies:readSupplies(suppliesRow?JSON.parse(suppliesRow.value):{}),suppliesVersion:suppliesRow?.version||0,...(user.role==='dm'?{dmBoard:dmRow?JSON.parse(dmRow.value):DEFAULT_DM_BOARD,dmBoardVersion:dmRow?.version||0,bestiary:bestiaryRow?JSON.parse(bestiaryRow.value):DEFAULT_BESTIARY,bestiaryVersion:bestiaryRow?.version||0}:{})};
 if(path==='/api/export'){
  const ids=new Set([...state.records.flatMap(r=>imageIds(r.data)),state.settings.partyImage].filter(Boolean));
  const uploads=(await db.prepare('SELECT * FROM uploads').all()).results.filter(u=>ids.has(u.id as string)||u.owner===user.id);
  return json({format:'barovia-transfer',schemaVersion:1,exportedAt:new Date().toISOString(),exportedBy:user.id,users:state.users.map(u=>({id:u.id,name:u.name,role:u.role,active:u.active})),records:state.records,uploads,...(user.role==='dm'?{settings:state.settings,supplies:state.supplies,dmBoard:state.dmBoard}:{})});
 }
 // Il browser richiama questo indirizzo di continuo: se nulla è cambiato rispondiamo
 // con un'impronta e nessun contenuto, invece di rispedire l'archivio intero.
 const payload=JSON.stringify(state);const tag='"'+(await digest(payload)).slice(0,32)+'"';
 const renewal=await renewSession(req,db,Number(rawUser.session_expires)||0);
 const headers:Record<string,string>={ETag:tag,...(renewal?{'Set-Cookie':renewal}:{})};
 if(req.headers.get('if-none-match')===tag)return new Response(null,{status:304,headers:{...headers,'Cache-Control':'no-store'}});
 return new Response(payload,{status:200,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path==='/api/records'){
 const b=await body(req);const old=b.id?await readRecord(db,b.id):null;
 if(req.method==='DELETE'){
 if(!old||!deletable(old,user))fail(403,'Non puoi eliminare questo contenuto.');
 const r=await db.prepare('DELETE FROM records WHERE id = ? AND version = ?').bind(old.id,b.version).run();if(!r.meta.changes)fail(409,'Il contenuto è stato modificato. Ricaricalo prima di eliminarlo.');await db.prepare('DELETE FROM revisions WHERE record_id = ?').bind(old.id).run();return json({ok:true});
 }
 if(req.method!=='POST'&&req.method!=='PUT')fail(405,'Metodo non consentito.');
 if(req.method==='PUT'&&!old)fail(404,'Contenuto non disponibile.');
 if(old&&!editable(old,user))fail(403,'Non puoi modificare questo contenuto.');
 const kind=old?.kind||b.kind;if(!Object.hasOwn(KINDS,kind))fail(400,'Tipo di contenuto non valido.');
 if(['secret','faction','table','map'].includes(kind)&&user.role!=='dm')fail(403,'Questa sezione è riservata al DM.');
 const title=cleanText(b.title,160);if(!title)fail(400,'Inserisci un titolo.');
 const owner=old?.owner||user.id;const users=await allUsers(db);const known=new Set(users.map(u=>u.id));
 let audience=(Array.isArray(b.audience)?b.audience:[]).filter((id:any)=>typeof id==='string'&&(id==='*'||known.has(id)));
 if(old&&old.owner!==user.id)audience=old.audience;
 if(kind==='secret'||kind==='table')audience=users.filter(u=>u.role==='dm').map(u=>u.id);
 const all=await allRecords(db);const accessible=new Set(all.filter(r=>visible(r,user)).map(r=>r.id));
 if(typeof b.body==='string'&&b.body.length>60000)fail(400,'Il testo supera il limite di 60.000 caratteri.');let content=cleanText(b.body,60000);if(old){const protectedTokens=new Map(inlineReferences(old.body).filter(x=>!accessible.has(x.id)).map(x=>[x.id,x.token]));content=content.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,(token,id)=>protectedTokens.get(id)||token);}
 const links=Array.from(new Set([...inlineReferences(content).map(x=>x.id).filter(id=>accessible.has(id)&&id!==old?.id),...(Array.isArray(b.links)?b.links.filter((id:any)=>typeof id==='string'&&accessible.has(id)&&id!==old?.id):[]),...(old?.links.filter(id=>!accessible.has(id))||[])]));
 const requestedFolder=cleanText(b.folder,80);const keepHiddenFolder=!!old?.folder&&!accessible.has(old.folder)&&!requestedFolder;const folder=keepHiddenFolder?old!.folder:requestedFolder;if(folder&&!keepHiddenFolder){const f=all.find(r=>r.id===folder);if(!f||f.kind!=='folder'||!visible(f,user))fail(400,'Cartella non disponibile.');}
 const data=cleanData(kind,b.data);
 for(const imageId of imageIds(data)){const upload=await db.prepare('SELECT * FROM uploads WHERE id = ?').bind(imageId).first<any>();if(!upload||(upload.owner!==user.id&&!imageIds(old?.data||{}).includes(imageId)))fail(403,'Immagine non disponibile.');}
 const id=old?.id||(typeof b.id==='string'&&/^[0-9a-f-]{36}$/.test(b.id)?b.id:crypto.randomUUID());const updated=Date.now();const values=[title,content,JSON.stringify(audience),folder,JSON.stringify(data),JSON.stringify(links),updated,user.id];
 if(old){const result=await db.prepare('UPDATE records SET title = ?, body = ?, audience = ?, folder = ?, data = ?, links = ?, updated = ?, editor = ?, version = version + 1 WHERE id = ? AND version = ?').bind(...values,id,b.version).run();if(!result.meta.changes)fail(409,'Qualcuno ha aggiornato questa voce. La tua bozza resta salvata: chiudi e riapri per ritrovarla e unire le modifiche.');await storeRevision(db,old);}
 else await db.prepare('INSERT INTO records (title,body,audience,folder,data,links,updated,editor,id,kind,owner,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)').bind(...values,id,kind,owner).run();
 return json({ok:true,id});
 }
 if(path==='/api/seen'&&req.method==='POST'){
 // Segnalibro personale: fin dove questo account ha letto le novita.
 const b=await body(req);const at=Math.floor(number(b.at,0,4102444800000,Date.now()));
 await db.prepare('UPDATE users SET seen = ? WHERE id = ?').bind(at,user.id).run();return json({ok:true,seen:at});
 }
 if(path==='/api/revisions'&&req.method==='GET'){
 const id=url.searchParams.get('id')||'';const target=await readRecord(db,id);
 if(!target||!visible(target,user))fail(404,'Contenuto non disponibile.');
 const rows=(await db.prepare('SELECT id,at,editor,title,body,data FROM revisions WHERE record_id = ? ORDER BY at DESC').bind(id).all<any>()).results;
 return json({revisions:rows.slice(0,10).map(r=>({id:r.id,at:Number(r.at),editor:r.editor,title:r.title,body:r.body,data:JSON.parse(r.data)}))});
 }
 if(path==='/api/bestiary'&&req.method==='PUT'){
 if(user.role!=='dm')fail(403,'Questi strumenti sono riservati al DM.');const b=await body(req);const d=b.data||{};
 const creatures=Array.isArray(d.creatures)?d.creatures.slice(0,200).map((c:any)=>({id:cleanText(c?.id,80)||crypto.randomUUID(),name:cleanText(c?.name,100,'Avversario'),ac:number(c?.ac,0,100,10),maxHp:number(c?.maxHp,1,100000,10),initiative:number(c?.initiative,-100,100,0),conditions:cleanText(c?.conditions,250),notes:cleanText(c?.notes,1000)})):[];
 await saveStateRow(db,'bestiary',{creatures},b.version);return json({ok:true});
 }
 if(path==='/api/settings'&&req.method==='PUT'){
 if(user.role!=='dm')fail(403,'Solo il DM può modificare la campagna.');const b=await body(req);const d=b.settings;
 if(!d||!Array.isArray(d.months)||d.months.length!==12||d.months.some((s:any)=>typeof s!=='string'||!s.trim()))fail(400,'Inserisci i nomi dei 12 mesi.');
 const stored=await db.prepare('SELECT value FROM settings WHERE id = ?').bind('campaign').first<any>();const currentSettings=JSON.parse(stored.value);const partyImage=cleanText(d.partyImage,80);if(partyImage&&partyImage!==currentSettings.partyImage){const upload=await db.prepare('SELECT owner FROM uploads WHERE id = ?').bind(partyImage).first<any>();if(!upload||upload.owner!==user.id)fail(403,'Immagine del gruppo non disponibile.');}
 const next:Settings={partyImage,locationRadiusMiles:number(d.locationRadiusMiles,.01,100,.25),title:cleanText(d.title,120,'Curse of Strahd'),minutes:Math.floor(number(d.minutes,0,500000000,480)),party:point(d.party),mapWidthMiles:number(d.mapWidthMiles,.1,10000,20),speed:number(d.speed,.1,100,3),mapCalibrated:d.mapCalibrated===true,months:d.months.map((s:string)=>s.trim().slice(0,30))};
 const r=await db.prepare('UPDATE settings SET value = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(next),'campaign',b.version).run();if(!r.meta.changes)fail(409,'La campagna è stata aggiornata. Ricarica prima di riprovare.');return json({ok:true});
 }

 if(path==='/api/supplies'&&req.method==='POST'){
 const b=await body(req);const row=await db.prepare('SELECT value,version FROM settings WHERE id = ?').bind('supplies').first<any>();const current=readSupplies(row?JSON.parse(row.value):{});const v=row?.version||0;if(b.version!==v)fail(409,'Le provviste sono state aggiornate. Ricarica prima di riprovare.');
 let next={...current};let note='';const before={rations:current.rations};
 if(b.action==='consume'){const days=number(b.days,.01,365,1);const food=days*current.partySize*current.foodPerPerson;if(food>current.rations)fail(400,'Provviste insufficienti per il consumo indicato.');next.rations=Math.round((current.rations-food)*100)/100;note='Consumo di '+days+' giorni';}
 else if(b.action==='set'){const d=b.data||{};next={...current,rations:number(d.rations,0,1000000,current.rations),partySize:Math.floor(number(d.partySize,1,1000,current.partySize)),foodPerPerson:number(d.foodPerPerson,.01,100,current.foodPerPerson),targetDays:number(d.targetDays,1,365,current.targetDays)};note=cleanText(b.note,200,'Aggiornamento scorte');}
 else if(b.action==='undo'){const last=current.history[0];if(!last||last.reversed)fail(400,'Nessun consumo o movimento da annullare.');next.rations=last.before.rations;note='Annullamento: '+last.note;}
 else fail(400,'Azione non valida.');
 const campaign=await db.prepare('SELECT value FROM settings WHERE id = ?').bind('campaign').first<any>();next.history=[{id:crypto.randomUUID(),at:JSON.parse(campaign.value).minutes,by:user.id,note,rations:next.rations-before.rations,before,reversed:b.action==='undo'},...current.history].slice(0,30);
 await saveStateRow(db,'supplies',next,v);return json({ok:true});
 }
 if(path==='/api/dm-board'&&req.method==='PUT'){
 if(user.role!=='dm')fail(403,'Questi strumenti sono riservati al DM.');const b=await body(req);const d=b.data||{};
 const combatants=Array.isArray(d.combatants)?d.combatants.slice(0,100).map((c:any)=>({id:cleanText(c.id,80)||crypto.randomUUID(),name:cleanText(c.name,100,'Combattente'),initiative:number(c.initiative,-100,100,0),ac:number(c.ac,0,100,10),hp:Math.min(number(c.maxHp,1,100000,10),number(c.hp,0,100000,10)),maxHp:number(c.maxHp,1,100000,10),conditions:cleanText(c.conditions,250),notes:cleanText(c.notes,1000)})):[];
 const next={round:Math.floor(number(d.round,1,100000,1)),turnId:combatants.some((c:any)=>c.id===d.turnId)?d.turnId:'',combatants};
 await saveStateRow(db,'dm-board',next,b.version);return json({ok:true});
 }
 if(path==='/api/users'&&req.method==='POST'){
 if(user.role!=='dm')fail(403,'Solo il DM gestisce gli accessi.');const b=await body(req);
 if(b.action==='create'){const name=cleanText(b.name,40);if(!/^[\p{L}\p{N} _-]{2,40}$/u.test(name))fail(400,'Usa un nome da 2 a 40 caratteri, con lettere, numeri o trattini.');if(await db.prepare('SELECT id FROM users WHERE lower(name) = ?').bind(name.toLowerCase()).first())fail(400,'Questo nome esiste già.');const key=validateKey(b.key);const salt=random().slice(0,32);await db.prepare('INSERT INTO users (id,name,role,hash,salt,active,changed) VALUES (?,?,?, ?,?,1,0)').bind(crypto.randomUUID(),name,'player',await passwordHash(key,salt),salt).run();return json({ok:true});}
 const target=await db.prepare('SELECT * FROM users WHERE id = ?').bind(b.id||'').first<any>();if(!target||target.role==='dm')fail(400,'Usa il cambio chiave personale per l’account DM.');
 if(b.action==='toggle'){await db.batch([db.prepare('UPDATE users SET active = ? WHERE id = ?').bind(target.active?0:1,target.id),db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id)]);return json({ok:true});}
 if(b.action==='reset'){const key=validateKey(b.key);const salt=random().slice(0,32);await db.batch([db.prepare('UPDATE users SET hash = ?, salt = ?, changed = 0 WHERE id = ?').bind(await passwordHash(key,salt),salt,target.id),db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id)]);return json({ok:true});}
 fail(400,'Azione non valida.');
 }
 if(path==='/api/upload'&&req.method==='POST'){
 if(!env.BUCKET)fail(503,'Le immagini non sono disponibili al momento.');
 if(Number(req.headers.get('content-length')||0)>4500000)fail(413,'Usa un’immagine fino a 4 MB.');const form=await req.formData();const file=form.get('file');if(!(file instanceof File)||file.size>4194304||file.size<12)fail(400,'Usa un’immagine PNG, JPEG o WebP fino a 4 MB.');
 const bytes=await file.arrayBuffer();const b=new Uint8Array(bytes);let mime='';if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)mime='image/png';else if(b[0]===255&&b[1]===216&&b[2]===255)mime='image/jpeg';else if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')mime='image/webp';if(!mime)fail(400,'Formato immagine non supportato.');
 const id=crypto.randomUUID();await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:mime}});try{await db.prepare('INSERT INTO uploads (id,owner,mime,created) VALUES (?,?,?,?)').bind(id,user.id,mime,Date.now()).run();}catch(e){await env.BUCKET.delete(id);throw e;}return json({id});
 }
 if(path.startsWith('/api/media/')&&req.method==='GET'){
 const id=path.split('/').pop()!;const u=await db.prepare('SELECT * FROM uploads WHERE id = ?').bind(id).first<any>();if(!u)fail(404,'Immagine non disponibile.');
 if(u.owner!==user.id){const settings=await db.prepare('SELECT value FROM settings WHERE id = ?').bind('campaign').first<any>();const sharedToken=JSON.parse(settings.value).partyImage===id;const refs=(await db.prepare("SELECT * FROM records WHERE json_extract(data,'$.image') = ? OR json_extract(data,'$.markerImage') = ? OR EXISTS (SELECT 1 FROM json_each(records.data,'$.images') WHERE json_extract(value,'$.id') = ?)").bind(id,id,id).all()).results.map(unpack);if(!sharedToken&&!refs.some(r=>visible(r,user)))fail(404,'Immagine non disponibile.');}
 const file=await env.BUCKET.get(id);if(!file)fail(404,'Immagine non disponibile.');
 // L'identificativo è casuale e il contenuto non cambia mai: il browser può conservarla.
 // Resta privata (niente cache condivise) e serve comunque la sessione per ottenerla.
 return new Response(file.body,{headers:{'Content-Type':u.mime,'Cache-Control':'private, max-age=604800, immutable','X-Content-Type-Options':'nosniff'}});
 }
 fail(404,'Risorsa non disponibile.');
 }catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);console.error('Campaign request failed',e instanceof Error?e.message:'Unknown error');return json({error:'Non è stato possibile completare l’operazione. I tuoi dati nel modulo sono conservati: riprova.'},503);}
}
