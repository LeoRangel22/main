// Shared transport for manager approval notices, watchdog alerts and controlled probes.
// Callers resolve destinations from private configuration, never from browser inputs.
import { dispatchProtectedBot } from './bot-dispatch.ts';
const noticeText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const noticeEscape = (v: unknown) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
function noticeEnv(names: string[]) { for (const n of names) { const v = noticeText(Deno.env.get(n)); if (v) return v; } return ""; }
export async function deliverManagerNotice(channel: string, destination: string, body: string, subject: string, link: string, reference: string, botContext?: any) {
  let attempted = false;
  try {
    const url = new URL(link);
    if (url.origin !== "https://leorangel22.github.io" || url.pathname !== "/main/aprovacoes.html") throw Error("Link interno inválido.");
    let endpoint: string, headers: Record<string,string>, payload: unknown;
    if (channel === "whatsapp") {
      if(!botContext)return {status:'paused',providerId:null,detail:'Aviso sem contexto autorizado. Nenhuma mensagem foi tentada.'};
      return await dispatchProtectedBot(destination,body,botContext);
    } else if (channel === "email") {
      let token = noticeEnv(["ZEPTO_MAIL_TOKEN","ZEPTOMAIL_TOKEN","ZEPTO_TOKEN","ZOHO_ZEPTO_TOKEN","ZOHO_ZEPTOMAIL_TOKEN"]);
      const sender = noticeEnv(["PROPOSAL_FROM_EMAIL","LEAD_ALERT_FROM_EMAIL"]);
      if (!token || !sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) throw Error("Configuração do aviso de e-mail incompleta.");
      token = token.replace(/^authorization:\s*/i, "").replace(/^token de envio\s*\d*\s*:\s*/i, "").replace(/^["']+|["']+$/g, "");
      if (!/^zoho-enczapikey /i.test(token)) token = "Zoho-enczapikey " + token;
      endpoint = "https://api.zeptomail.com/v1.1/email";
      headers = { "Content-Type": "application/json", Authorization: token };
      payload = { client_reference: reference, from: { address: sender, name: "Aprovações · Embaixada Carioca" }, to: [{ email_address: { address: destination } }], subject,
        textbody: body, htmlbody: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#183a2d"><h1 style="font-size:24px">${noticeEscape(subject)}</h1><p style="white-space:pre-wrap;line-height:1.6">${noticeEscape(body)}</p><a style="display:block;padding:16px;background:#183a2d;color:white;text-align:center;border-radius:8px" href="${noticeEscape(link)}">Abrir central de aprovações</a></div>` };
    } else throw Error("Canal de aviso inválido.");
    attempted = true;
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
    let data: any = null; try { data = await response.json(); } catch { /* not evidence of acceptance */ }
    const providerId = noticeText(data?.messageId || data?.zaapId || data?.request_id || data?.id) || null;
    const status = response.ok && providerId ? "accepted" : response.status >= 400 && response.status < 500 ? "failed" : "uncertain";
    return {status,providerId,detail:status === "accepted" ? "Aceito pelo provedor; entrega não confirmada." : `Aviso ${status === "failed" ? "recusado" : "com resultado incerto"} (HTTP ${response.status}).`};
  } catch (error) {
    return {status:attempted ? "uncertain" : "failed",providerId:null,detail:attempted ? "Resultado incerto. Não repetir sem conferir o provedor." : String((error as Error).message)};
  }
}
