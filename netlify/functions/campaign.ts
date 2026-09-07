import {handleCampaign,type Bindings} from '../../lib/server';
import {createSupabaseBindings} from '../../adapters/supabase';
let bindings:Bindings|undefined;
export default async function campaign(request:Request,context:{ip?:string}){
 try{
  bindings??=createSupabaseBindings(process.env);
  // Always overwrite this header with the provider-verified client address.
  // An internet visitor must not be able to forge the login rate-limit key.
  const headers=new Headers(request.headers);
  headers.set('cf-connecting-ip',context.ip||'unknown');
  return await handleCampaign(new Request(request,{headers}),bindings);
 }catch{
  console.error('Campaign server configuration or connection unavailable');
  return Response.json({error:'La campagna non è disponibile. Il DM deve verificare la configurazione del sito.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
export const config={path:'/api/*'};
