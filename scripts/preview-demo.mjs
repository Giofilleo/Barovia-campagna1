/** Disposable local campaign. No production credentials, network database or persistent data. */
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {createServer} from 'vite';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('.sites-runtime/preview',{recursive:true});
for(const [name,path] of Object.entries({server:'lib/server.ts',postgres:'adapters/postgres.ts'}))await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/preview/'+name+'.mjs'});
const {handleCampaign,passwordHash}=await import(resolve('.sites-runtime/preview/server.mjs'));
const {PostgresDatabase}=await import(resolve('.sites-runtime/preview/postgres.mjs'));
const pg=new PGlite({parsers:{20:Number}});
await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('supabase/migrations/'+file,'utf8'));
const executor=db=>({async query(sql,values){const r=await db.query(sql,values);return{rows:r.rows,changes:r.affectedRows??r.rows.length};},async transaction(work){return db.transaction(tx=>work(executor(tx)));}});
const files=new Map();
const env={DB:new PostgresDatabase(executor(pg)),BUCKET:{async put(id,bytes){files.set(id,bytes);},async get(id){return files.has(id)?{body:new Blob([files.get(id)]).stream()}:null;},async delete(id){files.delete(id);}}};
await handleCampaign(new Request('http://localhost/api/state'),env);
const salt='00112233445566778899aabbccddeeff';
await env.DB.prepare('UPDATE users SET hash=?,salt=?').bind(await passwordHash('Barovia-preview-only',salt),salt).run();
const demo=[
 {id:'demo-journal',kind:'journal',title:'Sotto il cielo di Barovia',body:'# Il sentiero nelle Nebbie\nIl gruppo ha raggiunto [[vallaki|Vallaki]]. Alla locanda, le parole di un viandante hanno acceso nuovi dubbi.\n\n- Una promessa ancora da mantenere.\n- Le tracce di una presenza sulla strada.\n\nLa sera si è chiusa con una decisione: tornare a indagare.',data:{session:3,date:'2026-09-06',minutes:480,endMinutes:1200},links:['vallaki','demo-note']},
 {id:'demo-note',kind:'note',title:'Voci alla locanda',body:'Qualcuno conosce il nome che abbiamo udito sulla strada. Raccogliamo qui le testimonianze e le domande da riprendere tra una sessione e l’altra.\n\n[[demo-journal|Sessione 3]]',data:{tags:['indizi','vallaki']},links:['vallaki','demo-journal']},
 {id:'demo-character',kind:'character',title:'Il viandante',body:'Un incontro breve, un avvertimento da ricordare. Il suo racconto va confrontato con quello degli abitanti.',data:{subtitle:'Un volto incontrato lungo la strada',status:'In vita'},links:['demo-note']},
 {id:'demo-event-1',kind:'event',title:'L’ingresso nella valle',body:'Le Nebbie si sono richiuse alle nostre spalle.',data:{minutes:480,x:.788,y:.619,path:[],routeVersion:2},links:['demo-journal']},
 {id:'demo-event-2',kind:'event',title:'L’arrivo a Vallaki',body:'Le porte della città si aprono al gruppo.',data:{minutes:1150,x:.4,y:.327,path:[],routeVersion:2},links:['demo-journal','vallaki']},
];
for(const r of demo)await env.DB.prepare('INSERT INTO records (id,kind,title,body,owner,audience,folder,data,links,version,updated,editor) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)').bind(r.id,r.kind,r.title,r.body,'dm','["*"]','',JSON.stringify(r.data),JSON.stringify(r.links),Date.now(),'lyria').run();
const board={round:1,turnId:'demo-lyria',combatants:[{id:'demo-lyria',name:'Lyria',initiative:18,ac:15,hp:24,maxHp:24,conditions:'',notes:'Scheda di prova'},{id:'demo-wolf',name:'Lupo delle Nebbie',initiative:12,ac:13,hp:11,maxHp:11,conditions:'',notes:'Nota riservata di prova'}]};
await env.DB.prepare('INSERT INTO settings (id,value,version) VALUES (?,?,1)').bind('dm-board',JSON.stringify(board)).run();
const server=await createServer({configFile:resolve('vite.netlify.config.ts'),server:{host:'127.0.0.1',port:5173,strictPort:true},plugins:[{name:'disposable-campaign-api',configureServer(vite){vite.middlewares.use('/api',async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);const bytes=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:5173/api'+req.url,{method:req.method,headers,...(bytes.length?{body:bytes}:{} )});const result=await handleCampaign(request,env);res.statusCode=result.status;result.headers.forEach((value,key)=>res.setHeader(key,value));res.end(Buffer.from(await result.arrayBuffer()));}catch(e){console.error(e);res.statusCode=500;res.end('Preview error');}});}}]});
await server.listen();server.printUrls();
console.log('Campagna di prova in memoria. Account: DM o Lyria. Chiave di prova: Barovia-preview-only. Nessun dato online viene usato.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();await pg.close();process.exit(0);});
