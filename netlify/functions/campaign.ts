import postgres from 'postgres';
import {handleCampaign} from '../../lib/server';
import {createStorageBucket,databaseTlsOptions} from '../../adapters/supabase';
import {PostgresDatabase,type QueryExecutor} from '../../adapters/postgres';

// A Netlify invocation may be frozen after returning. Keep PostgreSQL sockets
// within the request lifetime so a later invocation cannot reuse a stale pool.
export default async function campaign(request:Request,context:{ip?:string}){
 let pool:{end:(options:{timeout:number})=>Promise<void>}|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let phase='configurazione';
 const required=(name:string)=>{const value=process.env[name];if(!value?.trim())throw new Error('Variabile mancante: '+name);return value;};
 try{
  const bucket=createStorageBucket(required('SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),process.env.SUPABASE_STORAGE_BUCKET||'barovia-media');
  const sql=postgres(required('DATABASE_URL'),{
   prepare:false,max:1,fetch_types:false,idle_timeout:1,connect_timeout:8,
   ssl:databaseTlsOptions(process.env.DATABASE_CA_CERT),
   types:{bigint:{to:20,from:[20],serialize:(n:number)=>String(n),parse:(s:string)=>Number(s)}}
  });
  pool=sql;
  const executor=(connection:any):QueryExecutor=>({
   async query(text,values){
    const label=(text.match(/^\s*(\w+)/)?.[1]||'QUERY')+' '+(text.match(/\bbarovia\.\w+/)?.[0]||'database');
    phase=label;
    const r=await connection.unsafe(text,values);
    phase='applicazione dopo '+label;
    return {rows:Array.from(r),changes:r.count??r.length};
   },
   async transaction(work){
    phase='BEGIN';
    const result=await connection.begin(async(tx:any)=>{
     const value=await work(executor(tx));phase='COMMIT';return value;
    });
    phase='applicazione dopo COMMIT';return result;
   }
  });
  const bindings={DB:new PostgresDatabase(executor(sql)),BUCKET:bucket};
  // Always overwrite this header with the provider-verified client address.
  // An internet visitor must not be able to forge the login rate-limit key.
  const headers=new Headers(request.headers);
  headers.set('cf-connecting-ip',context.ip||'unknown');
  console.info('Campaign v3: richiesta con connessione dedicata');
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Timeout dopo 20 secondi: '+phase)),20000);});
  const response=await Promise.race([handleCampaign(new Request(request,{headers}),bindings),deadline]);
  console.info('Campaign v3: risposta HTTP '+response.status);
  return response;
 }catch(error){
  console.error('Campaign v3 failed:',error instanceof Error?error.message:'Errore interno');
  return Response.json({error:'La campagna non è disponibile. Il DM deve verificare la configurazione del sito.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }finally{
  if(timer)clearTimeout(timer);
  // Cleanup is awaited before returning; no background timer or socket is
  // relied upon after the invocation finishes. A stuck connection is closed.
  if(pool)await pool.end({timeout:1}).catch(()=>{console.error('Campaign v3: chiusura connessione non completata');});
 }
}
export const config={path:'/api/*'};
