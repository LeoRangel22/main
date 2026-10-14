from pathlib import Path

def replace(path, old, new):
 p=Path(path);s=p.read_text();assert s.count(old)==1,(path,old[:80],s.count(old));p.write_text(s.replace(old,new))

replace('app.js','''  const row = {...getProposalRow(draftSnapshot, "negociacao"), oportunidade_id: source.oportunidade_id,
      is_current: false, publication_status: "draft", sent_at: null};''','''  const row = {...getProposalRow(draftSnapshot, "negociacao"), oportunidade_id: source.oportunidade_id,
      solicitacao_id: source.solicitacao_id || null,
      responsavel_id: source.responsavel_id || null, responsavel_email: source.responsavel_email || null,
      is_current: false, publication_status: "draft", sent_at: null};''')
replace('app.js','''function renderPaymentSummaryLine(title, payment) {
  if (!payment) return "";''','''function renderPaymentSummaryLine(title, payment) {
  if (!payment) return "";
  if (payment.validacaoPendente === true) {
    return '<span>Comprovante aguardando validação</span><strong>Recebimento ainda não confirmado pelo Financeiro</strong><small>O valor informado anteriormente não entra no total recebido até a conferência bancária.</small>';
  }''')
replace('app.js','''    const hasSignal = Boolean(proposal.snapshot?.pagamentoSinal);''','''    const hasSignal = hasValidatedSignal(proposal.snapshot?.pagamentoSinal);''')
replace('app.js','''    if (status === "proposta_enviada" && proposal.clientResponse === "confirmar") {''','''    if (proposal.snapshot?.pagamentoSinal?.validacaoPendente === true) {
      return {tone: "warning", title: "Validar o comprovante antes de liberar a operação",
        note: "Há comprovante pendente. A etapa registrada não comprova recebimento bancário. Financeiro ou gestor devem conferir o sinal.",
        action: "mark_signal", actionLabel: "Validar sinal"};
    }

    if (status === "proposta_enviada" && proposal.clientResponse === "confirmar") {''')
replace('app.js','''        note: "Sinal registrado. Alinhe o saldo para liberar planejamento.",''','''        note: "Planejamento já pode começar após o sinal validado. Confira o prazo combinado do saldo antes da execução.",''')
replace('app.js','''  const signal = snapshot.pagamentoSinal;
  const remaining = snapshot.pagamentoRestante;
  const responseLabels''','''  const signal = hasValidatedSignal(snapshot.pagamentoSinal) ? snapshot.pagamentoSinal : null;
  const remaining = snapshot.pagamentoRestante?.validacaoPendente === true ? null : snapshot.pagamentoRestante;
  const responseLabels''')
replace('app.js','''      value: remaining ? "Saldo registrado" : signal ? "Sinal registrado" : "Sem sinal",
      detail: remaining''','''      value: snapshot.pagamentoSinal?.validacaoPendente === true ? "Comprovante pendente" : remaining ? "Saldo registrado" : signal ? "Sinal registrado" : "Sem sinal",
      detail: remaining''')
replace('app.js','''  if (!isContractedProposal(proposal) || !proposal.is_current) blockers.push("Confira o acordo confirmado atual.");''','''  if (!isContractedProposal(proposal) || !proposal.is_current) blockers.push("Confira o acordo confirmado atual.");
  if (!hasValidatedSignal(proposal.snapshot?.pagamentoSinal)) blockers.push("Financeiro ou gestor devem validar o sinal antes da liberação.");''')
replace('app.js','''  const signalDetail = signal
    ? `${formatMoney(signal.valor)}''','''  const signalDetail = signal?.validacaoPendente === true ? "Comprovante pendente de validação bancária; recebimento não confirmado." : signal
    ? `${formatMoney(signal.valor)}''')
replace('app.js','''  const signalValue = Number(context.signal?.valor || 0);
  const remainingValue = Number(context.remaining?.valor || 0);
  const paidTotal = signalValue + remainingValue;
  const isFullyPaid = total > 0 && paidTotal >= total - 1;''','''  const {isFullyPaid} = getPaymentCoverage(total, context.signal, context.remaining);''')
replace('app.js','''    { label: "Sinal de reserva", value: context.signal ? "Registrado. Conferir comprovante com financeiro." : "Pendente. Cobrar sinal antes de confirmar operação." },''','''    { label: "Sinal de reserva", value: context.signal?.validacaoPendente === true ? "Comprovante pendente de validação. Não comprova sinal recebido." : hasValidatedSignal(context.signal) ? "Registrado pelo Financeiro ou gestor." : "Pendente. Cobrar sinal antes de confirmar operação." },''')
replace('commercial-rules.js','''    if (item.kind === "proposal" && status === "confirmado") {
      if (item.hasPaymentComplete) {''','''    if (item.kind === "proposal" && item.snapshot?.pagamentoSinal?.validacaoPendente === true) {
      tasks.push({...base, title: "Validar comprovante do sinal", note: "Comprovante pendente não é recebimento validado. Conferir antes da liberação operacional.", priority: 98, track: "Financeiro"});
    } else if (item.kind === "proposal" && status === "confirmado") {
      if (item.hasPaymentComplete) {''')
replace('supabase/migrations/20261014084722_journey_integrity.sql', '''     and p.status in ('confirmado','pagamento_final','planejamento','evento_proximo')) then raise exception 'Evento sem acordo confirmado atual'; end if;''','''     and p.status in ('confirmado','pagamento_final','planejamento','evento_proximo')
     and coalesce((p.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)>0
     and not coalesce((p.snapshot#>>'{pagamentoSinal,validacaoPendente}')::boolean,false)) then
      raise exception 'Evento sem acordo confirmado atual e sinal validado pelo Financeiro ou gestor'; end if;''')
print('Legacy pending evidence remains pending; release and summaries fail closed, source identity retained.')
replace('app.js','''    const progress = getChecklistProgress(proposal.snapshot || {});
    const hasSignal = hasValidatedSignal''','''    const progress = getOperationalHandoffProgress(getOperationalHandoffData(proposal).tasks);
    const hasSignal = hasValidatedSignal''')
replace('app.js','''    if (["pagamento_final", "planejamento"].includes(status) && hasIncompleteChecklist(proposal.snapshot || {})) {''','''    if (["pagamento_final", "planejamento"].includes(status) && (!progress.total || progress.done < progress.total)) {''')
replace('tests/dashboard-qa.spec.js','''    await expect(page.locator('.pipeline-stage-negociacao [data-pipeline-card-id="qa-proposal-desfecho"]')).toBeVisible();
    const saved = await page.evaluate(() => state.proposals.find((item) => item.id === "qa-proposal-desfecho"));
    expect(saved.status).toBe("negociacao");
    expect(saved.data_evento).toBe(futureDate);
    expect(saved.snapshot.eventOutcome.outcome).toBe("remarcado");''','''    // Rescheduling creates a new draft; never overwrite the sent original.
    const result = await page.evaluate(() => {
      const original = state.proposals.find(item => item.id === "qa-proposal-desfecho");
      const draft = state.proposals.find(item => item.oportunidade_id === original.oportunidade_id && item.publication_status === "draft");
      return {original, draft};
    });
    expect(result.draft).toBeTruthy();
    expect(result.draft.id).not.toBe(result.original.id);
    expect(result.draft.status).toBe("negociacao");
    expect(result.draft.data_evento).toBe(futureDate);
    expect(result.draft.snapshot.eventOutcome.outcome).toBe("remarcado");
    expect(result.draft.is_current).toBe(false);
    expect(result.original.data_evento).not.toBe(futureDate);
    await expect(page.locator(`.pipeline-stage-negociacao [data-pipeline-card-id="${result.draft.id}"]`)).toBeVisible();''')
p=Path('tests/journey-completion.spec.js');p.write_text(p.read_text()+'''
test('legacy pending proof is not displayed as received and cannot release an otherwise complete operation',async({page})=>{
 await fixture(page,true);const r=await page.evaluate(()=>{
  const p=getActiveProposal();p.snapshot.pagamentoSinal={valor:p.total,validacaoPendente:true};upsertProposalState(p);openSavedProposal(p.id);
  const d=getOperationalHandoffData(p);for(const t of d.tasks){t.status='done';t.acknowledged_at='2026-10-14T08:00:00Z';}
  return {summary:renderPaymentSummaryLine('Sinal registrado',p.snapshot.pagamentoSinal),
    next:getProposalNextStepConfig(),doc:buildOperationalPaymentStatusBlock(getOperationalDocContext(p)),blockers:getOperationalReleaseBlockers(p)};
 });expect(r.summary).toContain('Recebimento ainda não confirmado');expect(r.summary).not.toContain('Sinal registrado');
 expect(r.next.action).toBe('mark_signal');expect(r.doc).toContain('pendente de validação');expect(r.doc).not.toContain('Sem saldo restante aparente');
 expect(r.blockers.join(' ')).toContain('validar o sinal');
});
test('rescheduling takes request and owner from its source, not another editor',async({page})=>{
 await fixture(page);const r=await page.evaluate(async()=>{
  const p=getActiveProposal();p.data_evento='2020-01-10';p.snapshot.event.date=p.data_evento;
  p.solicitacao_id='00000000-0000-4000-8000-000000000733';p.responsavel_id='00000000-0000-4000-8000-000000000734';p.responsavel_email='eventos@embaixadacarioca.com.br';
  upsertProposalState(p);state.activeQuoteRequestId='00000000-0000-4000-8000-000000000735';
  requestPastEventOutcome=async()=>({outcome:'remarcado',newDate:'2099-11-20',detail:'Fixture'});
  await classifyPastEvent('proposal',p.id);
  const draft=state.proposals.find(x=>x.oportunidade_id===p.oportunidade_id&&x.publication_status==='draft');
  return {request:draft?.solicitacao_id,owner:draft?.responsavel_id,email:draft?.responsavel_email};
 });expect(r).toEqual({request:'00000000-0000-4000-8000-000000000733',owner:'00000000-0000-4000-8000-000000000734',email:'eventos@embaixadacarioca.com.br'});
});
''')
p=Path('checks/journey-completion.sql');s=p.read_text();s=s.replace('evidence jsonb;','evidence jsonb; h public.event_handoffs; t public.event_handoff_tasks; blocked boolean; manager uuid;')
needle=''' assert q.snapshot#>>'{clienteResposta,comprovante,nome}'='fixture.png','Validation retains submitted evidence';
 reset role;'''
assert s.count(needle)==1
s=s.replace(needle,needle+'''
 -- Explicit maintenance fixture simulates a legacy booked row with unvalidated proof.
 -- No live database is permitted by the test runner.
 perform set_config('request.jwt.claims','',true);
 update propostas set snapshot=jsonb_set(snapshot,'{pagamentoSinal,validacaoPendente}','true') where id=q.id;
 select * into h from event_handoffs where opportunity_id=o;
 select id into manager from auth.users where email='leorangel@gmail.com';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 perform acknowledge_event_handoff_changes(o,h.version);
 for t in select * from event_handoff_tasks where opportunity_id=o and task_key<>'gerencia_go_no_go' order by sort_order loop
  perform update_event_handoff_task(t.id,'done',null,null,'Synthetic prerequisite',h.version);
 end loop;
 select * into t from event_handoff_tasks where opportunity_id=o and task_key='gerencia_go_no_go';
 blocked:=false;begin perform update_event_handoff_task(t.id,'done',null,null,'Synthetic release attempt',h.version);
 exception when others then blocked:=true;end;
 assert blocked,'Manager cannot release a legacy event with an unvalidated deposit even when all tasks are done';
 reset role;
''');p.write_text(s)
