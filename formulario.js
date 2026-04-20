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

function pad(value) {
  return String(value).padStart(2, "0");
}

function fillTimeOptions() {
  const start = 8 * 60 + 30;
  const end = 20 * 60 + 30;
  const options = ['<option value="">Selecione</option>'];
  for (let minutes = start; minutes <= end; minutes += 15) {
    const label = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
    options.push(`<option value="${label}">${label}</option>`);
  }
  fields.time.innerHTML = options.join("");
}

function fillGuestOptions() {
  const values = [];
  for (let guests = 10; guests <= 200; guests += 5) values.push(guests);
  [250, 300].forEach((guests) => values.push(guests));
  fields.guests.innerHTML = values
    .map((guests) => `<option value="${guests}" ${guests === 30 ? "selected" : ""}>${guests} pessoas</option>`)
    .join("");
}

function toNumber(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidBrazilianMobile(value) {
  const digits = normalizePhone(value);
  const local = digits.startsWith("55") && digits.length === 13 ? digits.slice(2) : digits;
  return local.length === 11 && /^[1-9]{2}9\d{8}$/.test(local);
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

  if (!isValidEmail(snapshot.cliente.email)) {
    setStatus("Informe um e-mail válido.", "error");
    fields.email.focus();
    return;
  }

  if (!isValidBrazilianMobile(snapshot.cliente.whatsapp)) {
    setStatus("Informe um celular válido com DDD. Ex.: 21 99999-9999.", "error");
    fields.phone.focus();
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

fillTimeOptions();
fillGuestOptions();
form.addEventListener("submit", submitRequest);
