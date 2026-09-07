import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
import {prepareTransfer,writeTransfer} from './transfer-data.mjs';
const args=process.argv.slice(2),apply=args.includes('--apply'),allowPartial=args.includes('--allow-partial');
const paths=args.filter(a=>!a.startsWith('--'));
let sql;
try{
 const source=await readFile(new URL('../lib/account-seed.ts',import.meta.url),'utf8');
 const seeds=JSON.parse(source.slice(source.indexOf('['),source.lastIndexOf(']')+1));
 const data=prepareTransfer(await Promise.all(paths.map(async p=>JSON.parse(await readFile(p,'utf8')))),seeds);
 console.log(`Pronto: ${data.accounts.length} account, ${data.records.length} pagine, ${data.uploads.length} immagini.`);
 if(data.missingExports.length)console.log('Esportazioni mancanti: '+data.missingExports.join(', ')+'. Eventuali appunti privati di questi utenti non sono inclusi.');
 if(!apply){console.log('Solo verifica. Aggiungi --apply per importare nel progetto Supabase configurato.');process.exitCode=0;}
 else{
  if(data.missingExports.length&&!allowPartial)throw new Error('Raccogli le esportazioni mancanti o scegli esplicitamente --allow-partial.');
  for(const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'])if(!process.env[key])throw new Error('Manca la variabile '+key);
  sql=postgres(process.env.DATABASE_URL,{prepare:false,max:1,connect_timeout:10,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT.replaceAll('\\n','\n')}:{})}});
  const count=await sql.unsafe('SELECT (SELECT count(*) FROM barovia.users)+(SELECT count(*) FROM barovia.records)+(SELECT count(*) FROM barovia.settings)+(SELECT count(*) FROM barovia.uploads) AS n');
  if(Number(count[0].n)!==0)throw new Error('Database non vuoto: importazione interrotta, nessun dato sovrascritto.');
  const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const bucket=client.storage.from(process.env.SUPABASE_STORAGE_BUCKET||'barovia-media');
  // The bucket is private. Upload first, then commit metadata in one transaction.
  // Existing identical objects from a interrupted attempt are safe to reuse.
  for(const image of data.uploads){
   const {data:old,error:readError}=await bucket.download(image.id);
   if(old){if(!Buffer.from(await old.arrayBuffer()).equals(image.bytes))throw new Error('Immagine esistente differente: importazione interrotta.');continue;}
   if(readError&&!['400','404'].includes(String(readError.status)))throw new Error('Impossibile verificare le immagini già presenti.');
   const {error}=await bucket.upload(image.id,image.bytes,{contentType:image.mime,upsert:false});if(error)throw new Error('Caricamento immagine non riuscito. Puoi ripetere l’importazione dopo aver verificato Storage.');
  }
  await writeTransfer(sql,data);
  console.log('Importazione completata. I sette account iniziali usano le chiavi iniziali; gli account aggiuntivi richiedono attivazione e nuova chiave dal DM. Le vecchie sessioni non vengono trasferite.');
 }
}catch(e){console.error(e instanceof Error?e.message:'Importazione non riuscita.');process.exitCode=1;}
finally{if(sql)await sql.end({timeout:5});}
