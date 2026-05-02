type LeadRecord = {
  id?: string
  created_at?: string
  cliente_nome?: string
  cliente_email?: string
  cliente_whatsapp?: string
  empresa?: string
  tipo_evento?: string
  data_evento?: string
  horario_evento?: string
  convidados?: number
  duracao?: number
  motivo_evento?: string
  preferencias?: string
  observacoes?: string
  origem?: string
  status?: string
  snapshot?: Record<string, unknown>
}

type WebhookPayload = {
  dryRun?: boolean
  type?: "INSERT" | "UPDATE" | "DELETE"
  table?: string
  schema?: string
  record?: LeadRecord | null
  old_record?: LeadRecord | null
}

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDate(value?: string | null) {
  if (!value) return "A definir"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatTime(value?: string | null) {
  if (!value) return "A definir"
  return String(value).slice(0, 5)
}

function formatDuration(value?: number | null) {
  if (!value) return "A definir"
  const duration = Number(value)
  if (Number.isNaN(duration)) return String(value)
  const hours = Math.floor(duration)
  const minutes = Math.round((duration - hours) * 60)
  if (!hours && minutes) return `${minutes} min`
  if (!minutes) return `${hours}h`
  return `${hours}h${String(minutes).padStart(2, "0")}`
}

function getDaysUntil(value?: string | null) {
  if (!value) return null
  const today = new Date()
  const target = new Date(`${value}T12:00:00`)
  if (Number.isNaN(target.getTime())) return null

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function getPriorityMeta(record: LeadRecord) {
  const daysUntil = getDaysUntil(record.data_evento)
  const guests = Number(record.convidados || 0)

  if ((daysUntil !== null && daysUntil <= 7) || guests >= 120) {
    return {
      label: "Alta prioridade",
      subjectPrefix: "[ALTA PRIORIDADE]",
      badgeBackground: "#fbe4e2",
      badgeColor: "#9d432f",
      note: "Vale abordar rápido. A data está próxima ou o volume do grupo é alto.",
    }
  }

  if ((daysUntil !== null && daysUntil <= 21) || guests >= 60) {
    return {
      label: "Atenção comercial",
      subjectPrefix: "[ATENÇÃO]",
      badgeBackground: "#fff2d8",
      badgeColor: "#8a5a00",
      note: "Boa oportunidade para retorno ágil enquanto o lead ainda está quente.",
    }
  }

  return {
    label: "Novo lead",
    subjectPrefix: "[NOVO LEAD]",
    badgeBackground: "#e7f2ec",
    badgeColor: "#1d5d3f",
    note: "Lead novo no funil. Ideal qualificar e responder em até 2 dias úteis.",
  }
}

function getEmailSubject(record: LeadRecord) {
  const priority = getPriorityMeta(record)
  const eventType = record.tipo_evento || "Evento"
  const guests = record.convidados ? `${record.convidados} pax` : "Pax a definir"
  const eventDate = formatDate(record.data_evento)
  return `${priority.subjectPrefix} ${eventType} | ${guests} | ${eventDate} | ${record.cliente_nome || "Cliente"}`
}

function buildDashboardUrl(record: LeadRecord) {
  const baseUrl = Deno.env.get("APP_BASE_URL")?.trim()
  if (!baseUrl) return ""

  const url = new URL(baseUrl)
  if (record.id) {
    url.hash = `lead=${record.id}`
  }
  return url.toString()
}

function buildEmailHtml(record: LeadRecord) {
  const dashboardUrl = buildDashboardUrl(record)
  const snapshot = record.snapshot ?? {}
  const qualificacao = (snapshot as { qualificacao?: Record<string, string> }).qualificacao ?? {}
  const cliente = (snapshot as { cliente?: Record<string, string> }).cliente ?? {}
  const priority = getPriorityMeta(record)
  const guestCount = record.convidados ? `${record.convidados} pax` : "Pax a definir"
  const dateLabel = formatDate(record.data_evento)
  const timeLabel = formatTime(record.horario_evento)
  const durationLabel = formatDuration(record.duracao)
  const companyLabel = record.empresa || cliente.empresa || "Não informada"
  const contactRows = [
    ["Cliente", record.cliente_nome || "Sem nome"],
    ["Empresa", companyLabel],
    ["E-mail", record.cliente_email || cliente.email || "Não informado"],
    ["Celular/Whatsapp", record.cliente_whatsapp || cliente.whatsapp || "Não informado"],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0; color:#6b7280; font-size:13px; font-weight:700; vertical-align:top; width:160px;">${escapeHtml(label)}</td>
          <td style="padding:8px 0; color:#183a2d; font-size:15px; font-weight:800;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("")
  const eventRows = [
    ["Formato", record.tipo_evento || "A definir"],
    ["Data", dateLabel],
    ["Horário", timeLabel],
    ["Convidados", guestCount],
    ["Duração", durationLabel],
    ["Faixa de investimento", qualificacao.faixaInvestimento || "Não informada"],
    ["Origem", qualificacao.origem || record.origem || "Formulário"],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0; color:#6b7280; font-size:13px; font-weight:700; vertical-align:top; width:160px;">${escapeHtml(label)}</td>
          <td style="padding:8px 0; color:#183a2d; font-size:15px; font-weight:800;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("")

  return `
    <div style="background:#eef3ef; padding:28px 16px; font-family:Arial,Helvetica,sans-serif; color:#183a2d;">
      <div style="max-width:680px; margin:0 auto; background:#ffffff; border:1px solid #d7e3dc; border-radius:18px; overflow:hidden;">
        <div style="background:#183a2d; color:#ffffff; padding:24px 28px;">
          <div style="font-size:12px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#f2d9a2;">Embaixada Carioca</div>
          <h1 style="margin:10px 0 0; font-size:32px; line-height:1.08;">Novo lead de evento</h1>
          <p style="margin:12px 0 0; font-size:16px; line-height:1.55; color:#e8f1ec;">
            Entrou uma nova solicitação pelo formulário externo. Vale fazer o primeiro contato enquanto o interesse está quente.
          </p>
        </div>

        <div style="padding:24px 28px 28px;">
          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px;">
            <span style="display:inline-flex; align-items:center; min-height:34px; padding:0 14px; border-radius:999px; background:${priority.badgeBackground}; color:${priority.badgeColor}; font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.04em;">
              ${escapeHtml(priority.label)}
            </span>
            <span style="display:inline-flex; align-items:center; min-height:34px; padding:0 14px; border-radius:999px; background:#edf4ef; color:#183a2d; font-size:12px; font-weight:900;">
              ${escapeHtml(record.tipo_evento || "Evento a definir")}
            </span>
            <span style="display:inline-flex; align-items:center; min-height:34px; padding:0 14px; border-radius:999px; background:#edf4ef; color:#183a2d; font-size:12px; font-weight:900;">
              ${escapeHtml(guestCount)}
            </span>
          </div>

          <div style="margin-bottom:18px; border:1px solid #d7e3dc; border-radius:14px; overflow:hidden;">
            <div style="background:#f7faf8; padding:14px 18px; border-bottom:1px solid #d7e3dc;">
              <div style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:#335d4a;">Resumo para ação rápida</div>
            </div>
            <div style="padding:18px;">
              <table role="presentation" style="width:100%; border-collapse:collapse;">
                <tr>
                  <td style="padding:0 8px 12px 0; width:33.33%; vertical-align:top;">
                    <div style="border:1px solid #d7e3dc; border-radius:12px; padding:14px;">
                      <div style="font-size:11px; font-weight:900; text-transform:uppercase; color:#6b7280;">Cliente</div>
                      <div style="margin-top:8px; font-size:20px; line-height:1.2; font-weight:900; color:#183a2d;">${escapeHtml(record.cliente_nome || "Sem nome")}</div>
                      <div style="margin-top:6px; font-size:13px; line-height:1.5; color:#5a6c63;">${escapeHtml(companyLabel)}</div>
                    </div>
                  </td>
                  <td style="padding:0 8px 12px; width:33.33%; vertical-align:top;">
                    <div style="border:1px solid #d7e3dc; border-radius:12px; padding:14px;">
                      <div style="font-size:11px; font-weight:900; text-transform:uppercase; color:#6b7280;">Data e horário</div>
                      <div style="margin-top:8px; font-size:20px; line-height:1.2; font-weight:900; color:#183a2d;">${escapeHtml(dateLabel)}</div>
                      <div style="margin-top:6px; font-size:15px; line-height:1.5; color:#183a2d; font-weight:800;">${escapeHtml(timeLabel)}</div>
                    </div>
                  </td>
                  <td style="padding:0 0 12px 8px; width:33.33%; vertical-align:top;">
                    <div style="border:1px solid #d7e3dc; border-radius:12px; padding:14px;">
                      <div style="font-size:11px; font-weight:900; text-transform:uppercase; color:#6b7280;">Investimento</div>
                      <div style="margin-top:8px; font-size:20px; line-height:1.2; font-weight:900; color:#183a2d;">${escapeHtml(qualificacao.faixaInvestimento || "Não informado")}</div>
                      <div style="margin-top:6px; font-size:13px; line-height:1.5; color:#5a6c63;">${escapeHtml(guestCount)} · ${escapeHtml(durationLabel)}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>

          <div style="margin-bottom:18px; background:#f7faf8; border:1px solid #d7e3dc; border-radius:14px; padding:16px 18px;">
            <div style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:#335d4a;">Próximo passo recomendado</div>
            <div style="margin-top:8px; color:#183a2d; font-size:15px; line-height:1.65;">${escapeHtml(priority.note)}</div>
          </div>

          ${
            dashboardUrl
              ? `<div style="margin-bottom:22px;">
                  <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block; background:#183a2d; color:#ffffff; text-decoration:none; font-weight:800; font-size:15px; padding:14px 20px; border-radius:10px;">
                    Abrir lead no sistema
                  </a>
                  <div style="margin-top:8px; color:#6b7280; font-size:12px; line-height:1.5;">
                    O link abre o lead já carregado no dashboard para qualificação e proposta.
                  </div>
                </div>`
              : ""
          }

          <div style="margin-bottom:18px; border:1px solid #d7e3dc; border-radius:14px; overflow:hidden;">
            <div style="background:#f7faf8; padding:14px 18px; border-bottom:1px solid #d7e3dc;">
              <div style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:#335d4a;">Contato</div>
            </div>
            <div style="padding:10px 18px 14px;">
              <table role="presentation" style="width:100%; border-collapse:collapse;">${contactRows}</table>
            </div>
          </div>

          <div style="margin-bottom:18px; border:1px solid #d7e3dc; border-radius:14px; overflow:hidden;">
            <div style="background:#f7faf8; padding:14px 18px; border-bottom:1px solid #d7e3dc;">
              <div style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:#335d4a;">Evento e contexto comercial</div>
            </div>
            <div style="padding:10px 18px 14px;">
              <table role="presentation" style="width:100%; border-collapse:collapse;">${eventRows}</table>
            </div>
          </div>

          ${
            record.motivo_evento
              ? `<div style="margin-top:18px; border:1px solid #d7e3dc; border-radius:14px; padding:16px 18px;">
                  <div style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:#335d4a;">Objetivo do evento</div>
                  <div style="margin-top:8px; color:#183a2d; font-size:15px; line-height:1.7;">${escapeHtml(record.motivo_evento)}</div>
                </div>`
              : ""
          }

          ${
            record.preferencias
              ? `<div style="margin-top:18px; border:1px solid #d7e3dc; border-radius:14px; padding:16px 18px;">
                  <div style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:#335d4a;">Preferências de alimentos e bebidas</div>
                  <div style="margin-top:8px; color:#183a2d; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(record.preferencias)}</div>
                </div>`
              : ""
          }

          ${
            record.observacoes
              ? `<div style="margin-top:18px; border:1px solid #d7e3dc; border-radius:14px; padding:16px 18px;">
                  <div style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; color:#335d4a;">Briefing e observações</div>
                  <div style="margin-top:8px; color:#183a2d; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(record.observacoes)}</div>
                </div>`
              : ""
          }
        </div>
      </div>
    </div>
  `
}

function buildEmailText(record: LeadRecord) {
  const snapshot = record.snapshot ?? {}
  const qualificacao = (snapshot as { qualificacao?: Record<string, string> }).qualificacao ?? {}
  const dashboardUrl = buildDashboardUrl(record)
  const priority = getPriorityMeta(record)

  return [
    "Novo lead de evento - Embaixada Carioca",
    "",
    `Prioridade: ${priority.label}`,
    `Cliente: ${record.cliente_nome || "Sem nome"}`,
    `Empresa: ${record.empresa || "Não informada"}`,
    `E-mail: ${record.cliente_email || "Não informado"}`,
    `Celular/Whatsapp: ${record.cliente_whatsapp || "Não informado"}`,
    `Tipo de evento: ${record.tipo_evento || "A definir"}`,
    `Data: ${formatDate(record.data_evento)}`,
    `Horário: ${formatTime(record.horario_evento)}`,
    `Convidados: ${record.convidados ? `${record.convidados} pax` : "Não informado"}`,
    `Duração: ${formatDuration(record.duracao)}`,
    `Faixa de investimento: ${qualificacao.faixaInvestimento || "Não informada"}`,
    `Origem: ${qualificacao.origem || record.origem || "Formulário"}`,
    "",
    priority.note,
    "",
    record.motivo_evento ? `Motivo: ${record.motivo_evento}` : "",
    record.preferencias ? `Preferências: ${record.preferencias}` : "",
    record.observacoes ? `Observações: ${record.observacoes}` : "",
    dashboardUrl ? `Abrir no sistema: ${dashboardUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

async function sendZeptoEmail(record: LeadRecord) {
  const zeptoTokenRaw = Deno.env.get("ZEPTO_MAIL_TOKEN")
  const fromEmail = Deno.env.get("LEAD_ALERT_FROM_EMAIL")
  const toEmail = Deno.env.get("LEAD_ALERT_TO_EMAIL") || "eventos@embaixadacarioca.com.br"
  const fromName = Deno.env.get("LEAD_ALERT_FROM_NAME") || "Eventos Embaixada"

  if (!zeptoTokenRaw) throw new Error("ZEPTO_MAIL_TOKEN não configurado.")
  if (!fromEmail) throw new Error("LEAD_ALERT_FROM_EMAIL não configurado.")

  const normalizedToken = zeptoTokenRaw
    .trim()
    .replace(/^token de envio:\s*/i, "")
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")

  const authorizationToken = normalizedToken.toLowerCase().startsWith("zoho-enczapikey ")
    ? normalizedToken
    : `Zoho-enczapikey ${normalizedToken}`

  const subject = getEmailSubject(record)

  const zeptoResponse = await fetch("https://api.zeptomail.com/v1.1/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: authorizationToken,
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
            address: toEmail,
            name: "Eventos Embaixada Carioca",
          },
        },
      ],
      subject,
      htmlbody: buildEmailHtml(record),
      textbody: buildEmailText(record),
      reply_to: record.cliente_email
        ? [
            {
              address: record.cliente_email,
              name: record.cliente_nome || "Cliente",
            },
          ]
        : undefined,
    }),
  })

  if (!zeptoResponse.ok) {
    const errorBody = await zeptoResponse.text()
    throw new Error(`Falha ao enviar com ZeptoMail: ${zeptoResponse.status} ${errorBody}`)
  }

  return await zeptoResponse.json()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: jsonHeaders })
  }

  if (req.method !== "POST") {
    return response({ ok: false, error: "Method not allowed" }, 405)
  }

  let payload: WebhookPayload
  try {
    payload = (await req.json()) as WebhookPayload
  } catch (_error) {
    return response({ ok: false, error: "Invalid JSON" }, 400)
  }

  if (payload.dryRun) {
    const zeptoToken = Deno.env.get("ZEPTO_MAIL_TOKEN")
    const fromEmail = Deno.env.get("LEAD_ALERT_FROM_EMAIL")
    const toEmail = Deno.env.get("LEAD_ALERT_TO_EMAIL") || "eventos@embaixadacarioca.com.br"
    return response({
      ok: Boolean(zeptoToken && fromEmail && toEmail),
      mode: "dry-run",
      message: zeptoToken && fromEmail ? "ZeptoMail configurado para alertas de lead." : "Configure ZEPTO_MAIL_TOKEN e LEAD_ALERT_FROM_EMAIL.",
      configured: {
        token: Boolean(zeptoToken),
        fromEmail: Boolean(fromEmail),
        toEmail: Boolean(toEmail),
      },
    })
  }

  const configuredSecret = Deno.env.get("LEAD_WEBHOOK_SECRET")
  if (configuredSecret) {
    const receivedSecret = req.headers.get("x-webhook-secret")
    if (!receivedSecret || receivedSecret !== configuredSecret) {
      return response({ ok: false, error: "Unauthorized" }, 401)
    }
  }

  try {
    if (payload.type !== "INSERT") {
      return response({ ok: true, skipped: true, reason: "Not an insert event" })
    }

    if (payload.table !== "solicitacoes_cotacao") {
      return response({ ok: true, skipped: true, reason: "Not target table" })
    }

    const record = payload.record
    if (!record) {
      return response({ ok: true, skipped: true, reason: "Missing record" })
    }

    await sendZeptoEmail(record)

    return response({
      ok: true,
      message: "Lead notification sent",
      leadId: record.id ?? null,
    })
  } catch (error) {
    console.error("notify-new-lead error", error)
    return response(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
})
