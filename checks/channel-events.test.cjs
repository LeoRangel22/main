const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=file=>stripTypeScriptTypes(fs.readFileSync(`${__dirname}/../supabase/functions/${file}`,'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''));
const context=vm.createContext({TextEncoder,TextDecoder,URLSearchParams,Date,crypto:require('node:crypto').webcrypto,btoa,Uint8Array});
vm.runInContext(source('_shared/channel-events.ts'),context);
const funcs=vm.runInContext('({hmac,verifySignature,normalizeZapi,normalizeZepto,normalizeMailbox,decodeWebhook})',context);
const incoming={instanceId:'instance',type:'ReceivedCallback',messageId:'m',phone:'5521999999999',fromMe:false,momment:Date.now(),text:{message:'Podemos ajustar?'}};
test('WhatsApp normaliza mensagem sem transformar recebimento em entrega',()=>{const [e]=funcs.normalizeZapi(incoming,'instance');assert.equal(e.kind,'inbound');assert.equal(e.body,'Podemos ajustar?');assert.equal(e.signal,undefined);});
for(const flag of ['fromMe','isGroup','isNewsletter','isEdit','waitingMessage','isStatusReply'])test(`WhatsApp ignora ${flag}`,()=>assert.equal(funcs.normalizeZapi({...incoming,[flag]:true},'instance').length,0));
test('WhatsApp recusa outra instância e timestamp futuro',()=>{assert.throws(()=>funcs.normalizeZapi(incoming,'other'));assert.throws(()=>funcs.normalizeZapi({...incoming,momment:Date.now()+3600000},'instance'));});
for(const [status,signal] of [['SENT','accepted'],['RECEIVED','delivered'],['READ','read']])test(`WhatsApp ${status} preserva semântica`,()=>{const e=funcs.normalizeZapi({...incoming,type:'MessageStatusCallback',status,ids:['a','b']},'instance');assert.equal(e.length,2);assert.equal(e[0].signal,signal);});
test('READ_BY_ME não informa leitura pelo cliente',()=>assert.equal(funcs.normalizeZapi({...incoming,type:'MessageStatusCallback',status:'READ_BY_ME',ids:['a']},'instance').length,0));
const zepto=(signal='email_open',to=['customer@example.test'])=>({mailagent_key:'agent',webhook_request_id:'callback',event_message:[{request_id:'request',email_info:{client_reference:'EV:00000000-0000-4000-8000-000000000001:2',to:to.map(address=>({email_address:{address}}))},event_data:[{object:signal,details:[{time:new Date().toISOString()}]}]}]});
test('Zepto abertura não vira entrega/leitura',()=>{const [e]=funcs.normalizeZepto(zepto(),'agent');assert.equal(e.signal,'opened');assert.equal(e.send_attempt,2);assert.equal(e.send_id,'00000000-0000-4000-8000-000000000001');});
test('Zepto recusa outro agente',()=>assert.throws(()=>funcs.normalizeZepto(zepto(),'other')));
test('Zepto não aplica abertura a todos os destinatários de lote',()=>assert.equal(funcs.normalizeZepto(zepto('email_open',['a@example.test','b@example.test']),'agent').length,0));
test('Zepto devolução afeta somente bounced_recipient',()=>{const p=zepto('hardbounce',['a@example.test','b@example.test']);p.event_message[0].event_data[0].details[0].bounced_recipient='b@example.test';const [e]=funcs.normalizeZepto(p,'agent');assert.equal(e.destination,'b@example.test');assert.equal(e.signal,'failed');});
test('Assinatura verifica corpo exato e freshness; form preserva +',async()=>{const value=JSON.stringify({text:'a+b & ç'}),secret='s'.repeat(32);const signature=await funcs.hmac(secret,value);const header=`ts=${Date.now()};s=${encodeURIComponent(signature)};s-algorithm=HmacSHA256`;assert.equal(await funcs.verifySignature(header,secret,value),true);assert.equal(await funcs.verifySignature(header,secret,value+' '),false);assert.equal(await funcs.verifySignature(header,secret,value,Date.now()+660000),false);const encoded=new URLSearchParams({data:value}).toString();assert.equal(funcs.decodeWebhook(encoded,'application/x-www-form-urlencoded'),value);});
test('Caixa de e-mail exige conta exata e texto; preserva threading',()=>{const p={mailbox:'events',kind:'inbound',message_id:'message',in_reply_to:'provider',from:'CUSTOMER@example.test',text:'Resposta',received_at:new Date().toISOString()};assert.equal(funcs.normalizeMailbox(p,'events')[0].reply_to_id,'provider');assert.throws(()=>funcs.normalizeMailbox(p,'other'));});

const bridgeScope='00000000-0000-4000-8000-000000000001';
const otherBridgeScope='00000000-0000-4000-8000-000000000002';
const bridgeCursor=(sequence,scope=bridgeScope)=>`v2:embaixada_urca:${scope}:${sequence}`;
const bridgeSandbox={URL,Date,AbortSignal,fetch:async()=>new Response('{}')};
const bridgeContext=vm.createContext(bridgeSandbox);
for(const file of ['_shared/bot-dispatch.ts','_shared/bot-bridge.ts'])vm.runInContext(source(file),bridgeContext);
const bridgeFuncs=vm.runInContext('({botBridgeUrl,fetchBotBridge,normalizeBotBridgeResult,scopedBotCursor})',bridgeContext);
const bridgePayload=(overrides={})=>({ok:true,version:2,account:'bot:embaixada_urca',scope:bridgeScope,nextCursor:bridgeCursor(8),hasMore:false,events:[{send_id:bridgeScope,context_id:otherBridgeScope,revision:3,purpose:'event_proposal',key:'m1',channel:'whatsapp',kind:'inbound',message_id:'m1',reply_to_id:'authorized-outbound',destination:'5521999999999',body:'Olá',captured_at:new Date().toISOString(),occurred_at:new Date().toISOString()}],...overrides});
test('Ponte do Bot aceita somente URL limpa HTTPS do Apps Script',()=>{
 assert.equal(new URL(bridgeFuncs.botBridgeUrl('https://script.google.com/macros/s/deployment/exec')).hostname,'script.google.com');
 for(const url of ['https://example.test/macros/s/deployment/exec','http://script.google.com/macros/s/deployment/exec','https://script.google.com/macros/s/deployment/exec?token=leak','https://user:password@script.google.com/macros/s/deployment/exec'])assert.throws(()=>bridgeFuncs.botBridgeUrl(url));
});
test('Ponte do Bot envia segredo somente no POST e fixa tenant no contrato v2',async()=>{
 let request;
 bridgeSandbox.fetch=async(url,options)=>{request={url,options};return new Response(JSON.stringify({ok:true}));};
 await bridgeFuncs.fetchBotBridge('https://script.google.com/macros/s/deployment/exec','s'.repeat(32),{probe:1,scope:bridgeScope,tenant:'other'});
 const payload=JSON.parse(request.options.body);
 assert.equal(new URL(request.url).search,'');
 assert.equal(payload.s,'s'.repeat(32));
 assert.equal(payload.events_bridge,1);
 assert.equal(payload.version,2);
 assert.equal(payload.tenant,'embaixada_urca');
 assert.equal(payload.scope,bridgeScope);
 assert.equal(request.options.method,'POST');
 assert.equal(request.options.redirect,'manual');
 await assert.rejects(()=>bridgeFuncs.fetchBotBridge(request.url,'short',{probe:1,scope:bridgeScope}));
});
test('Ponte do Bot segue Apps Script por GET sem reenviar segredo e recusa origem inesperada',async()=>{
 const requests=[];
 bridgeSandbox.fetch=async(url,options)=>{requests.push({url,options});return requests.length===1?new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/macros/echo?result=1'}}):new Response(JSON.stringify({ok:true}));};
 await bridgeFuncs.fetchBotBridge('https://script.google.com/macros/s/deployment/exec','s'.repeat(32),{probe:1,scope:bridgeScope});
 assert.equal(requests.length,2);
 assert.equal(requests[1].options.method,'GET');
 assert.equal(requests[1].options.body,undefined);
 assert.equal(requests[1].options.headers,undefined);
 for(const location of ['https://evil.example.test/result','http://script.googleusercontent.com/result','https://user:password@script.googleusercontent.com/result']){
  let fetches=0;
  bridgeSandbox.fetch=async()=>{fetches++;return new Response(null,{status:302,headers:{location}});};
  await assert.rejects(()=>bridgeFuncs.fetchBotBridge('https://script.google.com/macros/s/deployment/exec','s'.repeat(32),{probe:1,scope:bridgeScope}));
  assert.equal(fetches,1);
 }
});
test('Ponte do Bot valida conta, cursor e respostas correlacionadas antes de persistir',()=>{
 const result=bridgeFuncs.normalizeBotBridgeResult(bridgePayload(),7,bridgeScope);
 assert.equal(result.account,'bot:embaixada_urca');
 assert.equal(result.scope,bridgeScope);
 assert.equal(result.nextCursor,8);
 assert.equal(result.events[0].kind,'inbound');
 assert.equal(result.events[0].reply_to_id,'authorized-outbound');
 assert.equal(bridgeFuncs.scopedBotCursor(bridgeScope,7),bridgeCursor(7));
 assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(bridgePayload({nextCursor:bridgeCursor(6)}),7,bridgeScope));
 assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(bridgePayload({account:'zapi:instance'}),7,bridgeScope));
 assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(bridgePayload({events:[{...bridgePayload().events[0],destination:'123'}]}),7,bridgeScope));
});
for(const [label,overrides] of [
 ['versão v1',{version:1}],
 ['cursor numérico',{nextCursor:8}],
 ['cursor numérico em texto',{nextCursor:'8'}],
 ['outro escopo',{scope:otherBridgeScope,nextCursor:bridgeCursor(8,otherBridgeScope)}],
 ['cursor de outro escopo',{nextCursor:bridgeCursor(8,otherBridgeScope)}],
 ['cursor de outro tenant',{nextCursor:`v2:other:${bridgeScope}:8`}],
 ['cursor v1',{nextCursor:`v1:embaixada_urca:${bridgeScope}:8`}],
 ['sequência com zero à esquerda',{nextCursor:bridgeCursor('08')}],
 ['sequência fora de precisão',{nextCursor:bridgeCursor('9007199254740992')}],
 ['resposta sem correlação',{events:[{...bridgePayload().events[0],reply_to_id:undefined}]}]
])test(`Ponte do Bot recusa ${label}`,()=>assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(bridgePayload(overrides),7,bridgeScope)));
test('Ponte do Bot recusa escopo ausente e UUID inválido',()=>{
 for(const scope of ['', 'embaixada_urca', 'invalid-scope'])assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(bridgePayload(),7,scope));
 for(const sequence of [-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>bridgeFuncs.scopedBotCursor(bridgeScope,sequence));
});

async function receiver({provider='mailbox',enabled=true,secret='k'.repeat(32),body={mailbox:'events',kind:'inbound',message_id:'reply',in_reply_to:'provider',from:'client@example.test',text:'Reply',received_at:new Date().toISOString()},wrongKey=false,badSignature=false,failWrite=false}={}){
 let handler;const calls=[];const value=JSON.stringify(body);
 const client={rpc:async(name,args)=>{if(name==='event_channel_worker_config')return{data:{enabled,secret,expected_account:provider==='zapi'?'instance':provider==='zepto'?'agent':'events'}};calls.push(args);return failWrite?{error:{message:'db'}}:{};}};
 const c=vm.createContext({Request,Response,URL,TextEncoder,TextDecoder,URLSearchParams,Date,crypto:require('node:crypto').webcrypto,btoa,Uint8Array,createClient:()=>client,Deno:{env:{get:key=>key==='ZAPI_INSTANCE_ID'?'instance':'key'},serve:fn=>handler=fn}});
 vm.runInContext(source('_shared/channel-events.ts'),c);vm.runInContext(source('event-channel-webhook/index.ts'),c);
 const signature=await funcs.hmac(secret,value),headers={'Content-Type':'application/json','producer-signature':`ts=${Date.now()};s=${encodeURIComponent(badSignature?'bad':signature)};s-algorithm=HmacSHA256`};
 const res=await handler(new Request(`https://example.test/webhook?provider=${provider}&key=${wrongKey?'wrong':secret}`,{method:'POST',headers,body:value}));return{status:res.status,calls};
}
test('Endpoint: assinatura errada não escreve',async()=>{const r=await receiver({badSignature:true});assert.equal(r.status,401);assert.equal(r.calls.length,0);});
test('Endpoint: canal não ativado não escreve',async()=>{const r=await receiver({enabled:false});assert.equal(r.status,503);assert.equal(r.calls.length,0);});
test('Endpoint: HMAC errado não escreve',async()=>{const r=await receiver({provider:'zepto',body:zepto(),badSignature:true});assert.equal(r.status,401);assert.equal(r.calls.length,0);});
test('Endpoint: mensagem autenticada chega ao ledger',async()=>{const r=await receiver();assert.equal(r.status,200);assert.equal(r.calls[0].events[0].kind,'inbound');});
test('Endpoint: indisponibilidade do banco pede retry ao provedor',async()=>assert.equal((await receiver({failWrite:true})).status,503));
test('Endpoint: callback WhatsApp legado nunca contorna escopo Bot, mesmo com chave correta',async()=>{for(const wrongKey of [true,false]){const r=await receiver({provider:'zapi',body:incoming,wrongKey});assert.equal(r.status,409);assert.equal(r.calls.length,0);}});

async function admin(action,{team=true,manager=true,conflict=false,approved=true,instanceId='value',scopeId=bridgeScope,configuredScope=bridgeScope,configFailure=false,enableFailure=false,callbacks=true,bridgeResponse={}}={}){
 let handler;const requests=[],rpcCalls=[];
 const currentCallback=conflict?'https://bot.example.test/hook':action==='activate-bot-bridge'&&callbacks?'https://script.google.com/macros/s/deployment/exec?s=private':'';
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async(name,args)=>{
  rpcCalls.push({name,args});
  if(name==='event_bot_bridge_activate'&&enableFailure)return{error:{message:'db'}};
  if(name==='is_team_member')return{data:team};
  if(name==='is_super_admin')return{data:manager};
  if(name==='event_channel_worker_config')return{data:{secret:'key'}};
  if(name==='event_bot_bridge_worker_config')return configFailure?{error:{message:'db'}}:{data:{scope_id:configuredScope}};
  return{};
 }};
 const env={SUPABASE_URL:'https://example.test',EVENT_BOT_BRIDGE_URL:'https://script.google.com/macros/s/deployment/exec',EVENT_BOT_BRIDGE_SECRET:'s'.repeat(40),ZAPI_INSTANCE_ID:'value',ZAPI_TOKEN:'value',ZAPI_CLIENT_TOKEN:'value'};
 const c=vm.createContext({Request,Response,URL,URLSearchParams,Date,AbortSignal,createClient:()=>client,Deno:{env:{get:key=>env[key]},serve:fn=>handler=fn},fetch:async(url,options={})=>{
  requests.push({url,options});
  if(String(url).startsWith('https://script.google.com/'))return new Response(JSON.stringify(bridgePayload({nextCursor:bridgeCursor(12),events:[],...bridgeResponse})));
  return new Response(JSON.stringify({connected:true,receivedCallbackUrl:currentCallback,messageStatusCallbackUrl:currentCallback}),{status:200});
 }});
 for(const file of ['_shared/email-delivery.ts','_shared/bot-dispatch.ts','_shared/bot-bridge.ts','event-channel-admin/index.ts'])vm.runInContext(source(file),c);
 const res=await handler(new Request('https://example.test/admin',{method:'POST',body:JSON.stringify({action,approved,instanceId,scopeId})}));
 return{status:res.status,body:await res.json(),fetchCount:requests.length,requests,rpcCalls,rpcNames:rpcCalls.map(call=>call.name)};
}
test('Admin: usuário fora da equipe não consulta provedores',async()=>{const r=await admin('inspect-zapi',{team:false});assert.equal(r.status,403);assert.equal(r.fetchCount,0);});
test('Admin: vendedor não configura callbacks',async()=>{const r=await admin('activate-zapi',{manager:false});assert.equal(r.status,403);assert.equal(r.fetchCount,0);});
for(const [label,options] of [['configuração disponível',{}],['callback do Bot existente',{conflict:true}],['sem aprovação',{approved:false}],['outra instância',{instanceId:'other'}],['falha de ativação simulada',{enableFailure:true}]])test(`Admin: activate-zapi desativado sem acesso externo (${label})`,async()=>{
 const r=await admin('activate-zapi',options);
 assert.equal(r.status,409);
 assert.equal(r.fetchCount,0);
 assert.equal(r.rpcNames.includes('event_zapi_direct_activate'),false);
 assert.equal(r.rpcNames.includes('configure_event_channel'),false);
 assert.equal(r.rpcNames.includes('event_channel_worker_config'),false);
});
test('Admin: inspeciona ponte e devolve escopo sem configurar callbacks',async()=>{
 const r=await admin('inspect-bot-bridge',{instanceId:'bot:embaixada_urca'});
 assert.equal(r.status,200);assert.equal(r.fetchCount,1);
 assert.equal(r.body.instanceId,'bot:embaixada_urca');assert.equal(r.body.scopeId,bridgeScope);
 assert.equal(JSON.parse(r.requests[0].options.body).scope,bridgeScope);
 assert.equal(r.rpcNames.includes('configure_event_channel'),false);assert.equal(r.rpcNames.includes('event_bot_bridge_activate'),false);
});
test('Admin: ativa ponte no cursor atual e conta com escopo sem configurar callbacks',async()=>{
 const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca'});
 assert.equal(r.status,200);assert.equal(r.fetchCount,2);
 const activation=r.rpcCalls.find(call=>call.name==='event_bot_bridge_activate');
 assert.equal(activation.args.account_id,`bot:embaixada_urca|${bridgeScope}`);assert.equal(activation.args.initial_cursor,12);
 assert.equal(r.body.scopeId,bridgeScope);
 assert.equal(r.rpcNames.includes('configure_event_channel'),false);
 assert.equal(r.requests.some(request=>request.options.method==='PUT'),false);
});
for(const [label,options] of [['sem revisão',{approved:false}],['outra conta',{instanceId:'bot:outro'}],['escopo antigo',{scopeId:otherBridgeScope}],['escopo ausente',{scopeId:null}]])test(`Admin: ${label} impede ativação da ponte`,async()=>{
 const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca',...options});
 assert.equal(r.status,409);assert.equal(r.fetchCount,1);assert.equal(r.rpcNames.includes('event_bot_bridge_activate'),false);
});
for(const options of [{configuredScope:null},{configFailure:true}])test(`Admin: escopo privado indisponível impede consulta externa ${JSON.stringify(options)}`,async()=>{
 const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca',...options});
 assert.equal(r.status,409);assert.equal(r.fetchCount,0);assert.equal(r.rpcNames.includes('event_bot_bridge_activate'),false);
});
for(const bridgeResponse of [{scope:otherBridgeScope,nextCursor:bridgeCursor(12,otherBridgeScope)},{version:1},{nextCursor:12}])test(`Admin: contrato inválido da ponte não ativa ${JSON.stringify(bridgeResponse)}`,async()=>{
 const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca',bridgeResponse});
 assert.equal(r.status,502);assert.equal(r.fetchCount,1);assert.equal(r.rpcNames.includes('event_bot_bridge_activate'),false);
});
test('Interface: WhatsApp exige ponte restrita e não oferece ativação direta',()=>{
 const ui=fs.readFileSync(`${__dirname}/../event-operations.js`,'utf8');
 assert.match(ui,/Use a ativação verificada da ponte restrita do Bot/);
 assert.doesNotMatch(ui,/data-activate-zapi/);
 assert.match(ui,/d\.dataset\.bridgeScope\|\|null/);
});
test('Interface: mudança de conta ou escopo invalida revisão e preserva escopo inspecionado',()=>{
 const ui=fs.readFileSync(`${__dirname}/../event-operations.js`,'utf8');
 const apply=vm.runInNewContext(ui.slice(ui.indexOf('function applyInspectedChannelInstance('),ui.indexOf('async function showOpsChannelSetup('))+';applyInspectedChannelInstance');
 for(const [accountValue,scope,expected] of [['bot:embaixada_urca',bridgeScope,true],['bot:embaixada_urca',otherBridgeScope,false],['bot:other',bridgeScope,false],['bot:embaixada_urca',undefined,false]]){
  const account={value:accountValue},approved={checked:true};
  const dialog={dataset:{bridgeScope:scope},querySelector:selector=>selector==='[name="account"]'?account:approved};
  apply(dialog,{instanceId:'bot:embaixada_urca',scopeId:bridgeScope});
  assert.equal(approved.checked,expected);assert.equal(dialog.dataset.bridgeScope,bridgeScope);assert.equal(account.value,'bot:embaixada_urca');
 }
});

async function emailLogs({configured=true,status='delivered',to='customer@example.test',duplicates=false}={}){
 const ingest=[];let fetches=0;
 const log={request_id:'request',mailagent_key:'agent',to,status,email_reference:'message@example.test'};
 const chain={select(){return this;},eq(){return this;},or(){return this;},not(){return this;},gte(){return this;},order(){return this;},update(){return this;},async limit(){return{data:[{id:'00000000-0000-4000-8000-000000000001',provider_id:'request',destination:'customer@example.test',attempts:1}]};}};
 const worker={from:()=>chain,rpc:async(name,args)=>{if(name==='event_channel_worker_config')return{data:{expected_account:'agent'}};ingest.push(args);return{};}};
 const c=vm.createContext({URL,URLSearchParams,Date,AbortSignal,Response,Deno:{env:{get:key=>configured&&['EVENT_ZOHO_CLIENT_ID','EVENT_ZOHO_CLIENT_SECRET','EVENT_ZOHO_REFRESH_TOKEN'].includes(key)?'value':undefined}},fetch:async url=>{fetches++;return new Response(JSON.stringify(url.includes('/oauth/')?{access_token:'oauth'}:{data:duplicates?[log,log]:[log]}));}});
 vm.runInContext(source('_shared/email-delivery.ts'),c);const r=await vm.runInContext('syncEmailDeliveries',c)(worker);return{r,fetches,ingest};
}
test('Entrega de e-mail: sem OAuth de leitura não presume estado',async()=>{const r=await emailLogs({configured:false});assert.equal(r.r.ok,false);assert.equal(r.fetches,0);});
test('Entrega de e-mail: registro exato confirma destino e Message-ID',async()=>{const r=await emailLogs();assert.equal(r.ingest[0].events[0].signal,'delivered');assert.equal(r.ingest[0].events[0].provider_reference,'message@example.test');});
for(const scenario of [{status:'opened'},{to:'other@example.test'},{duplicates:true}])test(`Entrega de e-mail: rejeita evidência insuficiente ${JSON.stringify(scenario)}`,async()=>assert.equal((await emailLogs(scenario)).ingest.length,0));


async function deliveryWorker({correctKey=true,providerFailure=false,configFailure=false,initialFailure=false,rawBody='{"action":"diagnose"}'}={}){
 let handler,fetches=0;const rpcCalls=[];const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'private',ZAPI_INSTANCE_ID:'instance',ZAPI_TOKEN:'zapi-token-should-not-leak',ZAPI_CLIENT_TOKEN:'client-token-should-not-leak'};
 const client={rpc:async(name,args)=>{rpcCalls.push({name,args});if(initialFailure)throw Error('database');if(args?.target_provider==='zapi'&&configFailure)return{error:{message:'db'}};return{data:{delivery_job_key:'job-key',secret:'callback-secret',enabled:false}};}};
 const c=vm.createContext({Request,Response,URL,URLSearchParams,Date,AbortSignal,TextEncoder,TextDecoder,Uint8Array,btoa,crypto:require('node:crypto').webcrypto,createClient:()=>client,Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},fetch:async()=>{fetches++;if(providerFailure)throw new Error('provider');return new Response(JSON.stringify({connected:true,receivedCallbackUrl:'https://bot.example.test/hook?secret=hidden',messageStatusCallbackUrl:''}));}});
 for(const f of ['_shared/channel-events.ts','_shared/email-delivery.ts','event-email-delivery/index.ts'])vm.runInContext(source(f),c);
 const res=await handler(new Request('https://example.test/worker',{method:'POST',headers:{'x-event-job-key':correctKey?'job-key':'bad'},body:rawBody}));return{status:res.status,body:await res.text(),fetches,rpcCalls};
}
test('Diagnóstico interno: chave errada não acessa provedores',async()=>{const r=await deliveryWorker({correctKey:false});assert.equal(r.status,401);assert.equal(r.fetches,0);});
test('Diagnóstico interno: retorna conflito sem expor tokens ou URL completa',async()=>{const r=await deliveryWorker();assert.equal(r.status,200);assert.equal(r.fetches,1);assert.equal(JSON.parse(r.body).diagnostic.whatsapp.received.ours,false);assert.equal(r.body.includes('should-not-leak'),false);assert.equal(r.body.includes('hidden'),false);});
for(const failure of [{providerFailure:true},{configFailure:true}])test(`Diagnóstico interno: falha de leitura não altera prontidão ${JSON.stringify(failure)}`,async()=>{const r=await deliveryWorker(failure);assert.equal(r.status,503);assert.equal(r.rpcCalls.some(c=>c.name==='event_delivery_sync_result'),false);});

async function botBridgeWorker({diagnose=false,correctKey=true,providerFailure=false,enabled=true,account='bot:embaixada_urca',scope=bridgeScope,responseScope=scope,version=2,numericCursor=false,uncorrelated=false,pages=1,stalled=false,commitFailure=false}={}){
 let handler;const rpcCalls=[],requests=[];
 const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'private',EVENT_BOT_BRIDGE_URL:'https://script.google.com/macros/s/deployment/exec',EVENT_BOT_BRIDGE_SECRET:'s'.repeat(40)};
 const client={rpc:async(name,args)=>{
  rpcCalls.push({name,args});
  if(name==='event_bot_bridge_commit'&&commitFailure)return{error:{message:'db'}};
  if(name==='event_bot_bridge_worker_config')return{data:{job_key:'job-key',channel_enabled:enabled,enabled,cursor:7,expected_account:'bot:embaixada_urca',scope_id:scope}};
  return{};
 }};
 const c=vm.createContext({Request,Response,URL,URLSearchParams,Date,AbortSignal,TextEncoder,TextDecoder,Uint8Array,btoa,crypto:require('node:crypto').webcrypto,createClient:()=>client,Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},fetch:async(url,options)=>{
  requests.push({url,options});
  if(providerFailure)throw new Error('provider');
  const sequence=stalled?7:7+requests.length;
  const payload=bridgePayload({account,scope:responseScope,version,nextCursor:numericCursor?sequence:bridgeCursor(sequence,responseScope),hasMore:requests.length<pages});
  if(uncorrelated)delete payload.events[0].reply_to_id;
  return new Response(JSON.stringify(payload));
 }});
 for(const f of ['_shared/channel-events.ts','_shared/bot-dispatch.ts','_shared/bot-bridge.ts','event-bot-bridge/index.ts'])vm.runInContext(source(f),c);
 const res=await handler(new Request('https://example.test/bridge',{method:'POST',headers:{'x-event-job-key':correctKey?'job-key':'bad'},body:JSON.stringify(diagnose?{action:'diagnose'}:{})}));
 return{status:res.status,body:await res.text(),fetches:requests.length,requests,rpcCalls};
}
test('Worker da ponte: origem errada não consulta o Bot',async()=>{const r=await botBridgeWorker({correctKey:false});assert.equal(r.status,401);assert.equal(r.fetches,0);});
test('Worker da ponte: lote correlacionado e cursor usam transação única com escopo',async()=>{
 const r=await botBridgeWorker();assert.equal(r.status,200);
 const request=JSON.parse(r.requests[0].options.body);
 assert.equal(request.version,2);assert.equal(request.tenant,'embaixada_urca');assert.equal(request.scope,bridgeScope);assert.equal(request.cursor,bridgeCursor(7));
 const c=r.rpcCalls.find(c=>c.name==='event_bot_bridge_commit');
 assert.equal(c.args.account_id,'bot:embaixada_urca');assert.equal(c.args.expected_cursor,7);assert.equal(c.args.next_cursor_value,8);
 assert.equal(c.args.events.scope,bridgeScope);assert.equal(c.args.events.events.length,1);assert.equal(c.args.events.events[0].reply_to_id,'authorized-outbound');
 assert.equal(r.rpcCalls.some(c=>c.name==='ingest_event_provider_events'||(c.name==='event_bot_bridge_result'&&c.args.next_cursor_value!==null)),false);
});
test('Worker da ponte: diagnóstico bem-sucedido não escreve',async()=>{
 const r=await botBridgeWorker({diagnose:true});assert.equal(r.status,200);
 assert.equal(JSON.parse(r.requests[0].options.body).scope,bridgeScope);
 assert.equal(r.rpcCalls.some(c=>['ingest_event_provider_events','event_bot_bridge_result','event_bot_bridge_commit'].includes(c.name)),false);
});
test('Worker da ponte: falha de diagnóstico não avança nem altera cursor',async()=>{
 const r=await botBridgeWorker({diagnose:true,providerFailure:true});assert.equal(r.status,503);
 assert.equal(r.rpcCalls.some(c=>['event_bot_bridge_result','event_bot_bridge_commit'].includes(c.name)),false);
});
test('Admin: callbacks ausentes impedem ativar ponte',async()=>{const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca',callbacks:false});assert.equal(r.status,409);assert.equal(r.rpcNames.includes('event_bot_bridge_activate'),false);});
test('Admin: callback de outro sistema impede ativação sem substituí-lo',async()=>{const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca',conflict:true});assert.equal(r.status,409);assert.equal(r.rpcNames.includes('event_bot_bridge_activate'),false);assert.equal(r.requests.some(request=>request.options.method==='PUT'),false);});
test('Admin: falha de ativação interna não publica callbacks',async()=>{const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca',enableFailure:true});assert.equal(r.status,502);assert.equal(r.fetchCount,2);assert.equal(r.requests.some(request=>request.options.method==='PUT'),false);});
test('Worker da ponte: desativado não consulta o Bot',async()=>{const r=await botBridgeWorker({enabled:false});assert.equal(r.status,409);assert.equal(r.fetches,0);});
test('Worker da ponte: escopo não configurado não consulta nem confirma lote',async()=>{const r=await botBridgeWorker({scope:null});assert.equal(r.status,409);assert.equal(r.fetches,0);assert.equal(r.rpcCalls.some(c=>c.name==='event_bot_bridge_commit'),false);});
for(const [label,scenario] of [['outra conta',{account:'bot:outra'}],['cursor parado',{pages:2,stalled:true}],['outro escopo',{responseScope:otherBridgeScope}],['protocolo antigo',{version:1}],['cursor numérico',{numericCursor:true}],['mensagem sem correlação',{uncorrelated:true}]])test(`Worker da ponte: ${label} não é ingerido e preserva cursor`,async()=>{
 const r=await botBridgeWorker(scenario);assert.equal(r.status,503);
 assert.equal(r.rpcCalls.some(c=>c.name==='event_bot_bridge_commit'||c.name==='ingest_event_provider_events'),false);
 const failures=r.rpcCalls.filter(c=>c.name==='event_bot_bridge_result');
 assert.equal(failures.length,1);assert.equal(failures[0].args.next_cursor_value,null);assert.equal(failures[0].args.healthy_value,false);
});
test('Worker da ponte: drena páginas com cursor opaco e confirma sequências consecutivas',async()=>{
 const r=await botBridgeWorker({pages:3});assert.equal(r.status,200);assert.equal(r.fetches,3);
 assert.deepEqual(r.rpcCalls.filter(c=>c.name==='event_bot_bridge_commit').map(c=>c.args.expected_cursor),[7,8,9]);
 assert.deepEqual(r.requests.map(request=>JSON.parse(request.options.body).cursor),[bridgeCursor(7),bridgeCursor(8),bridgeCursor(9)]);
});
test('Worker da ponte: limite por execução preserva continuação',async()=>{const r=await botBridgeWorker({pages:20});assert.equal(r.status,200);assert.equal(r.fetches,10);assert.equal(JSON.parse(r.body).hasMore,true);});
test('Worker da ponte: falha de commit interrompe consulta sem avançar fora da transação',async()=>{
 const r=await botBridgeWorker({commitFailure:true,pages:2});assert.equal(r.status,503);assert.equal(r.fetches,1);
 assert.equal(r.rpcCalls.filter(c=>c.name==='event_bot_bridge_commit').length,1);
 const failures=r.rpcCalls.filter(c=>c.name==='event_bot_bridge_result');assert.equal(failures.length,1);assert.equal(failures[0].args.next_cursor_value,null);
});

for(const rawBody of ['oops','null','[]','{"action":"enable"}'])test(`Delivery worker: malformed/unknown request ${rawBody} cannot change readiness`,async()=>{const r=await deliveryWorker({rawBody});assert.equal(r.status,400);assert.equal(r.fetches,0);assert.equal(r.rpcCalls.some(c=>c.name==='event_delivery_sync_result'),false);});
test('Delivery worker: configuration read exception does not enable delivery scheduler',async()=>{const r=await deliveryWorker({initialFailure:true});assert.equal(r.status,503);assert.equal(r.fetches,0);assert.equal(r.rpcCalls.some(c=>c.name==='event_delivery_sync_result'),false);});

test('Ponte: timestamp de captura ausente ou inválido não é substituído por agora',()=>{for(const captured_at of [undefined,'invalid',new Date(Date.now()+3600000).toISOString()]){const p=bridgePayload();p.events[0].captured_at=captured_at;assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(p,7,bridgeScope));}});
