import { botContentHash, botDestinationIsCanonical } from "./bot-dispatch.ts";

// Read-only plan; deliberately never calls begin_*, a worker or the Bot.
export async function prepareWhatsApp(caller: any, proposal: any, payload: any, destination: string, body: string, title: string) {
  if (payload.approved !== true || !Number.isSafeInteger(payload.reviewedRevision) || payload.reviewedRevision !== Number(proposal.revision))
    throw Error("Revise a versão, o conteúdo e o destinatário antes de preparar.");
  const link = new URL(String(payload.proposalUrl || ""));
  if (link.origin !== "https://leorangel22.github.io" || link.pathname !== "/main/proposta.html" || link.searchParams.get("p") !== proposal.public_token)
    throw Error("O link precisa corresponder à versão revisada.");
  if (!botDestinationIsCanonical(destination) || body.length < 10 || body.length > 6000)
    throw Error("Confira a mensagem e o destinatário canônico.");
  const expiresAt = payload.preparation?.expiresAt || payload.preparationExpiresAt;
  if (typeof expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiresAt) || !Number.isFinite(Date.parse(expiresAt)))
    throw Error("Informe o prazo explícito da preparação em UTC.");
  const args = {target_proposal:proposal.id,reviewed_revision:payload.reviewedRevision,send_destination:destination,send_body:body,send_title:title,
    reviewed_response_at:payload.reviewedResponseAt || null,target_approval:payload.approvalId || null,prepared_expires_at:expiresAt};
  const {data:plan,error} = await caller.rpc("event_whatsapp_preparation",args);
  if(error || !plan) throw Error(error?.message || "Preparação não confirmada.");
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(plan.id || "") || !/^[0-9a-f]{64}$/.test(plan.fingerprint || "") || typeof plan.claimable !== "boolean" || plan.contextId !== proposal.id || plan.revision !== payload.reviewedRevision || plan.destination !== destination || plan.body !== body || plan.expiresAt !== expiresAt || plan.purpose !== "event_proposal")
    throw Error("A preparação diverge do conteúdo revisado.");
  const contentHash = await botContentHash(destination,body,plan);
  if(payload.preparation && (payload.preparation.id !== plan.id || payload.preparation.contentHash !== contentHash || payload.preparation.reviewFingerprint !== plan.fingerprint))
    throw Error("A preparação mudou. Confira novamente antes de enviar.");
  return {...plan,contentHash,args};
}

// Explicit send action only, after transport gate and a matching read-only plan.
export async function claimPreparedWhatsApp(caller: any, plan: any) {
  const {data,error}=await caller.rpc("begin_event_prepared_whatsapp_send",{...plan.args,expected_send_id:plan.id,expected_fingerprint:plan.fingerprint});
  if(error || !data) throw Error(error?.message || "Não foi possível confirmar a preparação.");
  return data;
}

export function publicWhatsAppPreparation(plan: any) {
  return {version:2,account:"bot:embaixada_urca",tenant:"embaixada_urca",id:plan.id,contextId:plan.contextId,revision:plan.revision,
    purpose:plan.purpose,destination:plan.destination,body:plan.body,expiresAt:plan.expiresAt,contentHash:plan.contentHash,
    reviewFingerprint:plan.fingerprint,existingStatus:plan.existingStatus,claimable:plan.claimable,attempted:false};
}
