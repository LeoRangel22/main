const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { stripTypeScriptTypes } = require("node:module");
const vm = require("node:vm");

test("alerta de lead aceita WhatsApp ou email incompleto sem reply_to inválido", async () => {
  const source = readFileSync("supabase/functions/notify-new-lead/index.ts", "utf8");
  const code = stripTypeScriptTypes(source.slice(0, source.indexOf("Deno.serve(")));
  for (const email of [undefined, "avieira", "a@", "a@localhost", "a@example.com\r\nBcc:b@example.com", " Ana+evento@example.com "]) {
    let payload;
    const context = {
      Deno: { env: { get: (name) => ({ ZEPTO_MAIL_TOKEN: "mock-token", LEAD_ALERT_FROM_EMAIL: "sender@example.com", LEAD_ALERT_TO_EMAIL: "team@example.com" })[name] } },
      fetch: async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ message: "mock accepted" }) }; },
      record: { cliente_nome: "Teste", cliente_email: email, cliente_whatsapp: "telefone de teste" },
      Intl, Date, URL,
    };
    await vm.runInNewContext(`${code}\nsendZeptoEmail(record)`, context);
    expect(payload.to[0].email_address.address).toBe("team@example.com");
    expect(payload.textbody).toContain("telefone de teste");
    if (email?.startsWith(" Ana")) expect(payload.reply_to[0].address).toBe("Ana+evento@example.com");
    else expect(payload).not.toHaveProperty("reply_to");
  }
});
