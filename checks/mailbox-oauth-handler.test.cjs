const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs');const project=path.resolve(__dirname,'..'),esbuild=require('esbuild');
const bundle=esbuild.buildSync({entryPoints:[path.join(project,'supabase/functions/event-mailbox-connect/index.ts')],bundle:true,platform:'node',format:'cjs',write:false,external:['https://esm.sh/*']}).outputFiles[0].text;
let checks=0;
(async()=>{
 const modes=['originMissing','originWrong','options','method','sessionError','unconfirmedEmail','roleFalse','teamFalse','malformed','oversized','invalidAction','prepare'];
 for(const mode of modes){let handler,providerCalls=0,authCalls=0;const actor='11111111-1111-4111-8111-111111111111';
  const caller={auth:{getUser:async()=>{authCalls++;return {error:mode==='sessionError'?{}:null,data:{user:{id:actor,email_confirmed_at:mode==='unconfirmedEmail'?null:'2026-01-01T00:00:00Z'}}}}},rpc:async name=>{if(name==='is_super_admin')return {data:mode!=='roleFalse',error:null};if(name==='is_team_member')return {data:mode!=='teamFalse',error:null};if(name==='event_mailbox_oauth_prepare')return {data:{attempt_id:'22222222-2222-4222-8222-222222222222',expires_at:'2099-01-01T00:00:00Z'},error:null};throw Error('fixture_unexpected_rpc')}};
  const sdk={createClient:(url,key,options)=>options.global?caller:{rpc:async()=>{throw Error('unexpected_worker')}}};
  const deno={env:{get:k=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-private',EVENT_MAILBOX_CLIENT_ID:'fixture-id',EVENT_MAILBOX_CLIENT_SECRET:'fixture-secret'}[k])},serve:fn=>{handler=fn}};
  const mod={exports:{}};new Function('module','exports','require','Deno',bundle)(mod,mod.exports,name=>{assert.equal(name,'https://esm.sh/@supabase/supabase-js@2.57.4');return sdk},deno);
  const headers={'Origin':'https://leorangel22.github.io','Content-Type':'application/json','Authorization':'Bearer fixture-session'};if(mode==='originMissing')delete headers.Origin;if(mode==='originWrong')headers.Origin='https://untrusted.invalid';
  const method=mode==='method'?'GET':mode==='options'?'OPTIONS':'POST';
  const body=mode==='malformed'?'not-json':mode==='oversized'?'x'.repeat(12289):JSON.stringify({action:mode==='invalidAction'?'unknown':'prepare'});
  const previous=global.fetch;global.fetch=async()=>{providerCalls++;throw Error('fixture_provider_network_forbidden')};
  let response;try{response=await handler(new Request('https://fixture.invalid/functions/v1/event-mailbox-connect',{method,headers,...(method==='POST'?{body}:{})}));}finally{global.fetch=previous}
  const expected={originMissing:403,originWrong:403,options:200,method:405,sessionError:401,unconfirmedEmail:401,roleFalse:403,teamFalse:403,malformed:400,oversized:400,invalidAction:409,prepare:200}[mode];
  assert.equal(response.status,expected,mode);checks++;assert.equal(providerCalls,0);checks++;
  if(mode==='options')continue;
  const result=await response.json();assert.ok(!/fixture-(secret|private|session)/.test(JSON.stringify(result)));checks++;
  if(['originMissing','originWrong','method'].includes(mode)){assert.equal(authCalls,0);checks++;}
  if(mode==='prepare'){assert.equal(result.state,'prepared');assert.equal(result.captureActivated,false);checks+=2;}
 }
 const report={ok:true,cases:modes.length,assertions:checks,realProviderCalls:0,productionWrites:0,gatewayJWT:'config verified separately; gateway not exercised locally'};console.log(JSON.stringify(report));
})().catch(e=>{console.error('HANDLER_FIXTURE_FAILED',e.message);process.exitCode=1});
