import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { claimSend, createSendWorker, finishSend, duplicateResult } from "../_shared/send-ledger.ts";
import { dispatchProtectedBot, protectedBotConfig, botSendExpiry, botDestinationIsCanonical } from "../_shared/bot-dispatch.ts";
import { prepareWhatsApp, claimPreparedWhatsApp, publicWhatsAppPreparation } from "../_shared/whatsapp-preparation.ts";
const corsHeaders = { "Access-Control-Allow-Origin":"https://leorangel22.github.io", "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type", "Access-Control-Allow-Methods":"POST,OPTIONS" };
const jsonResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
function normalizePhone(value:unknown) { const digits=String(value||"").replace(/\D/g,""); return digits; }
function safeText(value:unknown,fallback="") { return String(value||fallback).trim(); }
type SendPayload = any;
function buildDefaultMessage(payload: SendPayload, proposal: any) {
  const snapshot = proposal?.snapshot || {};
  const clientName = safeText(proposal?.cliente_nome || snapshot?.client?.name, "cliente");
  const firstName = clientName.split(/\s+/)[0] || "tudo bem";
  const proposalUrl = safeText(payload.proposalUrl);

  return [
    `Olá, ${firstName}!`,
    "",
    "Sua proposta da Embaixada Carioca está pronta para revisão:",
    proposalUrl,
    "",
    "Pelo link você pode aprovar, pedir ajustes ou anexar o comprovante do sinal. A data e o horário ficam reservados após validação da equipe e confirmação do sinal.",
    "",
    "Para manter tudo organizado, prefira responder pelo link da proposta.",
    "Para falar com a equipe, use os canais de atendimento informados na proposta.",
    "",
    "Observação: este envio saiu pelo número automático da Embaixada Carioca.",
  ].join("\n");
}


Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return jsonResponse({ok:false,message:"Método não permitido."},405);
 try {
  const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_ANON_KEY")||"";
  if(!url||!key)return jsonResponse({ok:false,message:"Serviço indisponível."},503);
  const caller=createClient(url,key,{global:{headers:{Authorization:req.headers.get("Authorization")||""}},auth:{persistSession:false}});
  const {data:identity,error:authError}=await caller.auth.getUser();
  if(authError||!identity?.user)return jsonResponse({ok:false,message:"Entre com sua conta da equipe."},401);
  const {data:team}=await caller.rpc("is_team_member");
  if(team!==true)return jsonResponse({ok:false,message:"Usuário sem acesso à equipe de Eventos."},403);
  const raw=await req.text();if(raw.length>16000)return jsonResponse({ok:false,message:"Mensagem muito grande."},413);
  const payload=JSON.parse(raw);
  if(!payload||typeof payload!=="object"||Array.isArray(payload))return jsonResponse({ok:false},400);
  if(payload.dryRun){
    const configured=protectedBotConfig().configured;
    return jsonResponse({ok:configured,mode:"dry-run",configured:{bot:configured},message:configured?"Transporte do Bot configurado; permissões, limites e entrega ainda exigem validação.":"Transporte protegido do Bot ainda não habilitado. Nenhum envio realizado."},configured?200:409);
  }
  if(!payload.proposalId)return jsonResponse({ok:false,message:"Proposta não informada."},400);
  const {data:proposal,error}=await caller.from("propostas").select("*").eq("id",payload.proposalId).single();
  if(error||!proposal)return jsonResponse({ok:false,message:"Proposta não encontrada ou sem permissão."},404);
  const destination=normalizePhone(payload.phone||proposal.cliente_whatsapp||proposal.snapshot?.client?.phone);
  const message=safeText(payload.message)||buildDefaultMessage(payload,proposal);
  if(!botDestinationIsCanonical(destination))return jsonResponse({ok:false,message:"Revise o WhatsApp completo com DDI e DDD no formato atual. O número não será alterado após a aprovação."},400);
  if(message.length<10||message.length>6000)return jsonResponse({ok:false,message:"Confira o destinatário e a mensagem (10 a 6.000 caracteres)."},400);
  let preparation;
  if(payload.prepare === true || payload.preparation){
    try { preparation=await prepareWhatsApp(caller,proposal,payload,destination,message,payload.title||"Proposta comercial"); }
    catch(error){return jsonResponse({ok:false,message:String((error as Error).message||error)},409);}
    if(payload.prepare === true)return jsonResponse({ok:true,mode:"preparation",preparation:publicWhatsAppPreparation(preparation),message:"Preparação consultada. Nenhum envio, grant ou tentativa foi criado."});
  }
  // The disabled transport must not create claims or consume retry budgets.
  const configured=protectedBotConfig().configured;
  if(!configured)return jsonResponse({ok:false,deliveryStatus:"paused",message:"Envio protegido pelo Bot ainda não habilitado. Nenhuma mensagem foi tentada."},409);
  let claim;
  try { claim=preparation ? await claimPreparedWhatsApp(caller,preparation) : await claimSend(caller,proposal,payload,"whatsapp",destination,message,payload.title||"Proposta comercial"); }
  catch(error){return jsonResponse({ok:false,message:String((error as Error).message||error)},409);}
  if(!claim.claimed){const duplicate=duplicateResult(claim);return jsonResponse(duplicate,duplicate.ok?200:409);}
  const worker=createSendWorker();
  // Never resume a queued send against a changed proposal. A refusal is a known
  // non-attempt; the Bot independently checks its scoped grant and expiry.
  const {data:fresh,error:freshError}=await worker.from("propostas").select("id,revision,is_current,status,public_token,public_token_revoked_at,public_token_expires_at,oportunidade_id").eq("id",proposal.id).single();
  let responseChanged=false;
  if(fresh?.oportunidade_id){
    const {data:opportunity,error:responseError}=await worker.from("oportunidades").select("ultima_resposta_cliente_em").eq("id",fresh.oportunidade_id).single();
    const stamp=(value:unknown)=>value?new Date(String(value)).getTime():null;
    responseChanged=!!responseError||!opportunity||stamp(opportunity.ultima_resposta_cliente_em)!==stamp(payload.reviewedResponseAt);
  }
  let approvalChanged=false;
  if(payload.approvalId){
    const {data:approval,error:approvalError}=await worker.from("event_proposal_approvals").select("status,revision,proposal_id,send_id").eq("id",payload.approvalId).single();
    approvalChanged=!!approvalError||!approval||approval.status!=="approved"||approval.revision!==proposal.revision||approval.proposal_id!==proposal.id||approval.send_id!==claim.send.id;
  }
  let result;
  if(responseChanged||approvalChanged||!fresh?.oportunidade_id||freshError||!fresh||fresh.revision!==proposal.revision||fresh.is_current!==true||["cancelado","pos_venda"].includes(fresh.status)||fresh.public_token_revoked_at||fresh.public_token!==proposal.public_token){
    result={status:"paused" as const,providerId:null,detail:"A proposta mudou após a revisão. Nenhuma mensagem foi tentada."};
  }else{
    let expiresAt;
    try { expiresAt=preparation?.expiresAt || botSendExpiry(claim.send.created_at,fresh.public_token_expires_at); }
    catch { expiresAt=""; }
    result=await dispatchProtectedBot(destination,message,{id:claim.send.id,contextId:proposal.id,revision:Number(proposal.revision),purpose:"event_proposal",expiresAt,attempt:Number(claim.send.attempts)||1});
  }
  await finishSend(worker,claim.send.id,result.status,result.providerId,result.detail);
  return jsonResponse({ok:result.status==="accepted",sendId:claim.send.id,deliveryStatus:result.status,message:result.detail},result.status==="accepted"?200:result.status==="failed"?502:409);
 } catch { return jsonResponse({ok:false,message:"Operação não confirmada. Confira o histórico antes de repetir."},503); }
});
