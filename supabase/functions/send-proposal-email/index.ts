import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendPayload = {
  dryRun?: boolean;
  proposalId?: string;
  email?: string;
  proposalUrl?: string;
  title?: string;
  message?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeText(value: unknown, fallback = "") {
  return String(value || fallback).trim();
}

function escapeHtml(value: unknown) {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDate(value: unknown, en = false) {
  const raw = safeText(value);
  if (!raw) return en ? "To be confirmed" : "A definir";
  const date = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(en ? "en-US" : "pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value: unknown, en = false) {
  const raw = safeText(value);
  return raw ? raw.slice(0, 5) : en ? "To be confirmed" : "A definir";
}

function formatDuration(value: unknown, en = false) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return en ? "To be confirmed" : "A definir";
  const hours = Math.floor(number);
  const minutes = Math.round((number - hours) * 60);
  if (!hours && minutes) return `${minutes} min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

const ZEPTO_TOKEN_ENV_NAMES = [
  "ZEPTO_MAIL_TOKEN",
  "ZEPTOMAIL_TOKEN",
  "ZEPTO_TOKEN",
  "ZOHO_ZEPTO_TOKEN",
  "ZOHO_ZEPTOMAIL_TOKEN",
];

function getFirstEnv(names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim()) return { name, value: value.trim() };
  }
  return { name: "", value: "" };
}

function normalizeToken(rawToken: string) {
  const normalized = rawToken
    .trim()
    .replace(/^authorization:\s*/i, "")
    .replace(/^token de envio:\s*/i, "")
    .replace(/^token de envio\s*\d*\s*:\s*/i, "")
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "");

  return normalized.toLowerCase().startsWith("zoho-enczapikey ")
    ? normalized
    : `Zoho-enczapikey ${normalized}`;
}

function getZeptoAuth() {
  const tokenEnv = getFirstEnv(ZEPTO_TOKEN_ENV_NAMES);
  return {
    envName: tokenEnv.name,
    token: tokenEnv.value,
    authorization: tokenEnv.value ? normalizeToken(tokenEnv.value) : "",
  };
}

function getZeptoErrorMessage(status: number) {
  if (status === 401) {
    return "ZeptoMail recusou o envio (HTTP 401). Atualize o secret ZEPTO_MAIL_TOKEN com o token de envio do ZeptoMail e publique a função send-proposal-email novamente.";
  }
  if (status === 403) {
    return "ZeptoMail recusou o envio (HTTP 403). Confira se o remetente está verificado no ZeptoMail.";
  }
  return `ZeptoMail recusou o envio (HTTP ${status}).`;
}

function getSignalDeadlineLabel(snapshot: Record<string, any>, en = false) {
  const hours = Number(snapshot?.event?.signalDeadlineHours || snapshot?.signalDeadlineHours || snapshot?.prazoSinalHoras || 48);
  if (!Number.isFinite(hours) || hours <= 0) return en ? "Deposit due within 2 days" : "Prazo do sinal: 2 dias";
  if (hours < 24) return en ? `Deposit due within ${hours}h` : `Prazo do sinal: ${hours}h`;
  const days = Math.round(hours / 24);
  return en ? `Deposit due within ${days} ${days === 1 ? "day" : "days"}` : `Prazo do sinal: ${days} ${days === 1 ? "dia" : "dias"}`;
}

function getItemsHtml(items: any[]) {
  if (!items.length) {
    return `<p style="margin:0; color:#5d6d64;">Itens em revisão pela equipe.</p>`;
  }

  return items
    .map((item) => {
      const name = escapeHtml(item?.name || item?.nome || "Item");
      const description = escapeHtml(item?.description || item?.descricao || "");
      const total = formatMoney(item?.calc?.total || item?.total || 0);
      return `
        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #d9dfd8;">
            <strong style="display:block; color:#183a2d; font-size:15px;">${name}</strong>
            ${description ? `<span style="display:block; margin-top:4px; color:#5d6d64; font-size:13px; line-height:1.5;">${description}</span>` : ""}
          </td>
          <td style="padding:14px 0; border-bottom:1px solid #d9dfd8; text-align:right; color:#183a2d; font-size:15px; font-weight:800; white-space:nowrap;">${total}</td>
        </tr>
      `;
    })
    .join("");
}

function formatCustomMessageHtml(message: string) {
  return safeText(message)
    .split(/\n{2,}/)
    .map((block) => escapeHtml(block).replaceAll("\n", "<br />"))
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px; color:#31483d; font-size:15px; line-height:1.65;">${paragraph}</p>`,
    )
    .join("");
}

function buildProposalEmailHtml(proposal: any, proposalUrl: string, customMessage = "") {
  const snapshot = proposal?.snapshot || {};
  const en = snapshot?.event?.clientLanguage === "en";
  const t = (pt: string, english: string) => en ? english : pt;
  const clientName = safeText(proposal?.cliente_nome || snapshot?.client?.name, "cliente");
  const firstName = clientName.split(/\s+/)[0] || "tudo";
  const eventType = safeText(proposal?.tipo_evento || snapshot?.event?.type, "Evento");
  const guests = proposal?.convidados || snapshot?.event?.guests || 0;
  const total = proposal?.total || snapshot?.totals?.total || 0;
  const items = Array.isArray(snapshot?.selectedItems) ? snapshot.selectedItems : [];
  const dateLabel = formatDate(proposal?.data_evento || snapshot?.event?.date, en);
  const timeLabel = formatTime(proposal?.horario_evento || snapshot?.event?.time, en);
  const durationLabel = formatDuration(proposal?.duracao || snapshot?.event?.duration, en);
  const signalLabel = getSignalDeadlineLabel(snapshot, en);
  const customMessageHtml = formatCustomMessageHtml(customMessage);

  return `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(eventType)} · ${escapeHtml(dateLabel)} ${t("às", "at")} ${escapeHtml(timeLabel)} · ${formatMoney(total)}. ${t("Veja e responda sua proposta.", "View and respond to your proposal.")}</div>
    <div style="background:#eef3ef; padding:12px 8px; font-family:Arial,Helvetica,sans-serif; color:#183a2d;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #d7e3dc; border-radius:14px; overflow:hidden;">
        <div style="background:#183a2d; color:#ffffff; padding:18px 22px;">
          <div style="font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#f2d9a2;">Embaixada Carioca</div>
          <h1 style="margin:6px 0 0; font-size:24px; line-height:1.2;">${t("Sua proposta de evento", "Your event proposal")}</h1>
          <p style="margin:7px 0 0; color:#e8f1ec; font-size:14px; line-height:1.4;">${t("Olá", "Hello")}, ${escapeHtml(firstName)}. ${t("Confira os dados e responda pelo link.", "Review the details and respond through the link.")}</p>
        </div>

        <div style="padding:16px 22px 24px;">
          <div style="background:#f1e6c9; border-radius:10px; padding:14px 16px;">
            <strong style="display:block; color:#183a2d; font-size:17px; line-height:1.3;">${escapeHtml(eventType)}</strong>
            <span style="display:block; margin-top:4px; color:#335d4a; font-size:14px; line-height:1.35;">${escapeHtml(dateLabel)} ${t("às", "at")} ${escapeHtml(timeLabel)} · ${escapeHtml(String(guests || t("A definir", "TBC")))} ${t("pax", "guests")} · ${escapeHtml(durationLabel)}</span>
            <span style="display:block; margin-top:10px; color:#335d4a; font-size:11px; font-weight:800; text-transform:uppercase;">${t("Total estimado", "Estimated total")}</span>
            <strong style="display:block; margin-top:3px; color:#183a2d; font-size:28px; line-height:1.1;">${formatMoney(total)}</strong>
            <span style="display:block; margin-top:3px; color:#5d6d64; font-size:12px;">${t("Taxa de serviço incluída conforme proposta.", "Service charge included as detailed in the proposal.")}</span>
          </div>

          <a href="${escapeHtml(proposalUrl)}" style="display:block; text-align:center; background:#183a2d; color:#ffffff; text-decoration:none; font-weight:800; font-size:16px; padding:14px 18px; border-radius:9px; margin:14px 0 20px;">
            ${t("Ver e responder proposta", "View and respond to proposal")}
          </a>

          <div style="border-top:1px solid #d7e3dc; padding-top:18px; color:#335d4a; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.06em;">${t("Itens da proposta", "Proposal items")}</div>

          <table role="presentation" style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            ${getItemsHtml(items)}
          </table>

          <div style="background:#f7faf8; border:1px solid #d7e3dc; border-radius:14px; padding:16px 18px; margin-bottom:20px;">
            <strong style="display:block; color:#183a2d; font-size:16px;">${escapeHtml(signalLabel)}</strong>
            <p style="margin:8px 0 0; color:#5d6d64; font-size:14px; line-height:1.6;">
              ${t("Pelo link você pode aprovar, solicitar ajustes ou anexar o comprovante do sinal. A data fica reservada após validação da equipe e confirmação do sinal.", "Through the link you can approve, request changes or upload your deposit receipt. The date is reserved after our team verifies the deposit.")}
              ${t("Se responder este e-mail, sua mensagem chega à equipe de eventos.", "You may also reply to this email to reach our events team.")}
            </p>
          </div>

          ${
            customMessageHtml
              ? `<div style="margin:20px 0 0; background:#fbf7ed; border:1px solid #ead9af; border-radius:14px; padding:16px 18px;">
                  <strong style="display:block; color:#183a2d; font-size:15px; margin-bottom:10px;">${t("Mensagem da equipe", "Message from our team")}</strong>
                  ${customMessageHtml}
                </div>`
              : ""
          }

          <p style="margin:16px 0 0; color:#5d6d64; font-size:13px; line-height:1.6;">
            ${t("Para esclarecer algum detalhe, fale com a equipe por", "For any questions, contact our team at")} <a href="mailto:eventos@embaixadacarioca.com.br">eventos@embaixadacarioca.com.br</a> ${t("ou pelo", "or on")} <a href="https://wa.me/5521971426007">WhatsApp (21) 97142-6007</a>.
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildProposalEmailText(proposal: any, proposalUrl: string, customMessage = "") {
  const snapshot = proposal?.snapshot || {};
  const en = snapshot?.event?.clientLanguage === "en";
  const t = (pt: string, english: string) => en ? english : pt;
  const eventType = safeText(proposal?.tipo_evento || snapshot?.event?.type, "Evento");
  const total = formatMoney(proposal?.total || snapshot?.totals?.total || 0);
  return [
    t("Sua proposta da Embaixada Carioca está pronta para revisão.", "Your Embaixada Carioca event proposal is ready for review."),
    "",
    `${t("Formato", "Format")}: ${eventType}`,
    `${t("Data", "Date")}: ${formatDate(proposal?.data_evento || snapshot?.event?.date, en)}`,
    `${t("Horário", "Time")}: ${formatTime(proposal?.horario_evento || snapshot?.event?.time, en)}`,
    `${t("Convidados", "Guests")}: ${proposal?.convidados || snapshot?.event?.guests || t("A definir", "TBC")}`,
    `${t("Total estimado", "Estimated total")}: ${total}`,
    `${getSignalDeadlineLabel(snapshot, en)}.`,
    "",
    t("Abra sua proposta pelo link abaixo:", "Open your proposal at the link below:"),
    proposalUrl,
    "",
    ...(safeText(customMessage) ? [t("Mensagem da equipe:", "Message from our team:"), safeText(customMessage), ""] : []),
    t("Pelo link você pode aprovar, pedir ajustes ou anexar o comprovante do sinal.", "Through the link you can approve, request changes or upload your deposit receipt."),
    t("A data e o horário ficam reservados após validação da equipe e confirmação do sinal.", "The date is reserved after our team verifies the deposit."),
    t("Você também pode responder este e-mail para falar com a equipe.", "You can also reply to this email to reach our team."),
    "",
    "Equipe de Eventos | Embaixada Carioca",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "Método não permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const zeptoAuth = getZeptoAuth();
    const fromEmail = Deno.env.get("PROPOSAL_FROM_EMAIL") || Deno.env.get("LEAD_ALERT_FROM_EMAIL") || "";
    const fromName = Deno.env.get("PROPOSAL_FROM_NAME") || Deno.env.get("LEAD_ALERT_FROM_NAME") || "Eventos Embaixada";

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ ok: false, message: "Supabase não configurado na função." }, 500);
    }

    if (!zeptoAuth.token || !fromEmail) {
      return jsonResponse(
        {
          ok: false,
          message: "E-mail nao configurado. Defina ZEPTO_MAIL_TOKEN e LEAD_ALERT_FROM_EMAIL nos secrets do Supabase.",
          configured: {
            token: Boolean(zeptoAuth.token),
            tokenSecret: zeptoAuth.envName || null,
            fromEmail: Boolean(fromEmail),
          },
        },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ ok: false, message: "Entre com o e-mail autorizado da equipe para enviar e-mail." }, 401);
    }

    const payload = (await req.json()) as SendPayload;

    if (payload.dryRun) {
      return jsonResponse({
        ok: true,
        mode: "dry-run",
        message: "ZeptoMail configurado para envio de propostas.",
        configured: {
          token: Boolean(zeptoAuth.token),
          tokenSecret: zeptoAuth.envName || null,
          fromEmail: Boolean(fromEmail),
        },
      });
    }

    if (!payload.proposalId) {
      return jsonResponse({ ok: false, message: "Proposta não informada." }, 400);
    }

    const { data: proposal, error: proposalError } = await supabase
      .from("propostas")
      .select("*")
      .eq("id", payload.proposalId)
      .single();

    if (proposalError || !proposal) {
      return jsonResponse({ ok: false, message: "Proposta não encontrada ou sem permissão." }, 404);
    }

    const email = safeText(payload.email || proposal.cliente_email || proposal.snapshot?.client?.email);
    if (!email || !email.includes("@")) {
      return jsonResponse({ ok: false, message: "E-mail do cliente inválido ou ausente." }, 400);
    }

    const proposalUrl = safeText(payload.proposalUrl);
    if (!proposalUrl) {
      return jsonResponse({ ok: false, message: "Link público da proposta não informado." }, 400);
    }

    const firstName = safeText(proposal.cliente_nome || proposal.snapshot?.client?.name, "cliente").split(/\s+/)[0] || "cliente";
    const subject = payload.title || `Sua proposta de evento na Embaixada Carioca`;
    const zeptoResponse = await fetch("https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: zeptoAuth.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          address: fromEmail,
          name: fromName,
        },
        to: [
          {
            email_address: {
              address: email,
              name: proposal.cliente_nome || firstName,
            },
          },
        ],
        subject,
        htmlbody: buildProposalEmailHtml(proposal, proposalUrl, payload.message),
        textbody: buildProposalEmailText(proposal, proposalUrl, payload.message),
        reply_to: [
          {
            address: Deno.env.get("PROPOSAL_REPLY_TO_EMAIL") || "eventos@embaixadacarioca.com.br",
            name: "Eventos Embaixada Carioca",
          },
        ],
      }),
    });

    const rawBody = await zeptoResponse.text();
    let zeptoBody: unknown = rawBody;
    try {
      zeptoBody = JSON.parse(rawBody);
    } catch (_error) {
      zeptoBody = rawBody;
    }

    if (!zeptoResponse.ok) {
      console.error("ZeptoMail proposal error:", zeptoResponse.status, zeptoBody);
      return jsonResponse(
        {
          ok: false,
          message: getZeptoErrorMessage(zeptoResponse.status),
          configured: {
            token: Boolean(zeptoAuth.token),
            tokenSecret: zeptoAuth.envName || null,
            fromEmail: Boolean(fromEmail),
          },
          details: zeptoBody,
        },
        502,
      );
    }

    const sentAt = new Date().toISOString();
    const snapshot = proposal.snapshot || {};
    const historyEntry = {
      id: `email-${Date.now()}`,
      type: "email_envio",
      title: "Proposta enviada por e-mail",
      detail: `Enviada para ${email}.`,
      at: sentAt,
      actor: userData.user.email || "Equipe",
      channel: "zeptomail",
      email,
      proposalUrl,
    };

    const commercialHistory = Array.isArray(snapshot.commercialHistory) ? snapshot.commercialHistory : [];
    const emailSends = Array.isArray(snapshot.emailEnvios) ? snapshot.emailEnvios : [];
    const nextSnapshot = {
      ...snapshot,
      ultimoEnvioEmailEm: sentAt,
      commercialHistory: [historyEntry, ...commercialHistory].slice(0, 50),
      emailEnvios: [
        {
          at: sentAt,
          actor: userData.user.email || "Equipe",
          email,
          title: subject,
          proposalUrl,
        },
        ...emailSends,
      ].slice(0, 20),
    };

    const { error: updateError } = await supabase
      .from("propostas")
      .update({ snapshot: nextSnapshot })
      .eq("id", proposal.id);

    if (updateError) {
      console.error("Falha ao registrar histórico de e-mail:", updateError);
      return jsonResponse({
        ok: true,
        warning: "E-mail enviado, mas o histórico não foi atualizado.",
        email,
        zepto: zeptoBody,
      });
    }

    return jsonResponse({ ok: true, email, zepto: zeptoBody });
  } catch (error) {
    console.error("send-proposal-email fatal:", error);
    return jsonResponse({ ok: false, message: "Erro interno ao enviar e-mail." }, 500);
  }
});
