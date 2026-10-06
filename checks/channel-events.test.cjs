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

async function admin(action,{team=true,manager=true,conflict=false,approved=true}={}){
 let handler,fetchCount=0;const rpcCalls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async(name,args)=>{rpcCalls.push(name);if(name==='is_team_member')return{data:team};if(name==='is_super_admin')return{data:manager};if(name==='event_channel_worker_config')return{data:{secret:'key'}};return{};}};
 const c=vm.createContext({Request,Response,URL,URLSearchParams,Date,AbortSignal,createClient:()=>client,Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://example.test':'value'},serve:fn=>handler=fn},fetch:async()=>{fetchCount++;return new Response(JSON.stringify({connected:true,receivedCallbackUrl:conflict?'https://bot.example.test/hook':'',messageStatusCallbackUrl:''}),{status:200});}});
 vm.runInContext(source('_shared/email-delivery.ts'),c);vm.runInContext(source('event-channel-admin/index.ts'),c);
 const res=await handler(new Request('https://example.test/admin',{method:'POST',body:JSON.stringify({action,approved})}));return{status:res.status,fetchCount,rpcCalls};
}
test('Admin: usuário fora da equipe não consulta provedores',async()=>{const r=await admin('inspect-zapi',{team:false});assert.equal(r.status,403);assert.equal(r.fetchCount,0);});
test('Admin: vendedor não configura callbacks',async()=>{const r=await admin('activate-zapi',{manager:false});assert.equal(r.status,403);assert.equal(r.fetchCount,0);});
test('Admin: callback existente do Bot não é substituído',async()=>{const r=await admin('activate-zapi',{conflict:true});assert.equal(r.status,409);assert.equal(r.fetchCount,1);assert.equal(r.rpcCalls.includes('configure_event_channel'),false);});
test('Admin: ativação exige revisão explícita',async()=>{const r=await admin('activate-zapi',{approved:false});assert.equal(r.status,409);assert.equal(r.fetchCount,1);assert.equal(r.rpcCalls.includes('configure_event_channel'),false);});

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
