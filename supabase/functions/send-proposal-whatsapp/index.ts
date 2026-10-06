import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { claimSend, createSendWorker, finishSend, duplicateResult } from "../_shared/send-ledger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendPayload = {
  dryRun?: boolean;
  approved?: boolean;
  reviewedResponseAt?: string | null;
  proposalId?: string;
  phone?: string;
  message?: string;
  proposalUrl?: string;
  title?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function safeText(value: unknown, fallback = "") {
  return String(value || fallback).trim();
}

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
    "Se quiser falar com uma pessoa da equipe, use eventos@embaixadacarioca.com.br ou WhatsApp (21) 97142-6007.",
    "",
    "Observação: este envio saiu pelo número automático da Embaixada Carioca.",
  ].join("\n");
}

function getZapiErrorMessage(status: number, details: unknown) {
  const detailsText = typeof details === "string" ? details : JSON.stringify(details);
  const normalized = detailsText.toLowerCase();
  if (status === 404) {
    return "A Z-API retornou 404. Confira ID da instância, token da instância e principalmente o Client-Token da conta.";
  }
  if (normalized.includes("client-token") || normalized.includes("client token") || normalized.includes("unauthorized")) {
    return "A Z-API recusou por Client-Token. Cadastre ZAPI_CLIENT_TOKEN nos secrets do Supabase.";
  }
  if (normalized.includes("phone") || normalized.includes("telefone")) {
    return "A Z-API recusou o telefone. Confira se o Celular/WhatsApp tem DDI e DDD.";
  }
  return `A Z-API recusou o envio (HTTP ${status}).`;
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
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
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID") || "";
    const zapiToken = Deno.env.get("ZAPI_TOKEN") || "";
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("CLIENT_TOKEN") || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ ok: false, message: "Supabase não configurado na função." }, 500);
    }

    if (!instanceId || !zapiToken) {
      return jsonResponse(
        {
          ok: false,
          message: "Z-API não configurada. Defina ZAPI_INSTANCE_ID e ZAPI_TOKEN nos secrets do Supabase.",
        },
        500,
      );
    }

    if (clientToken && (clientToken === instanceId || clientToken === zapiToken)) {
      return jsonResponse(
        {
          ok: false,
          message: "O ZAPI_CLIENT_TOKEN parece estar incorreto. Ele não pode ser igual ao ID ou ao token da instância; use o Client-Token da conta Z-API.",
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
      return jsonResponse({ ok: false, message: "Entre com o e-mail autorizado da equipe para enviar WhatsApp." }, 401);
    }

    const { data: allowed } = await supabase.rpc("is_team_member");
    if (allowed !== true) return jsonResponse({ ok: false, message: "Usuário sem acesso à equipe de Eventos." }, 403);

    const payload = (await req.json()) as SendPayload;

    if (payload.dryRun) {
      const ready = Boolean(instanceId && zapiToken && clientToken);
      return jsonResponse({
        ok: ready,
        mode: "dry-run",
        message: ready
          ? "Z-API configurada para envio direto."
          : "Configure ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nos secrets do Supabase.",
        configured: {
          instanceId: Boolean(instanceId),
          token: Boolean(zapiToken),
          clientToken: Boolean(clientToken),
        },
        diagnostic: {
          instanceId: maskSecret(instanceId),
          token: maskSecret(zapiToken),
          hasClientToken: Boolean(clientToken),
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

    const snapshot = proposal.snapshot || {};
    const phone = normalizePhone(payload.phone || proposal.cliente_whatsapp || snapshot?.client?.phone);
    if (!phone || phone.length < 10) {
      return jsonResponse({ ok: false, message: "Celular/WhatsApp do cliente inválido ou ausente." }, 400);
    }

    const message = safeText(payload.message) || buildDefaultMessage(payload, proposal);
    if (!message || message.length < 10) {
      return jsonResponse({ ok: false, message: "Mensagem de WhatsApp vazia." }, 400);
    }

    const worker = createSendWorker();
    let claim;
    try { claim = await claimSend(supabase, proposal, payload, "whatsapp", phone, message, payload.title || "Proposta comercial"); }
    catch (error) { return jsonResponse({ ok: false, message: String(error.message || error) }, 409); }
    if (!claim.claimed) return jsonResponse(duplicateResult(claim), claim.send.status === "accepted" ? 200 : 409);
    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-text`;
    let zapiResponse;
    try { zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
      body: JSON.stringify({ phone, message }),
      signal: AbortSignal.timeout(25000),
    }); } catch (_error) {
      await finishSend(worker, claim.send.id, "uncertain", null, "Timeout. Conferir provedor antes de repetir.");
      return jsonResponse({ ok: false, sendId: claim.send.id, deliveryStatus: "uncertain", message: "Resultado incerto. Confira o WhatsApp antes de repetir." }, 409);
    }

    const rawBody = await zapiResponse.text();
    let zapiBody: unknown = rawBody;
    try {
      zapiBody = JSON.parse(rawBody);
    } catch (_error) {
      zapiBody = rawBody;
    }

    if (!zapiResponse.ok) {
      await finishSend(worker, claim.send.id, zapiResponse.status >= 500 ? "uncertain" : "failed", null, getZapiErrorMessage(zapiResponse.status, ""));
      console.error("Z-API error:", zapiResponse.status, zapiBody);
      return jsonResponse(
        {
          ok: false,
          message: getZapiErrorMessage(zapiResponse.status, zapiBody),
          details: zapiBody,
          diagnostic: {
            status: zapiResponse.status,
            instanceId: maskSecret(instanceId),
            token: maskSecret(zapiToken),
            hasClientToken: Boolean(clientToken),
            endpoint: `https://api.z-api.io/instances/${maskSecret(instanceId)}/token/${maskSecret(zapiToken)}/send-text`,
          },
        },
        502,
      );
    }

    const providerId = typeof zapiBody === "object" && zapiBody ? String((zapiBody as any).messageId || (zapiBody as any).zaapId || "") || null : null;
    await finishSend(worker, claim.send.id, "accepted", providerId);
    return jsonResponse({ ok: true, phone, sendId: claim.send.id, deliveryStatus: "accepted", message: "Aceito pela Z-API. Entrega e leitura não confirmadas." });
  } catch (error) {
    console.error("send-proposal-whatsapp fatal:", error);
    return jsonResponse({ ok: false, message: "Erro interno ao enviar WhatsApp." }, 500);
  }
});
