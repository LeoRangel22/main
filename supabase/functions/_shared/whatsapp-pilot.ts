import { botContentHash, botDestinationIsCanonical, botPilotMessage, dispatchProtectedBot, protectedBotConfig, type BotSendContext } from './bot-dispatch.ts';

const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
export type PilotDependencies={caller:any;worker:any;mode:()=>string;dispatch?:typeof dispatchProtectedBot};
const outcome=(pilot:any)=>({pilotId:pilot.id,status:pilot.status,attempts:pilot.attempts,providerId:pilot.provider_id||null,
  deliveryConfirmed:false,replyConfirmed:false,bridgeCredentialsVerified:false});

// Explicit dry-run never claims work. Real execution makes one committed claim
// before the only dispatch. A claim without a final result is never replayed.
export async function executeWhatsAppPilot(input:unknown,deps:PilotDependencies) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['pilotId','dryRun'].includes(k)))return {status:400,body:{ok:false,message:'Solicitação inválida.'}};
  const request=input as any;
  if(!uuid(request.pilotId)||(request.dryRun!==undefined&&typeof request.dryRun!=='boolean'))return {status:400,body:{ok:false,message:'Solicitação inválida.'}};
  const {data:pilot,error:readError}=await deps.caller.rpc('get_event_whatsapp_pilot',{target_pilot:request.pilotId});
  if(readError||!pilot)return {status:403,body:{ok:false,message:'Piloto indisponível para esta conta.'}};
  const observed=outcome(pilot);
  if(pilot.status!=='ready'||pilot.attempts!==0)return {status:409,body:{ok:false,...observed,message:'Já existe uma tentativa ou decisão. Confira o resultado; nenhum novo envio foi iniciado.'}};
  let context:BotSendContext;
  try {
    context={id:pilot.id,contextId:pilot.id,revision:1,purpose:'event_diagnostic',expiresAt:new Date(pilot.expires_at).toISOString(),attempt:1};
    if(!uuid(pilot.id)||pilot.id!==request.pilotId||pilot.enabled!==true||pilot.eligible!==true||!botDestinationIsCanonical(pilot.destination)||
      pilot.body!==botPilotMessage(pilot.id)||pilot.content_hash!==await botContentHash(pilot.destination,pilot.body,context))throw Error('invalid');
  }catch{return {status:409,body:{ok:false,...observed,message:'Escopo do piloto inválido, desativado ou expirado. Nenhuma tentativa criada.'}};}
  if(deps.mode()!=='pilot'||!protectedBotConfig(context,pilot.destination,pilot.body).configured)return {status:409,body:{ok:false,...observed,message:'Transporte isolado do piloto não está pronto. Nenhuma tentativa criada.'}};
  if(request.dryRun===true)return {status:200,body:{ok:true,...observed,ready:true,dryRun:true,willSend:false,destinationSuffix:pilot.destination.slice(-4),message:pilot.body,expiresAt:context.expiresAt}};
  const {data:claim,error:claimError}=await deps.caller.rpc('claim_event_whatsapp_pilot',{target_pilot:pilot.id});
  if(claimError||!claim)return {status:409,body:{ok:false,...observed,message:'A autorização não foi confirmada. Confira o registro antes de qualquer nova ação.'}};
  if(claim.claimed!==true)return {status:409,body:{ok:false,...outcome(claim.pilot||pilot),message:'Nenhuma nova tentativa foi iniciada. Consulte o registro existente.'}};
  // Immutable row, but revalidate the claimed snapshot rather than trust a stale read.
  const fresh=claim.pilot;
  if(!fresh||fresh.id!==pilot.id||fresh.destination!==pilot.destination||fresh.body!==pilot.body||fresh.content_hash!==pilot.content_hash||fresh.expires_at!==pilot.expires_at||fresh.attempts!==1||fresh.status!=='claimed')
    return {status:503,body:{ok:false,pilotId:pilot.id,status:'uncertain',deliveryConfirmed:false,replyConfirmed:false,message:'Claim sem correspondência confirmada. Não repetir; conferir o registro.'}};
  let result;
  try{result=await (deps.dispatch||dispatchProtectedBot)(pilot.destination,pilot.body,context);}
  catch{result={status:'uncertain',providerId:null,attempted:true,detail:'Resultado não confirmado.'};}
  const finalStatus=result.status==='paused'?'refused':result.status;
  const {error:finishError}=await deps.worker.rpc('finish_event_whatsapp_pilot',{target_pilot:pilot.id,result_status:finalStatus,
    external_id:result.providerId||null,was_attempted:result.attempted===true});
  if(finishError)return {status:503,body:{ok:false,pilotId:pilot.id,status:'uncertain',statusRecorded:false,deliveryConfirmed:false,replyConfirmed:false,
    message:'Resultado não registrado com confirmação. Não repetir; conferir o Bot e o registro.'}};
  return {status:finalStatus==='accepted'?200:finalStatus==='failed'?502:409,body:{ok:finalStatus==='accepted',pilotId:pilot.id,status:finalStatus,
    attempts:1,providerId:result.providerId||null,deliveryConfirmed:false,replyConfirmed:false,bridgeCredentialsVerified:false,
    message:finalStatus==='accepted'?'Aceito pelo provedor via Bot. Entrega e resposta ainda não confirmadas.':'Piloto encerrado sem confirmação de sucesso. Não há repetição automática.'}};
}
