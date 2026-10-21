import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { deliverManagerNotice } from "../_shared/approval-notifications.ts";
import { botNoticeId, botSendExpiry, botDestinationIsCanonical } from "../_shared/bot-dispatch.ts";
import { approvalDispatchCurrent } from "../_shared/dispatch-readiness.ts";

const APPROVAL_SITE = "https://leorangel22.github.io/main/";
const headers = { "Access-Control-Allow-Origin": "https://leorangel22.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const html = (v: unknown) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
function phone(value: unknown) { const n = text(value).replace(/\D/g, ""); return n; }
async function rpc(client: any, name: string, args: any = {}) { const r = await client.rpc(name, args); if (r.error) throw r.error; return r.data; }
async function invoke(url: string, key: string, authorization: string, name: string, body: any) {
  const res = await fetch(`${url}/functions/v1/${name}`, { method: "POST", headers: { Authorization: authorization, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) });
  let result; try { result = await res.json(); } catch { throw Error("Resposta do serviço indisponível. Confira o histórico antes de repetir."); }
  if (!res.ok || result.ok !== true) throw Error(result.message || "A operação não foi confirmada. Confira o histórico.");
  return result;
}
function firstEnv(names: string[]) { for (const n of names) { const v = text(Deno.env.get(n)); if (v) return v; } return ""; }
function notificationText(a: any) {
  const p = a.proposal_snapshot;
  const date = String(p.data_evento || "").split("-").reverse().join("/");
  const total = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(p.total));
  const discount = Math.max(0,-Number(p.snapshot?.totals?.adjustment || 0)) + Math.max(0,-Number(p.snapshot?.totals?.privatizationAdjustment || 0));
  return ["Embaixada Carioca — proposta aguardando sua aprovação", `Cliente: ${p.cliente_nome}`, `Evento: ${date} às ${String(p.horario_evento || "").slice(0,5)} (Brasília)`, `Convidados: ${p.convidados} · Total: ${total}`, `Desconto: R$ ${discount.toFixed(2)}`, `Envio ao cliente: ${a.content.channel}`, `Versão ${p.versao} · revisão ${a.revision}`, "", "Revise a proposta completa e a mensagem antes de decidir:", `${APPROVAL_SITE}aprovacoes.html?id=${a.id}`, "", "Abrir este link não aprova nem envia a proposta. É necessário entrar com sua conta de gestor."].join("\n");
}
async function notify(worker: any, approvalId: string, channel: string) {
  const claimed = await rpc(worker,"event_claim_approval_notification", { target_approval: approvalId, target_channel: channel });
  if (!claimed) return;
  const reference=`APPROVAL:${approvalId}:${channel}`;
  let botContext;
  if(channel==='whatsapp')try{botContext={id:await botNoticeId(reference),contextId:approvalId,revision:Number(claimed.approval.revision),purpose:'event_approval_notice',expiresAt:botSendExpiry(claimed.approval.created_at,claimed.approval.expires_at)};}catch{/* fail closed below */}
  const current=channel!=='whatsapp'||await approvalDispatchCurrent(worker,approvalId,Number(claimed.approval.revision));
  const result = !current ? {status:'paused',providerId:null,detail:'A solicitação mudou. Nenhum aviso foi tentado.'} : await deliverManagerNotice(channel,claimed.destination,notificationText(claimed.approval),
    `Aprovar proposta — ${text(claimed.approval.proposal_snapshot.cliente_nome).slice(0,80)}`,
    `${APPROVAL_SITE}aprovacoes.html?id=${approvalId}`,reference,botContext);
  await rpc(worker,"event_finish_approval_notification", { target_approval: approvalId, target_channel: channel, result_status: result.status, external_id: result.providerId, result_detail: result.detail });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ ok: false, message: "Use uma ação explícita no painel." },405);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "", key = Deno.env.get("SUPABASE_ANON_KEY") || "", serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !key || !serviceKey) return reply({ ok: false, message: "Serviço de aprovação não configurado." },503);
    const authorization = req.headers.get("Authorization") || "";
    const client = createClient(url,key,{ global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const userResult = await client.auth.getUser();
    if (userResult.error || !userResult.data?.user) return reply({ ok: false, message: "Entre com sua conta da equipe." },401);
    if (await rpc(client,"is_team_member") !== true) return reply({ ok: false, message: "Acesso exclusivo da equipe." },403);
    if (Number(req.headers.get("Content-Length") || 0) > 32000) return reply({ ok:false,message:"Solicitação muito grande." },413);
    const raw = await req.text(); if (raw.length > 32000) return reply({ok:false,message:"Solicitação muito grande."},413);
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object") return reply({ok:false,message:"Solicitação inválida."},400);
    const worker = createClient(url,serviceKey,{ auth: { persistSession: false } });
    if (input.action === "request") {
      if (!uuid(input.proposalId) || !Number.isSafeInteger(input.reviewedRevision) || !["email","whatsapp"].includes(input.channel)) return reply({ok:false,message:"Confira a proposta e o canal."},400);
      const { data:p,error } = await client.from("propostas").select("*").eq("id",input.proposalId).single();
      if (error || !p) return reply({ok:false,message:"Proposta não encontrada."},404);
      if (Number(p.revision) !== input.reviewedRevision) return reply({ok:false,message:"A proposta mudou. Salve e revise a versão atual."},409);
      if (!Array.isArray(p.snapshot?.selectedItems) || !p.snapshot.selectedItems.length) return reply({ok:false,message:"Inclua os itens da proposta antes de solicitar aprovação."},400);
      const destination = input.channel === "email" ? text(input.destination || p.cliente_email).toLowerCase() : phone(input.destination || p.cliente_whatsapp);
      if (input.channel === "email" ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination) : !botDestinationIsCanonical(destination)) return reply({ok:false,message:"Revise o destinatário e o WhatsApp completo com DDI e DDD no formato atual; nenhum número será alterado após a aprovação."},400);
      const proposalUrl = `${APPROVAL_SITE}proposta.html?p=${p.public_token}${p.snapshot?.event?.clientLanguage === "en" ? "&lang=en" : ""}`;
      const message = text(input.message), title = text(input.title) || "Proposta comercial";
      if (message.length > 12000 || title.length > 180 || (input.channel === "whatsapp" && (message.length < 10 || message.length > 6000))) return reply({ok:false,message:"Revise a mensagem e o assunto."},400);
      const content: any = { channel: input.channel, destination, message, title, body: message, proposalUrl, contentHash: null, html: "", sender: "WhatsApp automático da Embaixada Carioca", reviewedResponseAt: input.reviewedResponseAt || null };
      if (input.channel === "email") {
        const preview = await invoke(url,key,authorization,"send-proposal-email",{preview:true,proposalId:p.id,reviewedRevision:input.reviewedRevision,email:destination,proposalUrl,message,title});
        if (!/^[a-f0-9]{64}$/.test(preview.contentHash || "") || !preview.html || !preview.text || preview.email !== destination) throw Error("Não foi possível confirmar a prévia completa do e-mail.");
        Object.assign(content,{body:preview.text,html:preview.html,contentHash:preview.contentHash,title:preview.subject,sender:preview.sender});
      }
      const a = await rpc(worker,"event_create_proposal_approval",{target_proposal:p.id,expected_revision:input.reviewedRevision,requester:userResult.data.user.id,prepared_content:content});
      // Both channels reference the SAME approval; requesting again cannot re-notify accepted attempts.
      await Promise.allSettled([notify(worker,a.id,"whatsapp"),notify(worker,a.id,"email")]);
      return reply({ok:true,approval:await rpc(client,"event_get_proposal_approval",{target_approval:a.id})});
    }
    if (!uuid(input.id)) return reply({ok:false,message:"Solicitação inválida."},400);
    if (input.action === "get") return reply({ok:true,approval:await rpc(client,"event_get_proposal_approval",{target_approval:input.id})});
    if (input.action === "notify") {
      await rpc(client,"event_retry_approval_notifications",{target_approval:input.id});
      await Promise.allSettled([notify(worker,input.id,"whatsapp"),notify(worker,input.id,"email")]);
      return reply({ok:true,approval:await rpc(client,"event_get_proposal_approval",{target_approval:input.id})});
    }
    if (["approve","changes_requested","rejected"].includes(input.action)) {
      const a = await rpc(client,"event_decide_proposal_approval",{target_approval:input.id,decision:input.action,reviewed_hash:input.reviewHash,confirmed:input.confirmed === true,decision_reason:text(input.reason)});
      let warning = "";
      if (input.action === "approve" && (!a.send_id || ['failed','paused'].includes(a.send?.status))) {
        const c = a.content;
        try {
          await invoke(url,key,authorization,`send-proposal-${c.channel === "email" ? "email" : "whatsapp"}`,{approvalId:a.id,proposalId:a.proposal_id,approved:true,reviewedRevision:Number(a.revision),reviewedResponseAt:c.reviewedResponseAt,email:c.destination,phone:c.destination,proposalUrl:c.proposalUrl,title:c.title,message:c.message,reviewedContentHash:c.contentHash});
        } catch(e) { warning = String((e as Error).message || "Confira o histórico antes de repetir."); }
      }
      return reply({ok:true,warning,approval:await rpc(client,"event_get_proposal_approval",{target_approval:input.id})});
    }
    return reply({ok:false,message:"Ação não permitida."},400);
  } catch(e) {
    const error = e as any;
    return reply({ok:false,message:error.code === "42501" ? "Somente o gestor designado pode liberar esta proposta." : error.message || "Não foi possível concluir. Confira o histórico antes de repetir."},error.code === "42501" ? 403 : 409);
  }
});
