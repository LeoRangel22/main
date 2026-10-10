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

const bridgeSandbox={URL,Date,AbortSignal,fetch:async()=>new Response('{}')};
const bridgeContext=vm.createContext(bridgeSandbox);
vm.runInContext(source('_shared/bot-bridge.ts'),bridgeContext);
const bridgeFuncs=vm.runInContext('({botBridgeUrl,fetchBotBridge,normalizeBotBridgeResult})',bridgeContext);
const bridgePayload=(overrides={})=>({ok:true,version:1,account:'bot:embaixada_urca',nextCursor:8,hasMore:false,events:[{key:'m1',channel:'whatsapp',kind:'inbound',message_id:'m1',destination:'5521999999999',body:'Olá',occurred_at:new Date().toISOString()}],...overrides});
test('Ponte do Bot aceita somente URL limpa HTTPS do Apps Script',()=>{const url=bridgeFuncs.botBridgeUrl('https://script.google.com/macros/s/deployment/exec');assert.equal(new URL(url).hostname,'script.google.com');assert.throws(()=>bridgeFuncs.botBridgeUrl('https://example.test/macros/s/deployment/exec'));assert.throws(()=>bridgeFuncs.botBridgeUrl('https://script.google.com/macros/s/deployment/exec?token=leak'));});
test('Ponte do Bot envia o segredo no corpo e rejeita redirecionamento inesperado',async()=>{let request;bridgeSandbox.fetch=async(url,options)=>{request={url,options};return{ok:true,url:'https://script.googleusercontent.com/macros/echo',json:async()=>({ok:true})};};await bridgeFuncs.fetchBotBridge('https://script.google.com/macros/s/deployment/exec','s'.repeat(32),{probe:1});assert.equal(new URL(request.url).search,'');assert.equal(JSON.parse(request.options.body).s,'s'.repeat(32));assert.equal(request.options.method,'POST');bridgeSandbox.fetch=async()=>({ok:true,url:'https://evil.example.test/result',json:async()=>({})});await assert.rejects(()=>bridgeFuncs.fetchBotBridge('https://script.google.com/macros/s/deployment/exec','s'.repeat(32),{probe:1}));await assert.rejects(()=>bridgeFuncs.fetchBotBridge('https://script.google.com/macros/s/deployment/exec','short',{probe:1}));});
test('Ponte do Bot valida conta, cursor e eventos antes de persistir',()=>{const result=bridgeFuncs.normalizeBotBridgeResult(bridgePayload(),7);assert.equal(result.events[0].kind,'inbound');assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(bridgePayload({nextCursor:6}),7));assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(bridgePayload({account:'zapi:instance'}),0));assert.throws(()=>bridgeFuncs.normalizeBotBridgeResult(bridgePayload({events:[{...bridgePayload().events[0],destination:'123'}]}),0));});

async function receiver({provider='zapi',enabled=true,secret='k'.repeat(32),body=incoming,wrongKey=false,badSignature=false,failWrite=false}={}){
 let handler;const calls=[];const value=JSON.stringify(body);
 const client={rpc:async(name,args)=>{if(name==='event_channel_worker_config')return{data:{enabled,secret,expected_account:provider==='zapi'?'instance':provider==='zepto'?'agent':'events'}};calls.push(args);return failWrite?{error:{message:'db'}}:{};}};
 const c=vm.createContext({Request,Response,URL,TextEncoder,TextDecoder,URLSearchParams,Date,crypto:require('node:crypto').webcrypto,btoa,Uint8Array,createClient:()=>client,Deno:{env:{get:key=>key==='ZAPI_INSTANCE_ID'?'instance':'key'},serve:fn=>handler=fn}});
 vm.runInContext(source('_shared/channel-events.ts'),c);vm.runInContext(source('event-channel-webhook/index.ts'),c);
 const signature=await funcs.hmac(secret,value),headers={'Content-Type':'application/json','producer-signature':`ts=${Date.now()};s=${encodeURIComponent(badSignature?'bad':signature)};s-algorithm=HmacSHA256`};
 const res=await handler(new Request(`https://example.test/webhook?provider=${provider}&key=${wrongKey?'wrong':secret}`,{method:'POST',headers,body:value}));return{status:res.status,calls};
}
test('Endpoint: chave errada não escreve',async()=>{const r=await receiver({wrongKey:true});assert.equal(r.status,401);assert.equal(r.calls.length,0);});
test('Endpoint: canal não ativado não escreve',async()=>{const r=await receiver({enabled:false});assert.equal(r.status,503);assert.equal(r.calls.length,0);});
test('Endpoint: HMAC errado não escreve',async()=>{const r=await receiver({provider:'zepto',body:zepto(),badSignature:true});assert.equal(r.status,401);assert.equal(r.calls.length,0);});
test('Endpoint: mensagem autenticada chega ao ledger',async()=>{const r=await receiver();assert.equal(r.status,200);assert.equal(r.calls[0].events[0].kind,'inbound');});
test('Endpoint: indisponibilidade do banco pede retry ao provedor',async()=>assert.equal((await receiver({failWrite:true})).status,503));
test('Endpoint: recebido de outra instância não escreve',async()=>{const r=await receiver({body:{...incoming,instanceId:'other'}});assert.equal(r.status,400);assert.equal(r.calls.length,0);});

async function admin(action,{team=true,manager=true,conflict=false,approved=true,instanceId='value',enableFailure=false,callbacks=true}={}){
 let handler,fetchCount=0,currentCallback=conflict?'https://bot.example.test/hook':action==='activate-bot-bridge'&&callbacks?'https://script.google.com/macros/s/deployment/exec?s=private':'';const rpcCalls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async(name,args)=>{rpcCalls.push(name);if(name==='event_zapi_direct_activate'&&enableFailure)return{error:{message:'db'}};if(name==='is_team_member')return{data:team};if(name==='is_super_admin')return{data:manager};if(name==='event_channel_worker_config')return{data:{secret:'key'}};return{};}};
 const env={SUPABASE_URL:'https://example.test',EVENT_BOT_BRIDGE_URL:'https://script.google.com/macros/s/deployment/exec',EVENT_BOT_BRIDGE_SECRET:'s'.repeat(40),ZAPI_INSTANCE_ID:'value',ZAPI_TOKEN:'value',ZAPI_CLIENT_TOKEN:'value'};
 const c=vm.createContext({Request,Response,URL,URLSearchParams,Date,AbortSignal,createClient:()=>client,Deno:{env:{get:key=>env[key]},serve:fn=>handler=fn},fetch:async(url,options={})=>{fetchCount++;if(String(url).startsWith('https://script.google.com/'))return new Response(JSON.stringify({ok:true,version:1,account:'bot:embaixada_urca',nextCursor:12,hasMore:false,events:[]}));if(options.method==='PUT'){currentCallback=JSON.parse(options.body).value;return new Response('{}');}return new Response(JSON.stringify({connected:true,receivedCallbackUrl:currentCallback,messageStatusCallbackUrl:currentCallback}),{status:200});}});
 vm.runInContext(source('_shared/email-delivery.ts'),c);vm.runInContext(source('_shared/bot-bridge.ts'),c);vm.runInContext(source('event-channel-admin/index.ts'),c);
 const res=await handler(new Request('https://example.test/admin',{method:'POST',body:JSON.stringify({action,approved,instanceId})}));return{status:res.status,fetchCount,rpcCalls};
}
test('Admin: usuário fora da equipe não consulta provedores',async()=>{const r=await admin('inspect-zapi',{team:false});assert.equal(r.status,403);assert.equal(r.fetchCount,0);});
test('Admin: vendedor não configura callbacks',async()=>{const r=await admin('activate-zapi',{manager:false});assert.equal(r.status,403);assert.equal(r.fetchCount,0);});
test('Admin: callback existente do Bot não é substituído',async()=>{const r=await admin('activate-zapi',{conflict:true});assert.equal(r.status,409);assert.equal(r.fetchCount,1);assert.equal(r.rpcCalls.includes('configure_event_channel'),false);});
test('Admin: ativação exige revisão explícita',async()=>{const r=await admin('activate-zapi',{approved:false});assert.equal(r.status,409);assert.equal(r.fetchCount,1);assert.equal(r.rpcCalls.includes('configure_event_channel'),false);});
test('Admin: inspeciona ponte sem configurar callbacks',async()=>{const r=await admin('inspect-bot-bridge',{instanceId:'bot:embaixada_urca'});assert.equal(r.status,200);assert.equal(r.fetchCount,1);assert.equal(r.rpcCalls.includes('configure_event_channel'),false);assert.equal(r.rpcCalls.includes('event_bot_bridge_activate'),false);});
test('Admin: ativa ponte no cursor atual sem configurar callbacks',async()=>{const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca'});assert.equal(r.status,200);assert.equal(r.fetchCount,2);assert.equal(r.rpcCalls.includes('event_bot_bridge_activate'),true);assert.equal(r.rpcCalls.includes('configure_event_channel'),false);});
test('Admin: troca de conta invalida aprovação da ponte',async()=>{const r=await admin('activate-bot-bridge',{instanceId:'bot:outro'});assert.equal(r.status,409);assert.equal(r.rpcCalls.includes('event_bot_bridge_activate'),false);});
test('Admin: callback direto usa apenas a ativação atômica do worker',async()=>{const r=await admin('activate-zapi');assert.equal(r.status,200);assert.equal(r.rpcCalls.includes('event_zapi_direct_activate'),true);assert.equal(r.rpcCalls.includes('configure_event_channel'),false);});
test('Interface: WhatsApp não pode ser habilitado pelo salvamento genérico',()=>{const ui=fs.readFileSync(`${__dirname}/../event-operations.js`,'utf8');assert.match(ui,/Use a ativação verificada da ponte do Bot ou dos callbacks disponíveis/);});

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

test("Admin: revisão de outra instância não configura callbacks",async()=>{const r=await admin("activate-zapi",{instanceId:"other"});assert.equal(r.status,409);assert.equal(r.fetchCount,1);assert.equal(r.rpcCalls.includes("configure_event_channel"),false);});

async function deliveryWorker({correctKey=true,providerFailure=false,configFailure=false}={}){
 let handler,fetches=0;const rpcCalls=[];const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'private',ZAPI_INSTANCE_ID:'instance',ZAPI_TOKEN:'zapi-token-should-not-leak',ZAPI_CLIENT_TOKEN:'client-token-should-not-leak'};
 const client={rpc:async(name,args)=>{rpcCalls.push({name,args});if(args?.target_provider==='zapi'&&configFailure)return{error:{message:'db'}};return{data:{delivery_job_key:'job-key',secret:'callback-secret',enabled:false}};}};
 const c=vm.createContext({Request,Response,URL,URLSearchParams,Date,AbortSignal,TextEncoder,TextDecoder,Uint8Array,btoa,crypto:require('node:crypto').webcrypto,createClient:()=>client,Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},fetch:async()=>{fetches++;if(providerFailure)throw new Error('provider');return new Response(JSON.stringify({connected:true,receivedCallbackUrl:'https://bot.example.test/hook?secret=hidden',messageStatusCallbackUrl:''}));}});
 for(const f of ['_shared/channel-events.ts','_shared/email-delivery.ts','event-email-delivery/index.ts'])vm.runInContext(source(f),c);
 const res=await handler(new Request('https://example.test/worker',{method:'POST',headers:{'x-event-job-key':correctKey?'job-key':'bad'},body:'{"action":"diagnose"}'}));return{status:res.status,body:await res.text(),fetches,rpcCalls};
}
test('Diagnóstico interno: chave errada não acessa provedores',async()=>{const r=await deliveryWorker({correctKey:false});assert.equal(r.status,401);assert.equal(r.fetches,0);});
test('Diagnóstico interno: retorna conflito sem expor tokens ou URL completa',async()=>{const r=await deliveryWorker();assert.equal(r.status,200);assert.equal(r.fetches,1);assert.equal(JSON.parse(r.body).diagnostic.whatsapp.received.ours,false);assert.equal(r.body.includes('should-not-leak'),false);assert.equal(r.body.includes('hidden'),false);});
for(const failure of [{providerFailure:true},{configFailure:true}])test(`Diagnóstico interno: falha de leitura não altera prontidão ${JSON.stringify(failure)}`,async()=>{const r=await deliveryWorker(failure);assert.equal(r.status,503);assert.equal(r.rpcCalls.some(c=>c.name==='event_delivery_sync_result'),false);});

async function botBridgeWorker({diagnose=false,correctKey=true,providerFailure=false,enabled=true,account='bot:embaixada_urca',pages=1,stalled=false,commitFailure=false}={}){
 let handler,fetches=0;const rpcCalls=[];const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'private',EVENT_BOT_BRIDGE_URL:'https://script.google.com/macros/s/deployment/exec',EVENT_BOT_BRIDGE_SECRET:'s'.repeat(40)};
 const client={rpc:async(name,args)=>{rpcCalls.push({name,args});if(name==='event_bot_bridge_commit'&&commitFailure)return{error:{message:'db'}};if(name==='event_bot_bridge_worker_config')return{data:{job_key:'job-key',channel_enabled:enabled,enabled,cursor:7,expected_account:'bot:embaixada_urca'}};return{};}};
 const payload=bridgePayload({nextCursor:8});
 const c=vm.createContext({Request,Response,URL,URLSearchParams,Date,AbortSignal,TextEncoder,TextDecoder,Uint8Array,btoa,crypto:require('node:crypto').webcrypto,createClient:()=>client,Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},fetch:async()=>{fetches++;if(providerFailure)throw new Error('provider');return new Response(JSON.stringify({...payload,account,nextCursor:stalled?7:7+fetches,hasMore:fetches<pages}));}});
 for(const f of ['_shared/channel-events.ts','_shared/email-delivery.ts','_shared/bot-bridge.ts','event-bot-bridge/index.ts'])vm.runInContext(source(f),c);
 const res=await handler(new Request('https://example.test/bridge',{method:'POST',headers:{'x-event-job-key':correctKey?'job-key':'bad'},body:JSON.stringify(diagnose?{action:'diagnose'}:{})}));
 return{status:res.status,body:await res.text(),fetches,rpcCalls};
}
test('Worker da ponte: origem errada não consulta o Bot',async()=>{const r=await botBridgeWorker({correctKey:false});assert.equal(r.status,401);assert.equal(r.fetches,0);});
test('Worker da ponte: lote e cursor usam uma única transação',async()=>{const r=await botBridgeWorker();assert.equal(r.status,200);const c=r.rpcCalls.find(c=>c.name==='event_bot_bridge_commit');assert.equal(c.args.expected_cursor,7);assert.equal(c.args.next_cursor_value,8);assert.equal(c.args.events.length,1);assert.equal(r.rpcCalls.some(c=>c.name==='ingest_event_provider_events'||(c.name==='event_bot_bridge_result'&&c.args.next_cursor_value!==null)),false);});
test('Worker da ponte: diagnóstico bem-sucedido não escreve',async()=>{const r=await botBridgeWorker({diagnose:true});assert.equal(r.status,200);assert.equal(r.rpcCalls.some(c=>c.name==='ingest_event_provider_events'||c.name==='event_bot_bridge_result'),false);});
test('Worker da ponte: falha de diagnóstico não avança nem altera cursor',async()=>{const r=await botBridgeWorker({diagnose:true,providerFailure:true});assert.equal(r.status,503);assert.equal(r.rpcCalls.some(c=>c.name==='event_bot_bridge_result'),false);});

test('Admin: callbacks ausentes impedem ativar ponte',async()=>{const r=await admin('activate-bot-bridge',{instanceId:'bot:embaixada_urca',callbacks:false});assert.equal(r.status,409);assert.equal(r.rpcCalls.includes('event_bot_bridge_activate'),false);});
test('Admin: falha interna não publica callbacks',async()=>{const r=await admin('activate-zapi',{enableFailure:true});assert.equal(r.status,502);assert.equal(r.fetchCount,1);});
test('Worker da ponte: desativado não consulta o Bot',async()=>{const r=await botBridgeWorker({enabled:false});assert.equal(r.status,409);assert.equal(r.fetches,0);});
test('Worker da ponte: outra conta e cursor parado não são ingeridos',async()=>{for(const scenario of [{account:'bot:outra'},{pages:2,stalled:true}]){const r=await botBridgeWorker(scenario);assert.equal(r.status,503);assert.equal(r.rpcCalls.some(c=>c.name==='event_bot_bridge_commit'),false);}});
test('Worker da ponte: drena páginas consecutivas com cursor confirmado',async()=>{const r=await botBridgeWorker({pages:3});assert.equal(r.status,200);assert.equal(r.fetches,3);assert.deepEqual(r.rpcCalls.filter(c=>c.name==='event_bot_bridge_commit').map(c=>c.args.expected_cursor),[7,8,9]);});
test('Worker da ponte: limite por execução preserva continuação',async()=>{const r=await botBridgeWorker({pages:20});assert.equal(r.status,200);assert.equal(r.fetches,10);assert.equal(JSON.parse(r.body).hasMore,true);});
test('Worker da ponte: falha de commit interrompe consulta sem avançar fora da transação',async()=>{const r=await botBridgeWorker({commitFailure:true,pages:2});assert.equal(r.status,503);assert.equal(r.fetches,1);assert.equal(r.rpcCalls.filter(c=>c.name==='event_bot_bridge_result').every(c=>c.args.next_cursor_value===null),true);});
