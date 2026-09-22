/** Disposable local campaign. No production credentials, network database or persistent data. */
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {createServer,preview} from 'vite';
import {access,mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const production=process.argv.includes('--production');
if(production&&!process.argv.includes('--check')){
 try{await access(resolve('dist-netlify/index.html'));}
 catch{throw new Error('Build di produzione mancante: esegui npm run build:netlify prima di avviare npm run preview:demo -- --production.');}
}
await mkdir('.sites-runtime/preview',{recursive:true});
for(const [name,path] of Object.entries({server:'lib/server.ts',postgres:'adapters/postgres.ts',flow:'lib/session-flow.ts'}))await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/preview/'+name+'.mjs'});
const {handleCampaign,passwordHash}=await import(resolve('.sites-runtime/preview/server.mjs'));
const {PostgresDatabase}=await import(resolve('.sites-runtime/preview/postgres.mjs'));
const {cleanSessionFlow,flowPageLinks}=await import(resolve('.sites-runtime/preview/flow.mjs'));
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
const prepFlow=cleanSessionFlow({schema:1,nodes:[
 {id:'flow-arrival',kind:'scene',title:'Riprendere il filo alla locanda',notes:'Apri con un breve riepilogo della sessione precedente. Il viandante torna al tavolo: chiede al gruppo che cosa ha scoperto sulla strada.',x:60,y:210,links:['demo-journal','demo-note']},
 {id:'flow-choice',kind:'decision',title:'Il gruppo si fida del viandante?',notes:'Lascia che i giocatori confrontino gli indizi. Non decidere per loro: prepara entrambe le possibilità e annota le domande ancora aperte.',x:410,y:210,links:['demo-note']},
 {id:'flow-witness',kind:'scene',title:'Una testimonianza a Vallaki',notes:'Il viandante accompagna il gruppo in città. Una nuova testimonianza conferma un dettaglio, ma contraddice il resto del suo racconto.',x:770,y:40,links:['vallaki']},
 {id:'flow-road',kind:'outcome',title:'Le tracce lungo il sentiero',notes:'Il gruppo torna a indagare senza il viandante. Le impronte e i rovi offrono un altro modo di raggiungere lo stesso indizio. Dopo la sessione, riporta nel diario soltanto ciò che è accaduto.',x:770,y:390,links:['demo-journal','demo-note']},
],edges:[
 {id:'flow-intro',from:'flow-arrival',to:'flow-choice',condition:'Il gruppo ascolta la richiesta del viandante'},
 {id:'flow-trust',from:'flow-choice',to:'flow-witness',condition:'Si fidano e accettano di seguirlo'},
 {id:'flow-doubt',from:'flow-choice',to:'flow-road',condition:'Rifiutano oppure vogliono verificare da soli'},
]});
await env.DB.prepare('INSERT INTO records (id,kind,title,body,owner,audience,folder,data,links,version,updated,editor) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)').bind('demo-flow','secret','Sessione 4 · I sentieri di Vallaki','Una preparazione di esempio: una scena iniziale, una scelta del gruppo e due possibili sviluppi. Tutte queste note restano riservate al DM.','dm','["dm"]','',JSON.stringify({section:'session',pinned:true,tasks:[],tags:['preparazione','vallaki'],images:[],prepFlow}),JSON.stringify(flowPageLinks(prepFlow)),Date.now(),'dm').run();
const board={round:1,turnId:'demo-lyria',combatants:[{id:'demo-lyria',name:'Lyria',initiative:18,ac:15,hp:24,maxHp:24,conditions:'',notes:'Scheda di prova'},{id:'demo-wolf',name:'Lupo delle Nebbie',initiative:12,ac:13,hp:11,maxHp:11,conditions:'',notes:'Nota riservata di prova'}]};
await env.DB.prepare('INSERT INTO settings (id,value,version) VALUES (?,?,1)').bind('dm-board',JSON.stringify(board)).run();
// Use the real API in memory, so the example has exactly the same history and
// privacy rules as an encounter archived by the DM. These URLs never leave this process.
let demoCookie='';
async function demoAPI(path,method='GET',data){
 const multipart=data instanceof FormData;
 const response=await handleCampaign(new Request('http://localhost'+path,{method,headers:{Origin:'http://localhost',...(demoCookie?{Cookie:demoCookie}:{}),...(data!==undefined&&!multipart?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:multipart?data:JSON.stringify(data)}:{})}),env);
 const result=await response.json();
 if(!response.ok)throw new Error('Demo '+path+': '+(result.error||response.status));
 const cookie=response.headers.get('set-cookie');if(cookie)demoCookie=cookie.split(';')[0];
 return result;
}
await demoAPI('/api/auth','POST',{action:'login',name:'DM',key:'Barovia-preview-only'});
async function currentBoard(){const row=await env.DB.prepare('SELECT value,version FROM settings WHERE id = ?').bind('dm-board').first();return {data:JSON.parse(row.value),version:row.version};}
async function advanceDemo(change,action){const {data,version}=await currentBoard();await demoAPI('/api/dm-board','PUT',{version,data:change(data),...(action?{action}:{})});}
const actionDefaults={sourceName:'',roll:'',damageType:'',detail:'',requested:[]};
await advanceDemo(data=>({...data,combatants:data.combatants.map(c=>c.id==='demo-wolf'?{...c,hp:6}:c)}),{...actionDefaults,kind:'attack',sourceId:'demo-lyria',label:'Spada lunga',outcome:'hit',roll:'17 contro CA 13',damageType:'Tagliente',detail:'Lyria respinge il lupo dal sentiero, aprendo un varco per i compagni.',targets:['demo-wolf'],requested:[{id:'demo-wolf',kind:'damage',amount:5}]});
await advanceDemo(data=>({...data,turnId:'demo-wolf'}));
await advanceDemo(data=>data,{...actionDefaults,kind:'attack',sourceId:'demo-wolf',label:'Morso',outcome:'miss',roll:'9 contro CA 15',detail:'Il morso si chiude sul mantello: Lyria arretra senza essere ferita.',targets:['demo-lyria']});
await advanceDemo(data=>({...data,round:2,turnId:'demo-lyria'}));
await advanceDemo(data=>({...data,combatants:data.combatants.map(c=>c.id==='demo-wolf'?{...c,conditions:'Trattenuto'}:c)}),{...actionDefaults,kind:'condition',sourceId:'_environment',label:'Rovi sul sentiero',outcome:'success',detail:'I rovi trattengono il lupo e concedono al gruppo il tempo di allontanarsi.',targets:['demo-wolf']});
const finished=await currentBoard();
const archived=await demoAPI('/api/combat/archive','POST',{version:finished.version,encounterId:finished.data.log.id,title:'L’imboscata sul sentiero di Vallaki',links:['demo-journal','vallaki']});
const picture=new FormData();picture.append('file',new Blob([await readFile('public/barovia-map.webp')],{type:'image/webp'}),'sentiero-verso-vallaki.webp');
const cover=await demoAPI('/api/upload','POST',picture);
await demoAPI('/api/records','PUT',{id:archived.id,kind:'combat',version:1,title:'L’imboscata sul sentiero di Vallaki',body:'# Il sentiero nelle Nebbie\nLa strada per [[vallaki|Vallaki]] si è chiusa in un ringhio. Lyria ha aperto un varco con la spada, mentre i rovi hanno trattenuto il lupo prima del suo secondo assalto.\n\nIl gruppo ha ripreso il cammino con una domanda: era soltanto fame, o qualcuno stava guidando la bestia?\n\nUn episodio di [[demo-journal|Sotto il cielo di Barovia]].',audience:['dm','lyria'],folder:'',links:['demo-journal','vallaki'],data:{minutes:480,tags:['vallaki','scontri'],images:[{id:cover.id,caption:'Il sentiero verso Vallaki'}]}});
// Restore only this disposable table, leaving the finished chronicle available to read.
await env.DB.prepare('UPDATE settings SET value = ?, version = version + 1 WHERE id = ?').bind(JSON.stringify(board),'dm-board').run();
if(process.argv.includes('--check')){
 const dmState=await demoAPI('/api/state');const chronicle=dmState.records.find(r=>r.id===archived.id);
 assert.equal(chronicle.data.events.filter(e=>!['turn','setup'].includes(e.kind)).length,3);
 assert.equal(chronicle.data.events.flatMap(e=>e.effects).find(e=>e.kind==='damage').amount,5);
 assert.equal(chronicle.data.events.flatMap(e=>e.effects).find(e=>e.kind==='condition').after,'Trattenuto');
 assert.equal(chronicle.data.rounds,2);assert.equal(chronicle.data.images[0].id,cover.id);
 assert.equal(dmState.dmBoard.combatants.length,2);assert.equal(dmState.dmBoard.combatants[1].hp,11);assert.equal(dmState.dmBoard.log,undefined);
 assert.equal(dmState.records.find(r=>r.id==='demo-flow').data.prepFlow.nodes.length,4);
 assert.equal(JSON.stringify(chronicle.data).includes('Nota riservata di prova'),false);
 await demoAPI('/api/auth','POST',{action:'logout'});
 await demoAPI('/api/auth','POST',{action:'login',name:'Lyria',key:'Barovia-preview-only'});
 const playerState=await demoAPI('/api/state');assert.ok(playerState.records.some(r=>r.id===archived.id));assert.equal(playerState.records.some(r=>r.id==='demo-flow'),false);assert.equal(playerState.dmBoard,undefined);
 const media=await handleCampaign(new Request('http://localhost/api/media/'+cover.id,{headers:{Cookie:demoCookie}}),env);assert.equal(media.status,200);assert.ok((await media.arrayBuffer()).byteLength>0);
 await demoAPI('/api/auth','POST',{action:'logout'});await pg.close();
 console.log('Demo verificata: tre azioni, resoconto condiviso con immagine, flusso riservato e tavolo pronto. Nessun server avviato.');
 process.exit(0);
}
await demoAPI('/api/auth','POST',{action:'logout'});
const port=production?5174:5173;
function attachDemoAPI(vite){
 vite.middlewares.use('/api',async(req,res)=>{
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
   const bytes=Buffer.concat(chunks);
   const request=new Request('http://127.0.0.1:'+port+'/api'+req.url,{method:req.method,headers,...(bytes.length?{body:bytes}:{})});
   const result=await handleCampaign(request,env);
   res.statusCode=result.status;result.headers.forEach((value,key)=>res.setHeader(key,value));res.end(Buffer.from(await result.arrayBuffer()));
  }catch(e){console.error(e);res.statusCode=500;res.end('Preview error');}
 });
}
const config={configFile:resolve('vite.netlify.config.ts'),plugins:[{name:'disposable-campaign-api',configureServer:attachDemoAPI,configurePreviewServer:attachDemoAPI}]};
const server=production
 ?await preview({...config,preview:{host:'127.0.0.1',port,strictPort:true}})
 :await createServer({...config,server:{host:'127.0.0.1',port,strictPort:true}});
if(!production)await server.listen();
server.printUrls();
if(production)console.log('Anteprima della build già presente in dist-netlify.');
console.log('Campagna di prova in memoria. Account: DM o Lyria. Chiave di prova: Barovia-preview-only. Nessun dato online viene usato.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();await pg.close();process.exit(0);});
