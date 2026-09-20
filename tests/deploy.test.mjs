import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['netlify/functions/campaign.ts'],bundle:true,packages:'external',platform:'node',format:'esm',outfile:'.sites-runtime/tests/deploy.mjs'});
const {default:campaign}=await import(resolve('.sites-runtime/tests/deploy.mjs'));
const request=(path,data)=>new Request('https://preview.example'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
await test('Netlify runtime deploy metadata protects preview writes without a CONTEXT environment variable',async()=>{
 const oldContext=process.env.CONTEXT,oldAllow=process.env.BAROVIA_ALLOW_PREVIEW_WRITES;
 delete process.env.CONTEXT;delete process.env.BAROVIA_ALLOW_PREVIEW_WRITES;
 try{for(const context of ['branch-deploy','deploy-preview','preview-server']){
  const result=await campaign(request('/api/records',{title:'Should not write'}),{deploy:{context},ip:'203.0.113.1'});
  assert.equal(result.status,403);assert.match((await result.json()).error,/sola lettura/);
 }}finally{if(oldContext===undefined)delete process.env.CONTEXT;else process.env.CONTEXT=oldContext;if(oldAllow===undefined)delete process.env.BAROVIA_ALLOW_PREVIEW_WRITES;else process.env.BAROVIA_ALLOW_PREVIEW_WRITES=oldAllow;}
});
await test('Preview authentication does not allow credential changes or malformed actions',async()=>{
 const old=process.env.BAROVIA_ALLOW_PREVIEW_WRITES;delete process.env.BAROVIA_ALLOW_PREVIEW_WRITES;
 try{for(const action of ['change','reset','create',''])assert.equal((await campaign(request('/api/auth',{action}),{deploy:{context:'deploy-preview'}})).status,403);}
 finally{if(old===undefined)delete process.env.BAROVIA_ALLOW_PREVIEW_WRITES;else process.env.BAROVIA_ALLOW_PREVIEW_WRITES=old;}
});
