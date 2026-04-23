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
  type?: "INSERT" | "UPDATE" | "DELETE"
  table?: string
  schema?: string
  record?: LeadRecord | null
  old_record?: LeadRecord | null
}

const jsonHeaders = {
  "Content-Type": "application/json",
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
  const normalized = String(value).replace(".", "h")
  return normalized.endsWith("h0") ? normalized.slice(0, -1) : normalized
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

  const rows = [
    ["Cliente", record.cliente_nome || "Sem nome"],
    ["Empresa", record.empresa || cliente.empresa || "Não informada"],
    ["E-mail", record.cliente_email || cliente.email || "Não informado"],
    ["Celular/Whatsapp", record.cliente_whatsapp || cliente.whatsapp || "Não informado"],
    ["Tipo de evento", record.tipo_evento || "A definir"],
    ["Data", dateLabel],
    ["Horário", timeLabel],
    ["Convidados", guestCount],
    ["Duração", durationLabel],
    ["Faixa de investimento", qualificacao.faixaInvestimento || "Não informada"],
    ["Origem", qualificacao.origem || record.origem || "Formulário"],
  ]

  const details = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0; color:#6b7280; font-weight:700; vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:8px 0; color:#183a2d; font-weight:800;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("")

  return `
    <div style="background:#f7faf8; padding:24px; font-family:Arial,Helvetica,sans-serif; color:#183a2d;">
      <div style="max-width:720px; margin:0 auto; background:#ffffff; border:1px solid #d7e3dc; border-radius:12px; overflow:hidden;">
        <div style="background:#183a2d; color:#ffffff; padding:20px 24px;">
          <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#f2d9a2;">Embaixada Carioca</div>
          <h1 style="margin:8px 0 0; font-size:28px; line-height:1;">Novo lead de evento</h1>
          <p style="margin:10px 0 0; font-size:15px; line-height:1.5; color:#e8f1ec;">
            Entrou uma nova solicitação pelo formulário externo. Vale olhar rápido enquanto o interesse está quente.
          </p>
        </div>

        <div style="padding:24px;">
          <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px;">
            <span style="display:inline-flex; align-items:center; min-height:32px; padding:0 12px; border-radius:999px; background:${priority.badgeBackground}; color:${priority.badgeColor}; font-size:12px; font-weight:900; text-transform:uppercase;">
              ${escapeHtml(priority.label)}
            </span>
            <span style="display:inline-flex; align-items:center; min-height:32px; padding:0 12px; border-radius:999px; background:#edf4ef; color:#183a2d; font-size:12px; font-weight:900;">
              ${escapeHtml(record.tipo_evento || "Evento a definir")}
            </span>
            <span style="display:inline-flex; align-items:center; min-height:32px; padding:0 12px; border-radius:999px; background:#edf4ef; color:#183a2d; font-size:12px; font-weight:900;">
              ${escapeHtml(guestCount)}
            </span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:18px;">
            <div style="border:1px solid #d7e3dc; border-radius:10px; padding:14px;">
              <div style="font-size:11px; font-weight:900; text-transform:uppercase; color:#6b7280;">Cliente</div>
              <div style="margin-top:6px; font-size:18px; font-weight:900; color:#183a2d;">${escapeHtml(record.cliente_nome || "Sem nome")}</div>
            </div>
            <div style="border:1px solid #d7e3dc; border-radius:10px; padding:14px;">
              <div style="font-size:11px; font-weight:900; text-transform:uppercase; color:#6b7280;">Data e horário</div>
              <div style="margin-top:6px; font-size:18px; font-weight:900; color:#183a2d;">${escapeHtml(`${dateLabel} · ${timeLabel}`)}</div>
            </div>
            <div style="border:1px solid #d7e3dc; border-radius:10px; padding:14px;">
              <div style="font-size:11px; font-weight:900; text-transform:uppercase; color:#6b7280;">Investimento</div>
              <div style="margin-top:6px; font-size:18px; font-weight:900; color:#183a2d;">${escapeHtml(qualificacao.faixaInvestimento || "Não informado")}</div>
            </div>
          </div>

          <div style="margin-bottom:18px; background:#f7faf8; border:1px solid #d7e3dc; border-radius:10px; padding:14px 16px;">
            <div style="font-size:12px; font-weight:900; text-transform:uppercase; color:#335d4a;">Leitura rápida</div>
            <div style="margin-top:6px; color:#183a2d; line-height:1.6;">${escapeHtml(priority.note)}</div>
          </div>

          <table style="width:100%; border-collapse:collapse;">${details}</table>

          ${
            record.motivo_evento
              ? `<div style="margin-top:18px;">
                  <div style="font-size:12px; font-weight:900; text-transform:uppercase; color:#335d4a;">Motivo do evento</div>
                  <div style="margin-top:6px; color:#183a2d; line-height:1.6;">${escapeHtml(record.motivo_evento)}</div>
                </div>`
              : ""
          }

          ${
            record.preferencias
              ? `<div style="margin-top:18px;">
                  <div style="font-size:12px; font-weight:900; text-transform:uppercase; color:#335d4a;">Preferências</div>
                  <div style="margin-top:6px; color:#183a2d; line-height:1.6; white-space:pre-wrap;">${escapeHtml(record.preferencias)}</div>
                </div>`
              : ""
          }

          ${
            record.observacoes
              ? `<div style="margin-top:18px;">
                  <div style="font-size:12px; font-weight:900; text-transform:uppercase; color:#335d4a;">Observações</div>
                  <div style="margin-top:6px; color:#183a2d; line-height:1.6; white-space:pre-wrap;">${escapeHtml(record.observacoes)}</div>
                </div>`
              : ""
          }

          ${
            dashboardUrl
              ? `<div style="margin-top:24px;">
                  <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block; background:#183a2d; color:#ffffff; text-decoration:none; font-weight:800; padding:12px 18px; border-radius:8px;">
                    Abrir e qualificar no sistema
                  </a>
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
  if (req.method !== "POST") {
    return response({ ok: false, error: "Method not allowed" }, 405)
  }

  const configuredSecret = Deno.env.get("LEAD_WEBHOOK_SECRET")
  if (configuredSecret) {
    const receivedSecret = req.headers.get("x-webhook-secret")
    if (!receivedSecret || receivedSecret !== configuredSecret) {
      return response({ ok: false, error: "Unauthorized" }, 401)
    }
  }

  try {
    const payload = (await req.json()) as WebhookPayload
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
