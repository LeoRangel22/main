import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendPayload = {
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
    "Segue o link da proposta comercial da Embaixada Carioca:",
    proposalUrl,
    "",
    "Pelo link você pode aprovar a proposta, solicitar ajustes de data, horário ou convidados, ou falar com a nossa equipe.",
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
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID") || "";
    const zapiToken = Deno.env.get("ZAPI_TOKEN") || "";
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("CLIENT_TOKEN") || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ ok: false, message: "Supabase não configurado na função." }, 500);
    }

    if (!instanceId || !zapiToken || !clientToken) {
      return jsonResponse(
        {
          ok: false,
          message: "Z-API não configurada. Defina ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nos secrets do Supabase.",
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

    const payload = (await req.json()) as SendPayload;
    if (!payload.proposalId) {
      return jsonResponse({ ok: false, message: "Proposta não informada." }, 400);
    }

    const { data: proposal, error: proposalError } = await supabase
      .from("propostas")
      .select("id, cliente_nome, cliente_whatsapp, snapshot, public_token")
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

    const zapiResponse = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify({ phone, message }),
    });

    const rawBody = await zapiResponse.text();
    let zapiBody: unknown = rawBody;
    try {
      zapiBody = JSON.parse(rawBody);
    } catch (_error) {
      zapiBody = rawBody;
    }

    if (!zapiResponse.ok) {
      console.error("Z-API error:", zapiResponse.status, zapiBody);
      return jsonResponse({ ok: false, message: "A Z-API recusou o envio.", details: zapiBody }, 502);
    }

    const sentAt = new Date().toISOString();
    const historyEntry = {
      id: `whatsapp-${Date.now()}`,
      type: "whatsapp_envio",
      title: "Proposta enviada por WhatsApp",
      detail: `Enviada para ${phone}${payload.title ? ` · ${payload.title}` : ""}.`,
      at: sentAt,
      actor: userData.user.email || "Equipe",
      channel: "zapi",
      phone,
      proposalUrl: payload.proposalUrl || null,
      zapiStatus: zapiResponse.status,
    };

    const commercialHistory = Array.isArray(snapshot.commercialHistory) ? snapshot.commercialHistory : [];
    const whatsappSends = Array.isArray(snapshot.whatsappEnvios) ? snapshot.whatsappEnvios : [];
    const nextSnapshot = {
      ...snapshot,
      ultimoEnvioWhatsappEm: sentAt,
      commercialHistory: [historyEntry, ...commercialHistory].slice(0, 50),
      whatsappEnvios: [
        {
          at: sentAt,
          actor: userData.user.email || "Equipe",
          phone,
          title: payload.title || "Proposta",
          proposalUrl: payload.proposalUrl || null,
        },
        ...whatsappSends,
      ].slice(0, 20),
    };

    const { error: updateError } = await supabase
      .from("propostas")
      .update({ snapshot: nextSnapshot })
      .eq("id", proposal.id);

    if (updateError) {
      console.error("Falha ao registrar histórico WhatsApp:", updateError);
      return jsonResponse({
        ok: true,
        warning: "Mensagem enviada, mas o histórico não foi atualizado.",
        phone,
        zapi: zapiBody,
      });
    }

    return jsonResponse({ ok: true, phone, zapi: zapiBody });
  } catch (error) {
    console.error("send-proposal-whatsapp fatal:", error);
    return jsonResponse({ ok: false, message: "Erro interno ao enviar WhatsApp." }, 500);
  }
});
