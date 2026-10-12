from pathlib import Path
p = Path('app.js')
s = p.read_text()
old = 'function getSupabaseSaveErrorMessage(error, context = {}) {\n'
new = old + '  if (error?.code === "SAVE_UNCONFIRMED") return error.message || "Não foi possível confirmar a gravação. Confira o histórico antes de repetir.";\n'
assert s.count(old) == 1
assert 'if (error?.code === "SAVE_UNCONFIRMED")' not in s
s = s.replace(old, new, 1)
old = '  window.setTimeout(() => fields.clientName?.focus?.({ preventScroll: true }), 350);'
new = '''  const focusTargetAtLoad = document.activeElement;
  window.setTimeout(() => {
    // Never move typing to the client's name after the user chose another field.
    if (document.activeElement === focusTargetAtLoad || document.activeElement === document.body) {
      fields.clientName?.focus?.({ preventScroll: true });
    }
  }, 350);'''
assert s.count(old) == 1
p.write_text(s.replace(old, new, 1))

# Playwright injects instrumentation into script-disabled frames and emits this
# exact browser warning even for empty HTML. Do not relax the real sandbox.
# https://github.com/microsoft/playwright/issues/33343
p = Path('tests/support.js')
s = p.read_text().replace('function collectBrowserErrors(page) {', 'function collectBrowserErrors(page, { sandboxedPreview = false } = {}) {', 1)
old = '    const text = message.text();\n'
new = old + '''    if (sandboxedPreview && /^Blocked script execution in 'about:(?:blank|srcdoc)' because the document's frame is sandboxed and the 'allow-scripts' permission is not set\\.$/.test(text)) return;
'''
assert s.count(old) == 1
p.write_text(s.replace(old, new, 1))
p = Path('tests/admin-manual-proposal.spec.js')
s = p.read_text()
old = '''  test("proposta manual aprovada pede confirmacao e envia e-mail em QA", async ({ page }) => {
    const errors = collectBrowserErrors(page);'''
new = '''  test("proposta manual aprovada pede confirmacao e envia e-mail em QA", async ({ page }) => {
    const errors = collectBrowserErrors(page, { sandboxedPreview: true });'''
assert s.count(old) == 1
p.write_text(s.replace(old, new, 1))
p = Path('tests/proposal-persistence.spec.js')
s = p.read_text() + '''

test('abrir proposta não rouba o foco de quem já começou a digitar', async ({page}) => {
  await openDraft(page);
  const result = await page.evaluate(async () => {
    const proposal = getActiveProposal();
    openSavedProposal(proposal.id);
    const name = fields.clientName.value;
    fields.notes.focus();
    fields.notes.value = 'Texto permanece nas observações';
    await new Promise(resolve => setTimeout(resolve, 420));
    return {focused:document.activeElement.id,name:fields.clientName.value,expectedName:name,notes:fields.notes.value};
  });
  expect(result.focused).toBe('notes');
  expect(result.name).toBe(result.expectedName);
  expect(result.notes).toBe('Texto permanece nas observações');
});
'''
p.write_text(s)
p = Path('tests/email-review.spec.js')
s = p.read_text() + '''

test('prévia permanece isolada e não executa scripts ou ações no painel', async ({page}) => {
  await page.goto('/index.html?qa=1');
  await page.evaluate(() => {
    window.unsafeEmailExecuted = false;
    window.sandboxReview = confirmClientSend({channel:'E-mail',destination:'review@example.test',message:'Conteúdo estático',
      html:'<p>Conteúdo estático</p><script>parent.unsafeEmailExecuted = true;</script><img src="data:image/png,invalid" onerror="parent.unsafeEmailExecuted = true">'});
  });
  const dialog = page.locator('.send-confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('iframe')).toHaveAttribute('sandbox','');
  await expect(dialog.frameLocator('iframe').getByText('Conteúdo estático')).toBeVisible();
  expect(await page.evaluate(() => window.unsafeEmailExecuted)).toBe(false);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(await page.evaluate(() => window.sandboxReview)).toBe(false);
});
'''
p.write_text(s)
