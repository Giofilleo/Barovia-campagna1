import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
import {X509Certificate} from 'node:crypto';
import type {ConnectionOptions} from 'node:tls';
import {PostgresDatabase,type QueryExecutor} from './postgres';
import type {Bindings,ObjectBucket} from '../lib/server';

// A dashboard's single-line field can remove PEM line breaks on paste. Node
// silently ignores that malformed CA and reports SELF_SIGNED_CERT_IN_CHAIN.
// Parse the certificate bytes and rebuild PEM before giving it to TLS.
export function normalizeDatabaseCertificate(value?:string):string|undefined {
 if(!value?.trim())return undefined;
 let input=value.trim();
 if((input.startsWith('"')&&input.endsWith('"'))||(input.startsWith("'")&&input.endsWith("'")))input=input.slice(1,-1);
 input=input.replace(/\\r\\n|\\n|\\r/g,'\n');
 const pattern=/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;
 const blocks=Array.from(input.matchAll(pattern));
 const invalid=()=>new Error('DATABASE_CA_CERT non contiene un certificato PEM valido. Incolla il contenuto completo del file .crt, comprese le righe BEGIN CERTIFICATE e END CERTIFICATE.');
 if(input.length>131072||!blocks.length||input.replace(pattern,'').trim())throw invalid();
 return blocks.map(block=>{
  const base64=block[1].replace(/\s/g,'');
  if(!base64||base64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw invalid();
  try{
   const bytes=Buffer.from(base64,'base64');
   const certificate=new X509Certificate(bytes);
   if(!certificate.raw.equals(bytes))throw invalid();
   return certificate.toString().trim()+'\n';
  }catch{throw invalid();}
 }).join('');
}
export function databaseTlsOptions(value?:string):ConnectionOptions {
 const ca=normalizeDatabaseCertificate(value);
 return {rejectUnauthorized:true,...(ca?{ca}:{})};
}

export function createPostgresExecutor(connectionString:string,ca?:string):QueryExecutor {
 let ssl:ConnectionOptions;
 try{ssl=databaseTlsOptions(ca);}catch(error){console.error('Campaign TLS v2:',error instanceof Error?error.message:'Certificato non valido');throw error;}
 console.info('Campaign TLS v2: '+(ssl.ca?'certificato caricato e formato PEM verificato':'DATABASE_CA_CERT assente nella funzione; verificare valore, ambito Functions e nuova pubblicazione'));
 const sql=postgres(connectionString,{prepare:false,max:2,idle_timeout:20,connect_timeout:10,ssl,types:{bigint:{to:20,from:[20],serialize:(n:number)=>String(n),parse:(s:string)=>Number(s)}}});
 const executor=(connection:any):QueryExecutor=>({
  async query(text,values){const r=await connection.unsafe(text,values);return{rows:Array.from(r),changes:r.count??r.length};},
  async transaction(work){return connection.begin((tx:any)=>work(executor(tx)));}
 });
 return executor(sql);
}
export function createStorageBucket(url:string,key:string,bucketName='barovia-media'):ObjectBucket {
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const bucket=client.storage.from(bucketName);
 return {
  async put(id,bytes,options){const {error}=await bucket.upload(id,bytes,{contentType:options.httpMetadata.contentType,upsert:false});if(error)throw new Error('Unable to store campaign image');},
  async get(id){const {data,error}=await bucket.download(id);if(error){if('status' in error&&['404','400'].includes(String(error.status)))return null;throw new Error('Unable to read campaign image');}return data?{body:data.stream()}:null;},
  async delete(id){const {error}=await bucket.remove([id]);if(error)throw new Error('Unable to remove campaign image');}
 };
}
export function createSupabaseBindings(values:Record<string,string|undefined>):Bindings {
 const required=(name:string)=>{const value=values[name];if(!value)throw new Error('Missing server configuration: '+name);return value;};
 return {DB:new PostgresDatabase(createPostgresExecutor(required('DATABASE_URL'),values.DATABASE_CA_CERT)),BUCKET:createStorageBucket(required('SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),values.SUPABASE_STORAGE_BUCKET||'barovia-media')};
}
