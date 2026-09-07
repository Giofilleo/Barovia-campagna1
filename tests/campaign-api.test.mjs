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
 await pg.exec(await readFile('supabase/migrations/0001_barovia.sql','utf8'));
 const executor=db=>({async query(sql,values){const r=await db.query(sql,values);return{rows:r.rows,changes:r.affectedRows??r.rows.length};},async transaction(work){return db.transaction(tx=>work(executor(tx)));}});
 DB=new PostgresDatabase(executor(pg));closeDatabase=()=>pg.close();
}else{
 DB=new Adapter();closeDatabase=()=>DB.db.close();
 for(const file of (await readdir('drizzle')).filter(s=>s.endsWith('.sql')).sort())DB.db.exec(await readFile('drizzle/'+file,'utf8'));
}
const files=new Map();const BUCKET={async put(id,bytes,opts){files.set(id,{bytes,opts});},async get(id){const f=files.get(id);return f?{body:new Blob([f.bytes]).stream()}:null;},async delete(id){files.delete(id);}};
const env={DB,BUCKET};const base='https://campaign.example';
async function request(path,{method='GET',data,cookie,origin=base,form}={}){const headers={Origin:origin,'CF-Connecting-IP':'203.0.113.8'};if(cookie)headers.Cookie=cookie;if(data)headers['Content-Type']='application/json';const response=await handleCampaign(new Request(base+path,{method,headers,body:form|| (data?JSON.stringify(data):undefined)}),env);const result=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.arrayBuffer();return {response,status:response.status,data:result,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
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
await closeDatabase();
