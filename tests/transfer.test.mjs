import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {prepareTransfer,writeTransfer} from '../scripts/transfer-data.mjs';
const users=[{id:'dm',name:'DM',role:'dm',active:1},{id:'lyria',name:'Lyria',role:'player',active:1}];
const seeds=users.map(u=>({...u,hash:'test-verifier',salt:'00112233445566778899aabbccddeeff'}));
const id='11111111-1111-1111-1111-111111111111';
const image={id,owner:'lyria',mime:'image/png',created:1000,base64:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')};
const record={id:'note-a',kind:'note',title:'Privato',body:'Testo originale',owner:'lyria',audience:['lyria'],links:[],data:{images:[{id,caption:'Immagine privata'}]},folder:'',version:2,updated:2000,editor:'lyria'};
const dm={format:'barovia-transfer',schemaVersion:1,exportedAt:'2026-09-01',exportedBy:'dm',users,records:[],uploads:[],settings:{minutes:480,months:[]},supplies:{rations:20,water:0,partySize:6,foodPerPerson:1,waterPerPerson:10,history:[]},dmBoard:{round:1,turnId:'',combatants:[]}};
const player={...dm,exportedBy:'lyria',records:[record],uploads:[image]};delete player.settings;
await test('Transfer combines owner exports and preserves IDs, visibility and image bytes',()=>{
 const result=prepareTransfer([dm,player],seeds);assert.deepEqual(result.missingExports,[]);assert.equal(result.records.length,1);assert.deepEqual(result.records[0].audience,['lyria']);assert.equal(result.uploads[0].id,id);assert.equal(result.supplies.water,undefined);assert(!('base64' in result.records[0]));
 const shared={...dm,records:[{...record,title:'Copia condivisa'}],uploads:[image]};assert.equal(prepareTransfer([player,shared],seeds).records[0].title,'Privato');
});
await test('Incomplete and corrupt transfers are reported before writing',()=>{
 assert.deepEqual(prepareTransfer([dm],seeds).missingExports,['Lyria']);
 assert.throws(()=>prepareTransfer([{...player,uploads:[]},dm],seeds),/Mancano immagini/);
 assert.throws(()=>prepareTransfer([{...player,uploads:[{...image,base64:'invalid'}]},dm],seeds),/Immagine non valida/);
});
const bestiary={creatures:[{id:'wolf',name:'Lupo delle Nebbie',ac:13,maxHp:18,initiative:2,conditions:'',notes:'Dettagli riservati al DM'}]};
const archivedActions=[{id:'action-one',round:1,turnId:'wolf-one',source:{type:'environment',name:'Fuoco nella stanza'},targets:[{id:'wolf-one',name:'Lupo',beforeHp:18,afterHp:13}],description:'Le fiamme infliggono 5 danni da fuoco'}];
const extendedRecords=[
 {...record,id:'map-a',kind:'map',title:'Cripta',owner:'dm',editor:'dm',audience:['*'],data:{image:id,images:[],ratio:1.25,widthMiles:.04,parent:'',x:.2,y:.7}},
 {...record,id:'table-a',kind:'table',title:'Presagi',owner:'dm',editor:'dm',audience:['dm'],data:{entries:[{id:'omen-one',text:'Il corvo si posa sulla lapide'}],dice:'1d1'}},
 {...record,id:'combat-a',kind:'combat',title:'Lo scontro nella cripta',owner:'dm',editor:'dm',audience:['*'],links:['map-a'],body:'Una vittoria difficile.',data:{images:[{id,caption:'Il luogo dello scontro'}],log:archivedActions,minutes:1234,session:'journal-a'}}
];
const extendedDm={...dm,records:extendedRecords,uploads:[image],bestiary,dmBoard:{round:2,turnId:'wolf-one',combatants:[{id:'wolf-one',name:'Lupo',initiative:12,ac:13,hp:13,maxHp:18,conditions:'',notes:'Nota privata'}],log:archivedActions}};
await test('Mappe, tabelle, Combat Log e bestiario sopravvivono al trasferimento senza perdere dati',()=>{
 const data=prepareTransfer([extendedDm,player],seeds);
 for(const expected of extendedRecords)assert.deepEqual(data.records.find(r=>r.id===expected.id),expected,'dati e permessi del tipo '+expected.kind);
 assert.deepEqual(data.bestiary,bestiary);
 assert.deepEqual(data.dmBoard,extendedDm.dmBoard,'lo storico dell’incontro ancora attivo rimane completo');
 assert.deepEqual(data.uploads[0].bytes,Buffer.from(image.base64,'base64'));
 assert.throws(()=>prepareTransfer([{...extendedDm,uploads:[]},{...player,uploads:[]}],seeds),/Mancano immagini/,'un Combat Log illustrato non viene importato senza gli allegati');
 assert.throws(()=>prepareTransfer([{...dm,records:[{...record,kind:'unknown'}],uploads:[image]}],seeds),/Pagina non valida/,'la whitelist continua a rifiutare tipi sconosciuti');
});
await test('I backup precedenti funzionano e soltanto il backup DM scelto fornisce il bestiario',()=>{
 assert.deepEqual(prepareTransfer([dm,player],seeds).bestiary,{creatures:[]},'un backup precedente non deve diventare incompatibile');
 const newest={...extendedDm,exportedAt:'2026-09-09',bestiary:{creatures:[{...bestiary.creatures[0],maxHp:27}]}};
 const playerWithFakeBestiary={...player,exportedAt:'2026-09-10',bestiary:{creatures:[{id:'fake',name:'Non deve essere importato'}]}};
 assert.deepEqual(prepareTransfer([newest,extendedDm,playerWithFakeBestiary],seeds).bestiary,newest.bestiary,'contano ruolo DM e data, non l’ordine dei file');
});
await test('PostgreSQL import is transactional, refuses overwrite and denies anonymous table access',async()=>{
 const pg=new PGlite({parsers:{20:Number}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const adapt=db=>({async unsafe(text,values){return (await db.query(text,values)).rows;},async begin(work){return db.transaction(tx=>work(adapt(tx)));}});
 const sql=adapt(pg),data=prepareTransfer([extendedDm,player],seeds);
 // Force a failure after users were inserted; no partial campaign may remain.
 await assert.rejects(()=>writeTransfer(sql,{...data,records:[{...record,owner:'nonexistent'}]}));
 assert.equal((await pg.query('SELECT count(*) n FROM barovia.users')).rows[0].n,0);
 await writeTransfer(sql,data);assert.equal((await pg.query('SELECT audience FROM barovia.records WHERE id=$1',[record.id])).rows[0].audience,'["lyria"]');
 for(const expected of extendedRecords){const saved=(await pg.query('SELECT * FROM barovia.records WHERE id=$1',[expected.id])).rows[0];assert.equal(saved.kind,expected.kind);assert.equal(saved.body,expected.body);assert.deepEqual(JSON.parse(saved.data),expected.data);assert.deepEqual(JSON.parse(saved.audience),expected.audience);assert.deepEqual(JSON.parse(saved.links),expected.links);}
 assert.deepEqual(JSON.parse((await pg.query('SELECT value FROM barovia.settings WHERE id=$1',['bestiary'])).rows[0].value),bestiary);
 assert.deepEqual(JSON.parse((await pg.query('SELECT value FROM barovia.settings WHERE id=$1',['dm-board'])).rows[0].value),extendedDm.dmBoard);
 await assert.rejects(()=>writeTransfer(sql,data),/contiene già dati/);
 await pg.exec('SET ROLE anon');await assert.rejects(()=>pg.query('SELECT * FROM barovia.users'),/permission denied/);await pg.exec('RESET ROLE');
 await pg.close();
});
