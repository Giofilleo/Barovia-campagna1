import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/server.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/server.mjs'});
await build({entryPoints:['lib/campaign.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/campaign.mjs'});
const {handleCampaign,passwordHash}=await import(resolve('.sites-runtime/tests/server.mjs'));
const {dateParts,toMinutes}=await import(resolve('.sites-runtime/tests/campaign.mjs'));
class Adapter {
 constructor(){this.db=new DatabaseSync(':memory:');this.db.exec('PRAGMA foreign_keys=ON;');}
 prepare(sql){const raw=this.db;let values=[];return {bind(...v){values=v;return this;},async first(){return raw.prepare(sql).get(...values)||null;},async all(){return{success:true,results:raw.prepare(sql).all(...values)};},async run(){const r=raw.prepare(sql).run(...values);return{success:true,meta:{changes:Number(r.changes)}};}};}
 async batch(list){this.db.exec('BEGIN');try{const results=[];for(const s of list)results.push(await s.run());this.db.exec('COMMIT');return results;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
let DB,closeDatabase;
if(process.env.TEST_DATABASE==='postgres'){
 const {PGlite}=await import('@electric-sql/pglite');
 await build({entryPoints:['adapters/postgres.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/postgres.mjs'});
 const {PostgresDatabase}=await import(resolve('.sites-runtime/tests/postgres.mjs'));
 const pg=new PGlite({parsers:{20:Number}});
 await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const executor=db=>({async query(sql,values){const r=await db.query(sql,values);return{rows:r.rows,changes:r.affectedRows??r.rows.length};},async transaction(work){return db.transaction(tx=>work(executor(tx)));}});
 DB=new PostgresDatabase(executor(pg));closeDatabase=()=>pg.close();
}else{
 DB=new Adapter();closeDatabase=()=>DB.db.close();
 for(const file of (await readdir('drizzle')).filter(s=>s.endsWith('.sql')).sort())DB.db.exec(await readFile('drizzle/'+file,'utf8'));
}
const files=new Map();const BUCKET={async put(id,bytes,opts){files.set(id,{bytes,opts});},async get(id){const f=files.get(id);return f?{body:new Blob([f.bytes]).stream()}:null;},async delete(id){files.delete(id);}};
const env={DB,BUCKET};const base='https://campaign.example';
async function request(path,{method='GET',data,cookie,origin=base,form,extra}={}){const headers={Origin:origin,'CF-Connecting-IP':'203.0.113.8',...(extra||{})};if(cookie)headers.Cookie=cookie;if(data)headers['Content-Type']='application/json';const response=await handleCampaign(new Request(base+path,{method,headers,body:form|| (data?JSON.stringify(data):undefined)}),env);const result=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.arrayBuffer();return {response,status:response.status,data:result,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
const key='Integration-only-key-983!';
let dm,lyria,nier,secretId,noteId,photoId;
const record=(kind,title,audience=['*'],data={})=>({id:crypto.randomUUID(),kind,title,body:'Contenuto di prova',audience,data,links:[],folder:'',version:0});
await test('Unauthenticated requests initialize safely and reveal no campaign data',async()=>{
 const r=await request('/api/state');assert.equal(r.status,401);assert(!r.data.records);
 assert.equal((await DB.prepare('SELECT count(*) n FROM users').first()).n,7);
 const salt='00112233445566778899aabbccddeeff';const hash=await passwordHash(key,salt);
 await DB.prepare('UPDATE users SET hash=?,salt=?').bind(hash,salt).run();
});
await test('Whitelist login issues a private secure cookie and ignores case',async()=>{
 dm=await request('/api/auth',{method:'POST',data:{action:'login',name:'DM',key}});
 lyria=await request('/api/auth',{method:'POST',data:{action:'login',name:'lYrIa',key}});
 nier=await request('/api/auth',{method:'POST',data:{action:'login',name:'Nier',key}});
 assert.equal(dm.status,200);assert.equal(lyria.status,200);assert.equal(nier.status,200);
 assert.match(dm.response.headers.get('set-cookie'),/HttpOnly/);assert.match(dm.response.headers.get('set-cookie'),/Secure/);assert.match(dm.response.headers.get('set-cookie'),/SameSite=Strict/);
 const s=await request('/api/state',{cookie:dm.cookie});assert.equal(s.data.records.length,6);assert(!JSON.stringify(s.data).includes('hash'));assert(!JSON.stringify(s.data).includes('salt'));
});
await test('A player can exclude the DM; hidden records cannot be read, changed or deleted',async()=>{
 const input=record('note','Segreto di Lyria',['lyria']);const created=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:input});assert.equal(created.status,200);secretId=created.data.id;
 const own=await request('/api/state',{cookie:lyria.cookie});assert(own.data.records.some(r=>r.id===secretId));
 const masters=await request('/api/state',{cookie:dm.cookie});assert(!masters.data.records.some(r=>r.id===secretId));
 const edit=await request('/api/records',{method:'PUT',cookie:dm.cookie,data:{...input,id:secretId,version:1,title:'Forbidden'}});assert.equal(edit.status,403);
 assert.equal((await request('/api/records',{method:'DELETE',cookie:dm.cookie,data:{id:secretId,version:1}})).status,403);
});
await test('Links and private folders do not disclose inaccessible pages',async()=>{
 const folder=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('folder','Cartella segreta',['lyria'])});
 const note={...record('note','Nota condivisa',['*']),links:[secretId],folder:folder.data.id};const r=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:note});assert.equal(r.status,200);noteId=r.data.id;
 const s=await request('/api/state',{cookie:nier.cookie});const shared=s.data.records.find(r=>r.id===noteId);assert.deepEqual(shared.links,[]);assert.equal(shared.folder,'');
 const result=await request('/api/records',{method:'PUT',cookie:nier.cookie,data:{...shared,body:'Collaborazione di Nier',audience:['nier']}});assert.equal(result.status,200);
 const original=await DB.prepare('SELECT * FROM records WHERE id=?').bind(noteId).first();assert.deepEqual(JSON.parse(original.audience),['*']);assert.deepEqual(JSON.parse(original.links),[secretId]);assert.equal(original.folder,folder.data.id);
});
await test('Optimistic locking prevents overwriting concurrent edits',async()=>{
 const s=await request('/api/state',{cookie:lyria.cookie});const record=s.data.records.find(r=>r.id===noteId);const other=(await request('/api/state',{cookie:nier.cookie})).data.records.find(r=>r.id===noteId);
 assert.equal((await request('/api/records',{method:'PUT',cookie:lyria.cookie,data:{...record,body:'Prima modifica'}})).status,200);
 assert.equal((await request('/api/records',{method:'PUT',cookie:nier.cookie,data:{...other,body:'Modifica obsoleta'}})).status,409);
 assert.equal((await DB.prepare('SELECT body FROM records WHERE id=?').bind(noteId).first()).body,'Prima modifica');
});
await test('Only the DM can set the current clock, position and reputation',async()=>{
 const s=await request('/api/state',{cookie:dm.cookie});const data={settings:{...s.data.settings,minutes:1600,party:{x:.4,y:.6}},version:s.data.settingsVersion};
 assert.equal((await request('/api/settings',{method:'PUT',cookie:lyria.cookie,data})).status,403);
 assert.equal((await request('/api/settings',{method:'PUT',cookie:dm.cookie,data})).status,200);
 assert.equal((await request('/api/settings',{method:'PUT',cookie:dm.cookie,data})).status,409);
 assert.equal((await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('faction','Forbidden')})).status,403);
 assert.equal((await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('faction','Vistani',['*'],{reputation:32})})).status,200);
 assert.equal((await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('secret','Forbidden')})).status,403);
});
await test('Every visible player can create and modify timeline events and drawn routes',async()=>{
 const input=record('event','Il viaggio',['*'],{minutes:1680,x:.5,y:.7,path:[{x:.2,y:.3},{x:.5,y:.7}]});
 const r=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:input});assert.equal(r.status,200);
 const state=await request('/api/state',{cookie:nier.cookie});const event=state.data.records.find(e=>e.id===r.data.id);
 assert.equal((await request('/api/records',{method:'PUT',cookie:nier.cookie,data:{...event,data:{...event.data,minutes:1750,x:.6}}})).status,200);
 const dbEvent=JSON.parse((await DB.prepare('SELECT data FROM records WHERE id=?').bind(r.data.id).first()).data);assert.equal(dbEvent.minutes,1750);assert.equal(dbEvent.path.length,2);
});
await test('Portrait uploads use authenticated and visibility-checked image endpoints',async()=>{
 const data=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);const form=new FormData();form.append('file',new File([data],'avatar.png',{type:'image/png'}));
 const upload=await request('/api/upload',{method:'POST',cookie:lyria.cookie,form});assert.equal(upload.status,200);photoId=upload.data.id;
 const person=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('character','Personaggio privato',['lyria','nier'],{image:photoId})});assert.equal(person.status,200);
 assert.equal((await request('/api/media/'+photoId,{cookie:lyria.cookie})).status,200);assert.equal((await request('/api/media/'+photoId,{cookie:nier.cookie})).status,200);assert.equal((await request('/api/media/'+photoId,{cookie:dm.cookie})).status,404);assert.equal((await request('/api/media/'+photoId)).status,401);
});
await test('Cross-origin mutations are rejected',async()=>{
 assert.equal((await request('/api/records',{method:'POST',cookie:dm.cookie,origin:'https://other.example',data:record('note','CSRF')})).status,403);
});
await test('Changing a key revokes old sessions and old credentials',async()=>{
 const newKey='A-different-test-key-783!';const change=await request('/api/auth',{method:'POST',cookie:lyria.cookie,data:{action:'change',oldKey:key,newKey}});assert.equal(change.status,200);
 assert.equal((await request('/api/state',{cookie:lyria.cookie})).status,401);
 assert.equal((await request('/api/state',{cookie:change.cookie})).status,200);
 assert.equal((await request('/api/auth',{method:'POST',data:{action:'login',name:'Lyria',key}})).status,401);
 lyria=change;
});
await test('Whitelist deactivation immediately revokes player access',async()=>{
 assert.equal((await request('/api/users',{method:'POST',cookie:dm.cookie,data:{action:'toggle',id:'nier'}})).status,200);
 assert.equal((await request('/api/state',{cookie:nier.cookie})).status,401);
 assert.equal((await request('/api/auth',{method:'POST',data:{action:'login',name:'Nier',key}})).status,401);
 assert.equal((await request('/api/users',{method:'POST',cookie:dm.cookie,data:{action:'toggle',id:'dm'}})).status,400);
});
await test('Login attempts are bounded',async()=>{
 for(let i=0;i<10;i++)assert.equal((await request('/api/auth',{method:'POST',data:{action:'login',name:'Unknown account',key:'incorrect-key'}})).status,401);
 assert.equal((await request('/api/auth',{method:'POST',data:{action:'login',name:'Unknown account',key:'incorrect-key'}})).status,429);
});
await test('The 28-day calendar crosses month and year boundaries correctly',()=>{
 assert.deepEqual(dateParts(0),{year:735,month:0,day:1,hour:0,minute:0});
 assert.deepEqual(dateParts(28*1440),{year:735,month:1,day:1,hour:0,minute:0});
 assert.deepEqual(dateParts(336*1440),{year:736,month:0,day:1,hour:0,minute:0});
 assert.equal(toMinutes(735,11,28,23,59)+1,336*1440);
});

await test('Inline links create graph links, hide private labels and survive edits by restricted readers',async()=>{
 const input={...record('note','Test link nel testo',['*']),body:'Un riferimento a [['+secretId+'|Nome riservato del luogo]].'};
 const created=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:input});assert.equal(created.status,200);
 const own=(await request('/api/state',{cookie:lyria.cookie})).data.records.find(r=>r.id===created.data.id);assert(own.links.includes(secretId));
 const publicView=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===created.data.id);assert(!publicView.body.includes('Nome riservato'));assert.deepEqual(publicView.links,[]);
 assert.equal((await request('/api/records',{method:'PUT',cookie:dm.cookie,data:{...publicView,body:publicView.body+' Un aggiornamento.'}})).status,200);
 const stored=await DB.prepare('SELECT body,links FROM records WHERE id=?').bind(created.data.id).first();assert(stored.body.includes('Nome riservato del luogo'));assert(JSON.parse(stored.links).includes(secretId));
});
await test('Note and map-pin galleries follow page visibility, including marker images',async()=>{
 const form=new FormData();form.append('file',new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82])],'place.png',{type:'image/png'}));
 const uploaded=await request('/api/upload',{method:'POST',cookie:lyria.cookie,form});assert.equal(uploaded.status,200);const imageId=uploaded.data.id;
 const note=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('note','Allegati privati',['lyria'],{images:[{id:imageId,caption:'Una mappa locale'}]})});assert.equal(note.status,200);
 assert.equal((await request('/api/media/'+imageId,{cookie:dm.cookie})).status,404);
 const pin=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('pin','Pin illustrato',['*'],{x:.2,y:.3,markerImage:imageId,images:[{id:imageId,caption:'Dettaglio'}]})});assert.equal(pin.status,200);
 assert.equal((await request('/api/media/'+imageId,{cookie:dm.cookie})).status,200);
 const pinData=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===pin.data.id).data;assert.equal(pinData.markerImage,imageId);assert.equal(pinData.images[0].caption,'Dettaglio');
 const steal=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('note','Immagine non mia',['*'],{images:[{id:photoId,caption:'Non autorizzata'}]})});assert.equal(steal.status,403);
});
await test('The DM can share a party token without opening access to private uploads',async()=>{
 const form=new FormData();form.append('file',new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82])],'party.png',{type:'image/png'}));
 const uploaded=await request('/api/upload',{method:'POST',cookie:dm.cookie,form});const id=uploaded.data.id;
 assert.equal((await request('/api/media/'+id,{cookie:lyria.cookie})).status,404);
 const state=(await request('/api/state',{cookie:dm.cookie})).data;
 assert.equal((await request('/api/settings',{method:'PUT',cookie:dm.cookie,data:{settings:{...state.settings,partyImage:id,locationRadiusMiles:.1},version:state.settingsVersion}})).status,200);
 assert.equal((await request('/api/media/'+id,{cookie:lyria.cookie})).status,200);
 assert.equal((await request('/api/media/'+id)).status,401);
 const s=(await request('/api/state',{cookie:lyria.cookie})).data;assert.equal(s.settings.partyImage,id);assert.equal(s.settings.locationRadiusMiles,.1);
});
await test('Supplies are shared, consumption is atomic, shortages and stale changes are rejected',async()=>{
 let s=(await request('/api/state',{cookie:lyria.cookie})).data;assert.equal(s.suppliesVersion,0);
 let r=await request('/api/supplies',{method:'POST',cookie:lyria.cookie,data:{action:'set',version:0,data:{...s.supplies,rations:30,water:0,partySize:6,foodPerPerson:1,waterPerPerson:2},note:'Rifornimento'}});assert.equal(r.status,200);
 assert.equal((await request('/api/supplies',{method:'POST',cookie:dm.cookie,data:{action:'set',version:0,data:{rations:999}}})).status,409);
 s=(await request('/api/state',{cookie:dm.cookie})).data;assert.equal(s.supplies.rations,30);assert.equal(s.supplies.water,undefined);assert.equal(s.supplies.history[0].by,'lyria');
 r=await request('/api/supplies',{method:'POST',cookie:dm.cookie,data:{action:'consume',days:2,version:s.suppliesVersion}});assert.equal(r.status,200);
 s=(await request('/api/state',{cookie:dm.cookie})).data;assert.equal(s.supplies.rations,18);assert.equal(s.supplies.water,undefined);
 assert.equal((await request('/api/supplies',{method:'POST',cookie:dm.cookie,data:{action:'consume',days:4,version:s.suppliesVersion}})).status,400);
 assert.equal((await request('/api/supplies',{method:'POST',cookie:lyria.cookie,data:{action:'undo',version:s.suppliesVersion}})).status,200);
 s=(await request('/api/state',{cookie:lyria.cookie})).data;assert.equal(s.supplies.rations,30);assert.equal(s.supplies.water,undefined);assert(s.supplies.history[0].reversed);
});
await test('The initiative tracker and checklist stay server-private to the DM',async()=>{
 const board={round:2,turnId:'test-enemy',combatants:[{id:'test-enemy',name:'Avversario segreto',initiative:18,ac:15,hp:40,maxHp:35,conditions:'Afferrato',notes:'Nota privata'}]};
 assert.equal((await request('/api/dm-board',{method:'PUT',cookie:lyria.cookie,data:{data:board,version:0}})).status,403);
 assert.equal((await request('/api/dm-board',{method:'PUT',cookie:dm.cookie,data:{data:board,version:0}})).status,200);
 assert.equal((await request('/api/dm-board',{method:'PUT',cookie:dm.cookie,data:{data:board,version:0}})).status,409);
 const player=(await request('/api/state',{cookie:lyria.cookie})).data;assert(!('dmBoard' in player));assert(!JSON.stringify(player).includes('Avversario segreto'));
 const master=(await request('/api/state',{cookie:dm.cookie})).data;assert.equal(master.dmBoard.combatants[0].hp,35);assert.equal(master.dmBoard.round,2);
 const n=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('secret','Preparazione DM',['*'],{section:'scene',pinned:true,tasks:[{id:'task1',text:'Preparare incontro',done:false}]})});assert.equal(n.status,200);
 const dmNote=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===n.data.id);assert.equal(dmNote.data.tasks[0].text,'Preparare incontro');assert(dmNote.data.pinned);
 assert(!(await request('/api/state',{cookie:lyria.cookie})).data.records.some(r=>r.id===n.data.id));
});
await test('Route geometry and long descriptions are saved without silent data loss',async()=>{
 const input=record('event','Percorso con snodi',['*'],{minutes:2000,x:.8,y:.5,path:[{x:.3,y:.4},{x:.6,y:.2}],routeVersion:2,curve:true});
 const r=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:input});assert.equal(r.status,200);
 const stored=JSON.parse((await DB.prepare('SELECT data FROM records WHERE id=?').bind(r.data.id).first()).data);assert.equal(stored.routeVersion,2);assert.equal(stored.curve,true);assert.equal(stored.path.length,2);
 assert.equal((await request('/api/records',{method:'POST',cookie:lyria.cookie,data:{...record('note','Testo lungo'),body:'a'.repeat(60001)}})).status,400);
});
await test('Transfer export keeps hidden pages and credentials private, and includes authorized image metadata',async()=>{
 assert.equal((await request('/api/export')).status,401);
 const master=(await request('/api/export',{cookie:dm.cookie})).data;
 const player=(await request('/api/export',{cookie:lyria.cookie})).data;
 assert.equal(master.format,'barovia-transfer');assert(master.settings);assert(master.dmBoard);
 assert(!master.records.some(r=>r.id===secretId));assert(player.records.some(r=>r.id===secretId));
 assert.equal(player.settings,undefined);assert.equal(player.dmBoard,undefined);
 assert(!master.uploads.some(u=>u.id===photoId));assert(player.uploads.some(u=>u.id===photoId));
 assert(!JSON.stringify(master).includes('"hash"'));assert(!JSON.stringify(player).includes('"salt"'));
});
await test('Legacy supply values retain rations while water no longer limits autonomy or consumption',async()=>{
 const s=(await request('/api/state',{cookie:dm.cookie})).data;
 await DB.prepare('UPDATE settings SET value = ? WHERE id = ?').bind(JSON.stringify({...s.supplies,rations:18,water:0,waterPerPerson:200}), 'supplies').run();
 const current=(await request('/api/state',{cookie:dm.cookie})).data;assert.equal(current.supplies.water,undefined);
 assert.equal((await request('/api/supplies',{method:'POST',cookie:dm.cookie,data:{action:'consume',days:3,version:current.suppliesVersion}})).status,200);
 assert.equal((await request('/api/state',{cookie:dm.cookie})).data.supplies.rations,0);
});

// --- Conservazione dei dati già salvati nella campagna --------------------------
// Questi controlli esistono per una ragione sola: la campagna online contiene già
// eventi con il percorso disegnato a mano. Nessuna modifica futura deve poterli
// cancellare passando dal salvataggio di una voce.
await test('Un evento con percorso disegnato sopravvive al salvataggio e a una modifica successiva',async()=>{
 const path=[{x:.31,y:.42},{x:.355,y:.447},{x:.372,y:.468},{x:.4,y:.5}];
 const input=record('event','Verso Vallaki',['*'],{x:.4,y:.5,minutes:4321,category:'luogo',path,routeVersion:2,curve:true});
 const created=await request('/api/records',{method:'POST',cookie:dm.cookie,data:input});assert.equal(created.status,200);
 const stored=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===created.data.id);
 assert.deepEqual(stored.data.path,path,'gli snodi del percorso devono tornare identici');
 assert.equal(stored.data.routeVersion,2);assert.equal(stored.data.curve,true);
 assert.equal(stored.data.minutes,4321);assert.equal(stored.data.x,.4);assert.equal(stored.data.y,.5);
 const renamed=await request('/api/records',{method:'PUT',cookie:dm.cookie,data:{...stored,title:'Verso Vallaki, di notte'}});
 assert.equal(renamed.status,200);
 const after=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===created.data.id);
 assert.deepEqual(after.data.path,path,'rinominare un evento non deve toccare il percorso');
 assert.equal(after.data.curve,true);assert.equal(after.data.routeVersion,2);assert.equal(after.data.minutes,4321);
});
await test('Luoghi, personaggi, sessioni, tesoro e fazioni conservano ogni campo',async()=>{
 const cases=[
  ['pin',{x:.788,y:.619,category:'insediamento',markerIcon:'town',markerImage:''}],
  ['character',{subtitle:'mercante di Vallaki',status:'In vita',image:''}],
  ['journal',{session:3,date:'2026-08-30'}],
  ['treasure',{quantity:7,value:12.5,holder:'Ismark',category:'pozione'}],
  ['faction',{reputation:-14,subtitle:'Referente: Madam Eva'}],
 ];
 for(const [kind,data] of cases){
  const created=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record(kind,'Prova '+kind,['*'],data)});
  assert.equal(created.status,200,kind);
  const stored=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===created.data.id);
  for(const [field,value] of Object.entries(data))assert.deepEqual(stored.data[field],value,kind+'.'+field);
  const again=await request('/api/records',{method:'PUT',cookie:dm.cookie,data:{...stored,title:'Prova '+kind+' modificata'}});
  assert.equal(again.status,200,kind);
  const after=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===created.data.id);
  for(const [field,value] of Object.entries(data))assert.deepEqual(after.data[field],value,kind+'.'+field+' dopo la modifica');
 }
});
await test('Le immagini collegate a una voce restano collegate dopo una modifica',async()=>{
 const created=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('pin','Luogo con segnalino',['*'],{x:.2,y:.3,markerImage:photoId,markerIcon:'castle',images:[{id:photoId,caption:'Veduta'}]})});
 assert.equal(created.status,200);
 const stored=(await request('/api/state',{cookie:lyria.cookie})).data.records.find(r=>r.id===created.data.id);
 assert.equal(stored.data.markerImage,photoId);assert.deepEqual(stored.data.images,[{id:photoId,caption:'Veduta'}]);
 const again=await request('/api/records',{method:'PUT',cookie:lyria.cookie,data:{...stored,title:'Luogo rinominato'}});
 assert.equal(again.status,200);
 const after=(await request('/api/state',{cookie:lyria.cookie})).data.records.find(r=>r.id===created.data.id);
 assert.equal(after.data.markerImage,photoId);assert.deepEqual(after.data.images,[{id:photoId,caption:'Veduta'}]);
});
await test('La calibrazione della mappa e il calendario sopravvivono al salvataggio delle impostazioni',async()=>{
 const before=(await request('/api/state',{cookie:dm.cookie})).data;
 const next={...before.settings,mapWidthMiles:23.5,mapCalibrated:true,speed:2.5,locationRadiusMiles:.4};
 assert.equal((await request('/api/settings',{method:'PUT',cookie:dm.cookie,data:{settings:next,version:before.settingsVersion}})).status,200);
 const after=(await request('/api/state',{cookie:dm.cookie})).data.settings;
 assert.equal(after.mapWidthMiles,23.5);assert.equal(after.mapCalibrated,true);assert.equal(after.speed,2.5);
 assert.equal(after.locationRadiusMiles,.4);assert.deepEqual(after.months,before.settings.months);
 assert.deepEqual(after.party,before.settings.party);assert.equal(after.title,before.settings.title);
});
await test('Lo stato risponde «non è cambiato niente» finché nessuno modifica la campagna',async()=>{
 const first=await request('/api/state',{cookie:dm.cookie});
 const tag=first.response.headers.get('etag');assert(tag,'manca l’impronta ETag');
 const repeat=await request('/api/state',{cookie:dm.cookie,extra:{'If-None-Match':tag}});
 assert.equal(repeat.status,304);assert.equal(repeat.response.headers.get('etag'),tag);
 assert.equal((await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('note','Novità',['*'])})).status,200);
 const changed=await request('/api/state',{cookie:dm.cookie,extra:{'If-None-Match':tag}});
 assert.equal(changed.status,200);assert.notEqual(changed.response.headers.get('etag'),tag);
});
await test('Il conteggio dei tentativi separa il nome dall’indirizzo di provenienza',async()=>{
 const wrong={action:'login',name:'Nier',key:'chiave-sbagliata-ma-lunga'};
 for(let i=0;i<10;i++)await request('/api/auth',{method:'POST',data:wrong,extra:{'X-Nf-Client-Connection-IP':'198.51.100.'+i}});
 const blocked=await request('/api/auth',{method:'POST',data:wrong,extra:{'X-Nf-Client-Connection-IP':'198.51.100.99'}});
 assert.equal(blocked.status,429,'il nome sotto attacco viene protetto anche cambiando indirizzo');
 const other=await request('/api/auth',{method:'POST',data:{action:'login',name:'Lyria',key:'chiave-sbagliata-ma-lunga'},extra:{'X-Nf-Client-Connection-IP':'198.51.100.99'}});
 assert.equal(other.status,401,'un altro nome dallo stesso indirizzo non deve ereditare il blocco');
 for(let i=0;i<30;i++)await request('/api/auth',{method:'POST',data:{action:'login',name:'Ospite'+i,key:'chiave-sbagliata-ma-lunga'},extra:{'X-Nf-Client-Connection-IP':'198.51.100.7'}});
 const flood=await request('/api/auth',{method:'POST',data:{action:'login',name:'Ospite99',key:'chiave-sbagliata-ma-lunga'},extra:{'X-Nf-Client-Connection-IP':'198.51.100.7'}});
 assert.equal(flood.status,429,'chi prova molti nomi dallo stesso indirizzo viene fermato');
});

await test('Le etichette, la scheda del personaggio e la moneta si salvano senza toccare il resto',async()=>{
 const pg=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('character','Ireena',['*'],{subtitle:'sorella di Ismark',status:'In vita',pc:true,player:'Rita',role:'Chierico',level:4,hp:22,maxHp:31,ac:16,passive:13,speed:9,tags:['Barovia','ALLEATI','barovia']})});
 assert.equal(pg.status,200);
 const stored=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===pg.data.id);
 assert.equal(stored.data.pc,true);assert.equal(stored.data.hp,22);assert.equal(stored.data.maxHp,31);assert.equal(stored.data.ac,16);
 assert.equal(stored.data.passive,13);assert.equal(stored.data.player,'Rita');assert.equal(stored.data.level,4);
 assert.deepEqual(stored.data.tags,['barovia','alleati'],'le etichette si normalizzano e non si ripetono');
 assert.equal(stored.data.subtitle,'sorella di Ismark');assert.equal(stored.data.status,'In vita');
 const npc=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('character','Oste',['*'],{subtitle:'locanda',status:'In vita'})});
 const plain=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===npc.data.id);
 assert.equal(plain.data.pc,false);assert.equal(plain.data.hp,undefined,'un personaggio non giocante non prende campi di scheda');
 const coin=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('treasure','Monete',['*'],{quantity:120,value:1,currency:'ma'})});
 const money=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===coin.data.id);
 assert.equal(money.data.currency,'ma');
 const old=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('treasure','Oggetto senza moneta',['*'],{quantity:1,value:50})});
 const legacy=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===old.data.id);
 assert.equal(legacy.data.currency,'mo','senza indicazione la moneta resta l’oro, come prima');
});
await test('Le stesure precedenti vengono conservate, restano private e spariscono con la voce',async()=>{
 const created=await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('note','Teoria sul castello',['lyria'],{})});
 const first=(await request('/api/state',{cookie:lyria.cookie})).data.records.find(r=>r.id===created.data.id);
 await request('/api/records',{method:'PUT',cookie:lyria.cookie,data:{...first,body:'Seconda stesura'}});
 const second=(await request('/api/state',{cookie:lyria.cookie})).data.records.find(r=>r.id===created.data.id);
 await request('/api/records',{method:'PUT',cookie:lyria.cookie,data:{...second,body:'Terza stesura'}});
 const list=await request('/api/revisions?id='+created.data.id,{cookie:lyria.cookie});
 assert.equal(list.status,200);assert.equal(list.data.revisions.length,2);
 assert.equal(list.data.revisions[0].body,'Seconda stesura','la piu recente per prima');
 assert.equal((await request('/api/revisions?id='+created.data.id,{cookie:dm.cookie})).status,404,'chi non vede la voce non ne vede le stesure');
 const current=(await request('/api/state',{cookie:lyria.cookie})).data.records.find(r=>r.id===created.data.id);
 assert.equal((await request('/api/records',{method:'DELETE',cookie:lyria.cookie,data:{id:current.id,version:current.version}})).status,200);
 assert.equal((await DB.prepare('SELECT count(*) n FROM revisions WHERE record_id = ?').bind(created.data.id).first()).n,0);
});
await test('Il segnalibro delle novità è personale',async()=>{
 const at=1770000000000;
 assert.equal((await request('/api/seen',{method:'POST',cookie:lyria.cookie,data:{at}})).status,200);
 const mine=(await request('/api/state',{cookie:lyria.cookie})).data;
 assert.equal(mine.user.seen,at);
 assert.equal(mine.users.find(u=>u.id!==mine.user.id&&u.seen!==undefined),undefined,'il segnalibro altrui non viene mostrato');
 assert.equal((await request('/api/state',{cookie:dm.cookie})).data.user.seen,0);
});
await test('Il bestiario è riservato al DM e conserva gli avversari salvati',async()=>{
 const before=(await request('/api/state',{cookie:dm.cookie})).data;
 assert.deepEqual(before.bestiary,{creatures:[]});
 assert.equal((await request('/api/state',{cookie:lyria.cookie})).data.bestiary,undefined);
 const creatures=[{id:'lupo',name:'Lupo delle nebbie',ac:13,maxHp:11,initiative:2,conditions:'',notes:'Branco'}];
 assert.equal((await request('/api/bestiary',{method:'PUT',cookie:dm.cookie,data:{data:{creatures},version:before.bestiaryVersion}})).status,200);
 assert.equal((await request('/api/bestiary',{method:'PUT',cookie:lyria.cookie,data:{data:{creatures},version:1}})).status,403);
 assert.deepEqual((await request('/api/state',{cookie:dm.cookie})).data.bestiary.creatures,creatures);
});

await test('Le mappe aggiuntive sono del DM, conservano proporzioni e scala, e non toccano i luoghi esistenti',async()=>{
 // Un luogo salvato prima di questa novità non ha il campo «mappa»: deve restare
 // sulla mappa principale, cioè avere mappa vuota, anche dopo una modifica.
 const vecchio=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('pin','Luogo di prima',['*'],{x:.3,y:.4,markerIcon:'town'})});
 const primo=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===vecchio.data.id);
 assert.equal(primo.data.map,'','un luogo senza indicazione resta sulla mappa principale');
 await request('/api/records',{method:'PUT',cookie:dm.cookie,data:{...primo,title:'Luogo di prima, rivisto'}});
 const dopo=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===vecchio.data.id);
 assert.equal(dopo.data.map,'');assert.equal(dopo.data.markerIcon,'town');assert.equal(dopo.data.x,.3);
 const mappa=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('map','Casa della morte',['*'],{image:'',ratio:1.25,widthMiles:.08,calibrated:true,parent:'',x:.788,y:.619})});
 assert.equal(mappa.status,200);
 const salvata=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===mappa.data.id);
 assert.equal(salvata.data.ratio,1.25);assert.equal(salvata.data.widthMiles,.08);assert.equal(salvata.data.calibrated,true);assert.equal(salvata.data.parent,'');
 assert.equal(salvata.data.x,.788);assert.equal(salvata.data.y,.619);
 const dentro=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('pin','Solaio',['*'],{x:.5,y:.2,map:mappa.data.id})});
 const stanza=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===dentro.data.id);
 assert.equal(stanza.data.map,mappa.data.id,'un luogo può appartenere a una mappa figlia');
 assert.equal((await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('map','Mappa di un giocatore',['*'],{})})).status,403);
});
await test('Le tabelle casuali restano riservate al DM e conservano le righe',async()=>{
 const entries=[{id:'a',text:'Un branco di lupi segue il gruppo'},{id:'b',text:'Una carovana vistani accampata'},{id:'c',text:'Nebbia improvvisa: il sentiero sparisce'}];
 const created=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('table','Incontri notturni',['*'],{entries,dice:'1d3 · notte'})});
 assert.equal(created.status,200);
 const stored=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===created.data.id);
 assert.equal(stored.data.entries.length,3);assert.equal(stored.data.entries[1].text,'Una carovana vistani accampata');assert.equal(stored.data.dice,'1d3 · notte');
 assert.deepEqual(stored.audience.sort(),['dm'],'la visibilità viene forzata al solo DM');
 assert.equal((await request('/api/state',{cookie:lyria.cookie})).data.records.some(r=>r.id===created.data.id),false);
 assert.equal((await request('/api/records',{method:'POST',cookie:lyria.cookie,data:record('table','Tabella di un giocatore',['*'],{entries})})).status,403);
});

await test('L’aspetto dei segnalini è una scelta della campagna, con valori sensati di partenza',async()=>{
 const before=(await request('/api/state',{cookie:dm.cookie})).data;
 assert.equal(before.settings.pinScale,1);assert.equal(before.settings.pinLabels,'sempre');assert.equal(before.settings.pinLabelScale,1);
 const next={...before.settings,pinScale:1.4,pinLabels:'passaggio',pinLabelScale:.8};
 assert.equal((await request('/api/settings',{method:'PUT',cookie:dm.cookie,data:{settings:next,version:before.settingsVersion}})).status,200);
 const saved=(await request('/api/state',{cookie:lyria.cookie})).data.settings;
 assert.equal(saved.pinScale,1.4);assert.equal(saved.pinLabels,'passaggio');assert.equal(saved.pinLabelScale,.8,'i valori arrivano uguali a tutti');
 const current=(await request('/api/state',{cookie:dm.cookie})).data;
 const assurdo={...current.settings,pinScale:99,pinLabels:'colorate',pinLabelScale:-3};
 assert.equal((await request('/api/settings',{method:'PUT',cookie:dm.cookie,data:{settings:assurdo,version:current.settingsVersion}})).status,200);
 const clamped=(await request('/api/state',{cookie:dm.cookie})).data.settings;
 assert.equal(clamped.pinScale,2.5);assert.equal(clamped.pinLabels,'sempre');assert.equal(clamped.pinLabelScale,.6);
 assert.equal((await request('/api/settings',{method:'PUT',cookie:lyria.cookie,data:{settings:next,version:1}})).status,403);
});
await test('Un ingresso conserva l’icona e l’immagine del suo segnalino',async()=>{
 const created=await request('/api/records',{method:'POST',cookie:dm.cookie,data:record('map','Cripta',['*'],{ratio:1.3,widthMiles:.02,parent:'',x:.2,y:.7,markerIcon:'skull'})});
 const stored=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===created.data.id);
 assert.equal(stored.data.markerIcon,'skull');assert.equal(stored.data.markerImage,'');
 const moved=await request('/api/records',{method:'PUT',cookie:dm.cookie,data:{...stored,data:{...stored.data,x:.44,y:.51}}});
 assert.equal(moved.status,200);
 const after=(await request('/api/state',{cookie:dm.cookie})).data.records.find(r=>r.id===created.data.id);
 assert.equal(after.data.x,.44);assert.equal(after.data.y,.51,'trascinare un ingresso ne salva la posizione');
 assert.equal(after.data.markerIcon,'skull');assert.equal(after.data.ratio,1.3);assert.equal(after.data.widthMiles,.02);
});
await closeDatabase();
