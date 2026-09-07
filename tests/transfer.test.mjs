import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
await test('PostgreSQL import is transactional, refuses overwrite and denies anonymous table access',async()=>{
 const pg=new PGlite({parsers:{20:Number}});
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
 await pg.exec(await readFile('supabase/migrations/0001_barovia.sql','utf8'));
 const adapt=db=>({async unsafe(text,values){return (await db.query(text,values)).rows;},async begin(work){return db.transaction(tx=>work(adapt(tx)));}});
 const sql=adapt(pg),data=prepareTransfer([dm,player],seeds);
 // Force a failure after users were inserted; no partial campaign may remain.
 await assert.rejects(()=>writeTransfer(sql,{...data,records:[{...record,owner:'nonexistent'}]}));
 assert.equal((await pg.query('SELECT count(*) n FROM barovia.users')).rows[0].n,0);
 await writeTransfer(sql,data);assert.equal((await pg.query('SELECT audience FROM barovia.records')).rows[0].audience,'["lyria"]');
 await assert.rejects(()=>writeTransfer(sql,data),/contiene già dati/);
 await pg.exec('SET ROLE anon');await assert.rejects(()=>pg.query('SELECT * FROM barovia.users'),/permission denied/);await pg.exec('RESET ROLE');
 await pg.close();
});
