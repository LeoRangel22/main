const { expect, test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");

function getFunctionBlock(source, name) {
  const start = source.indexOf(`create or replace function public.${name}`);
  expect(start, `${name} deve existir no schema`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("\n$$;", start);
  expect(end, `${name} deve fechar o corpo SQL`).toBeGreaterThan(start);
  return source.slice(start, end);
}

test.describe("Seguranca da proposta publica", () => {
  test("consulta publica devolve apenas snapshot sanitizado", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const block = getFunctionBlock(schema, "get_public_proposal");

    expect(block).toContain("jsonb_strip_nulls(jsonb_build_object(");
    expect(block).toContain("'selectedItems'");
    expect(block).toContain("public_token_revoked_at is null");
    expect(block).toContain("public_token_expires_at > now()");
    expect(block).not.toContain("p.snapshot,");
    expect(block).not.toContain("'prices'");
    expect(block).not.toContain("'internalComments'");
    expect(block).not.toContain("'eventAttachments'");
  });

  test("resposta publica nao confirma venda nem registra sinal automaticamente", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const block = getFunctionBlock(schema, "respond_public_proposal");

    expect(block).toContain("current_status not in ('proposta_enviada', 'negociacao')");
    expect(block).toContain("proof_size > 5242880");
    expect(block).toContain("'comprovante_sinal'");
    expect(block).not.toContain("then 'confirmado'");
    expect(block).not.toContain("jsonb_set(new_snapshot, '{pagamentoSinal}'");
  });
});
