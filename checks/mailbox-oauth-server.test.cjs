const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..'),esbuild=require('esbuild');
const bundle=esbuild.buildSync({entryPoints:[path.join(project,'supabase/functions/_shared/mailbox-oauth.ts')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const mod={exports:{}};new Function('module','exports',bundle)(mod,mod.exports);const {mailboxOAuth}=mod.exports;
const tokenBundle=esbuild.buildSync({entryPoints:[path.join(project,'supabase/functions/_shared/mailbox-token-source.ts')],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const tm={exports:{}};new Function('module','exports',tokenBundle)(tm,tm.exports);
const ACTOR='11111111-1111-4111-8111-111111111111',ATTEMPT='22222222-2222-4222-8222-222222222222';let assertions=0;
function check(b){assert.ok(b);assertions++;}
function fixture(mode='success'){
 const stats={http:0,stores:0,claims:0,uncertain:0},db={state:'prepared'},metadata=()=>({state:db.state,...(db.state==='prepared'?{attempt_id:ATTEMPT,expires_at:'2099-01-01T00:00:00Z'}:{})});
 const d={actor:ACTOR,env:n=>({EVENT_MAILBOX_CLIENT_ID:'fixture-client',EVENT_MAILBOX_CLIENT_SECRET:'fixture-secret',...(mode==='envRefresh'?{EVENT_MAILBOX_REFRESH_TOKEN:'fixture-old-refresh'}:{})}[n]),
  caller:async(name,args)=>{
   if(name==='event_mailbox_oauth_status'){if(mode==='statusFailure')return {error:{message:'fixture-private'},data:null};return {data:metadata(),error:null};}
   if(name==='event_mailbox_oauth_prepare'){if(mode==='prepareReject')return {error:{},data:null};db.state='prepared';return {data:{attempt_id:ATTEMPT,expires_at:'2099-01-01T00:00:00Z'},error:null};}
   if(name==='event_mailbox_oauth_claim'){if(mode==='claimReject'||stats.claims||db.state!=='prepared')return {data:null,error:{}};stats.claims++;db.state='claimed';return {data:{claimed:true},error:null};}
   if(name==='event_mailbox_oauth_claim_status')return {data:{active:mode!=='claimExpired'},error:null};
   throw Error('unexpected_fixture_rpc');
  },worker:async(name,args)=>{
   if(name==='event_mailbox_oauth_uncertain'){stats.uncertain++;if(db.state==='claimed')db.state='uncertain';return {data:null,error:null};}
   check(name==='event_mailbox_oauth_store');stats.stores++;
   check(args.target_account==='12345678901234567890'&&args.owner_id===ACTOR&&args.refresh_value==='fixture-refresh');
   if(mode==='storeFailure')return {data:null,error:{message:'fixture-private'}};
   db.state='stored';if(mode==='lostStoreResponse')throw Error('fixture-private');
   return {data:{stored:true},error:null};
  },fetcher:async(url,options)=>{
   stats.http++;check(options.redirect==='error');check(stats.http<=2);
   if(stats.http===1){
    check(url==='https://accounts.zoho.com/oauth/v2/token'&&options.method==='POST');
    check(options.body.get('client_id')==='fixture-client'&&options.body.get('client_secret')==='fixture-secret');
    if(mode==='httpFailure')throw Error('fixture-private-http');
    if(mode==='http401')return new Response('{}',{status:401});
    if(mode==='redirect')return new Response('{}',{status:302,headers:{Location:'https://untrusted.invalid'}});
    if(mode==='malformed')return new Response('not-json');
    if(mode==='missingRefresh')return Response.json({access_token:'fixture-access'});
    if(mode==='tokenError')return Response.json({error:'invalid_code'});
    if(mode==='invalidToken')return Response.json({access_token:'fixture-access',refresh_token:'bad\nINJECT=value'});
    return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',...(mode==='extraScope'?{scope:'ZohoMail.messages.ALL'}:{}),...(mode==='validScopes'?{scope:'ZohoMail.accounts.READ ZohoMail.folders.READ ZohoMail.messages.READ'}:{})});
   }
   check(url==='https://mail.zoho.com/api/accounts'&&options.method==='GET');
   if(mode==='accountFailure')throw Error('fixture-private-account');
   const a={accountId:'12345678901234567890',type:'ZOHO_ACCOUNT',status:true,mailboxStatus:'enabled',incomingBlocked:false,emailAddress:[{mailId:'eventos@embaixadacarioca.com.br',isPrimary:true,isConfirmed:true}]};
   if(mode==='wrongAccount')a.emailAddress[0].mailId='other@example.invalid';
   if(mode==='aliasOnly')a.emailAddress[0].isPrimary=false;
   if(mode==='unconfirmed')a.emailAddress[0].isConfirmed=false;
   if(mode==='blocked')a.incomingBlocked=true;
   if(mode==='conflictingEnabled')a.enabled=false;
   if(mode==='statusString')a.status='true';
   return Response.json({status:{code:200},data:mode==='duplicateAccount'?[a,a]:[a]});
  }};
 return {d,stats,db};
}
function payload(){return {action:'complete',attemptId:ATTEMPT,code:'fixture-code',scopesConfirmed:true};}
(async()=>{
 const modes=['success','validScopes','lostStoreResponse','envRefresh','prepareReject','claimReject','claimExpired','httpFailure','http401','redirect','malformed','missingRefresh','tokenError','invalidToken','extraScope','wrongAccount','aliasOnly','unconfirmed','blocked','conflictingEnabled','statusString','duplicateAccount','accountFailure','storeFailure','statusFailure'];
 for(const mode of modes){const f=fixture(mode),p=payload();if(mode==='prepareReject')p.action='prepare';if(mode==='prepareReject'){delete p.attemptId;delete p.code;delete p.scopesConfirmed;}
  const result=await mailboxOAuth(p,f.d),encoded=JSON.stringify(result);
  check(!/fixture-(secret|access|refresh|code|private)/.test(encoded));check(result.captureActivated===false&&result.retryAllowed!==true);check(p.code===undefined||p.code==='');
  if(['success','validScopes','lostStoreResponse'].includes(mode)){check(result.ok===true&&result.connected===true&&f.stats.http===2&&f.stats.stores===1);}else{check(result.ok===false);}
  if(['envRefresh','prepareReject','claimReject'].includes(mode))check(f.stats.http===0&&f.stats.stores===0);
  if(mode==='claimExpired')check(f.stats.http===1&&f.stats.stores===0);
  if(!['success','validScopes','lostStoreResponse','storeFailure','statusFailure'].includes(mode))check(f.stats.stores===0);
 }
 const invalids=[null,{},[],{...payload(),extra:true},{...payload(),scopesConfirmed:false},{...payload(),attemptId:'wrong'},{...payload(),code:'bad\nvalue'}];
 for(const p of invalids){const f=fixture(),r=await mailboxOAuth(p,f.d);check(r.ok===false&&f.stats.http===0&&f.stats.stores===0);}
 const f=fixture(),p1=payload(),p2=payload();const both=await Promise.all([mailboxOAuth(p1,f.d),mailboxOAuth(p2,f.d)]);check(both.filter(x=>x.ok).length===1&&f.stats.http===2&&f.stats.stores===1);
 for(const state of ['absent','prepared','claimed','stored','uncertain','expired']){const f=fixture();f.db.state=state;const r=await mailboxOAuth({action:'status'},f.d);check(r.ok===true&&r.state===state&&f.stats.http===0&&f.stats.stores===0);}
 let calls=0;const env=n=>n==='EVENT_MAILBOX_REFRESH_TOKEN'?'fixture-legacy':undefined;
 const absentWorker={rpc:async()=>{calls++;return {data:{available:false},error:null}}};check((await tm.exports.mailboxTokenEnvironment(absentWorker,'123',env))('EVENT_MAILBOX_REFRESH_TOKEN')==='fixture-legacy');
 const vaultWorker={rpc:async()=>({data:{available:true,refresh_token:'fixture-vault'},error:null})};check((await tm.exports.mailboxTokenEnvironment(vaultWorker,'123',()=>undefined))('EVENT_MAILBOX_REFRESH_TOKEN')==='fixture-vault');
 await assert.rejects(()=>tm.exports.mailboxTokenEnvironment(vaultWorker,'123',env),/source_conflict/);assertions++;
 await assert.rejects(()=>tm.exports.mailboxTokenEnvironment({rpc:async()=>({error:{},data:null})},'123',env),/credential_unavailable/);assertions++;
 const noAccount=await tm.exports.mailboxTokenEnvironment({rpc:async()=>{throw Error('must_not_call')}},null,env);check(noAccount===env);
 const report={ok:true,coreModes:modes.length,invalidRequests:invalids.length,concurrency:true,statusStates:6,tokenSourceChecks:5,assertions,realProviderCalls:0,productionWrites:0};
 console.log(JSON.stringify(report));
})().catch(e=>{console.error('SYNTHETIC_TEST_FAILED',e.name,e.message);process.exitCode=1;});
