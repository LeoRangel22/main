import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function claimSend(supabase: any, proposal: any, payload: any, channel: string, destination: string, body: string, title: string) {
  if (payload.approved !== true) throw new Error("Revise e aprove conteúdo e destinatário antes do envio.");
  const url = new URL(String(payload.proposalUrl || ""));
  if (url.origin !== "https://leorangel22.github.io" || url.pathname !== "/main/proposta.html" || url.searchParams.get("p") !== proposal.public_token) throw new Error("O link precisa corresponder à versão aprovada.");
  if (proposal.public_token_revoked_at || (proposal.public_token_expires_at && new Date(proposal.public_token_expires_at).getTime() < Date.now())) throw new Error("Renove o link público antes de enviar.");
  const { data, error } = await supabase.rpc("begin_event_send", { target_proposal: proposal.id, send_channel: channel, send_destination: destination, send_body: body, send_title: title, reviewed_response_at: payload.reviewedResponseAt || null });
  if (error) throw new Error(error.message || "Não foi possível registrar a aprovação.");
  return data;
}
export function createSendWorker() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Registro interno de envios indisponível.");
  return createClient(Deno.env.get("SUPABASE_URL") || "", key, { auth: { persistSession: false } });
}
export async function finishSend(worker: any, id: string, status: "accepted" | "failed" | "uncertain", providerId: string | null = null, detail: string | null = null) {
  const { error } = await worker.rpc("finish_event_send", { send_id: id, send_status: status, external_message_id: providerId, error_detail: detail });
  if (error) throw new Error("O resultado não foi registrado. Confira o provedor antes de repetir o envio.");
  // A receipt can arrive before the provider HTTP response. Reconcile after commit.
  const { error: receiptError } = await worker.rpc("reconcile_event_receipts", { target_send: id });
  if (receiptError) console.error("Conciliação de retorno pendente");
}
export function duplicateResult(claim: any) {
  const ok=claim.send.status === "accepted" || ["delivered","read"].includes(claim.send.delivery_status);
  return { ok, duplicate: true, sendId: claim.send.id, deliveryStatus: claim.send.delivery_status || claim.send.status, message: ok ? "Este conteúdo já foi aceito ou entregue pelo canal. Nenhum novo envio foi feito." : "Envio em andamento ou incerto. Confira o canal antes de tentar novamente." };
}
