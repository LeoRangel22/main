const DEFAULT_SUPABASE_URL = "https://pdgbnpztdnrvrphzdjas.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZ2JucHp0ZG5ydnJwaHpkamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTA3MDUsImV4cCI6MjA5MTk2NjcwNX0.RN75ksH4im9c0gk3fc3TI9m1ij6e8HJSMtILO8eOmno";

const form = document.querySelector("#clientQuoteForm");
const statusNode = document.querySelector("#clientFormStatus");
const submitButton = document.querySelector("#submitClientQuoteBtn");

const fields = {
  name: document.querySelector("#requestClientName"),
  email: document.querySelector("#requestClientEmail"),
  phone: document.querySelector("#requestClientPhone"),
  company: document.querySelector("#requestCompany"),
  eventType: document.querySelector("#requestEventType"),
  date: document.querySelector("#requestEventDate"),
  time: document.querySelector("#requestEventTime"),
  guests: document.querySelector("#requestGuestCount"),
  duration: document.querySelector("#requestDuration"),
  reason: document.querySelector("#requestReason"),
  preferences: document.querySelector("#requestPreferences"),
  notes: document.querySelector("#requestNotes"),
};

function setStatus(message, type = "neutral") {
  statusNode.textContent = message;
  statusNode.dataset.status = type;
}

function toNumber(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function getSnapshot() {
  return {
    cliente: {
      nome: fields.name.value.trim(),
      email: fields.email.value.trim(),
      whatsapp: fields.phone.value.trim(),
      empresa: fields.company.value.trim(),
    },
    evento: {
      tipo: fields.eventType.value,
      data: fields.date.value,
      horario: fields.time.value,
      convidados: Math.max(1, Math.floor(toNumber(fields.guests.value) || 1)),
      duracao: toNumber(fields.duration.value),
      motivo: fields.reason.value.trim(),
      preferencias: fields.preferences.value.trim(),
      observacoes: fields.notes.value.trim(),
    },
    origem: "formulario",
    enviadoEm: new Date().toISOString(),
  };
}

function getPayload(snapshot) {
  return {
    status: "novo",
    cliente_nome: snapshot.cliente.nome,
    cliente_email: snapshot.cliente.email,
    cliente_whatsapp: snapshot.cliente.whatsapp || null,
    empresa: snapshot.cliente.empresa || null,
    tipo_evento: snapshot.evento.tipo || null,
    data_evento: snapshot.evento.data || null,
    horario_evento: snapshot.evento.horario || null,
    convidados: snapshot.evento.convidados,
    duracao: snapshot.evento.duracao,
    motivo_evento: snapshot.evento.motivo || null,
    preferencias: snapshot.evento.preferencias || null,
    observacoes: snapshot.evento.observacoes || null,
    origem: "formulario",
    proposta_id: null,
    snapshot,
  };
}

async function submitRequest(event) {
  event.preventDefault();

  if (!window.supabase?.createClient) {
    setStatus("Não foi possível carregar a conexão. Tente novamente em instantes.", "error");
    return;
  }

  const snapshot = getSnapshot();
  if (!snapshot.cliente.nome || !snapshot.cliente.email || !snapshot.evento.tipo) {
    setStatus("Preencha nome, e-mail e tipo de evento.", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus("Enviando solicitação...", "neutral");

  const client = window.supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
  const { error } = await client.from("solicitacoes_cotacao").insert(getPayload(snapshot));

  submitButton.disabled = false;

  if (error) {
    console.warn("Falha ao enviar solicitacao.", error);
    setStatus("Não foi possível enviar. Confira os dados e tente novamente.", "error");
    return;
  }

  form.reset();
  setStatus("Solicitação enviada. A equipe vai preparar a proposta e entrar em contato.", "success");
}

form.addEventListener("submit", submitRequest);
