import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
import {PostgresDatabase,type QueryExecutor} from './postgres';
import type {Bindings,ObjectBucket} from '../lib/server';

export function createPostgresExecutor(connectionString:string,ca?:string):QueryExecutor {
 const sql=postgres(connectionString,{prepare:false,max:2,idle_timeout:20,connect_timeout:10,ssl:{rejectUnauthorized:true,...(ca?{ca:ca.replaceAll('\\n','\n')}:{})},types:{bigint:{to:20,from:[20],serialize:(n:number)=>String(n),parse:(s:string)=>Number(s)}}});
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
