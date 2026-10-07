-- Piloto P0 completo e transacional, sem automação de canais.
-- formulário -> resposta registrada -> proposta -> ajuste -> aprovação ->
-- sinal -> reserva -> handoff -> checklist. Todas as fixtures são revertidas.
begin;

do $$
<<p0_sales_pilot>>
declare
  manager_id uuid;
  capture_id uuid := gen_random_uuid();
  manual_message_id uuid := gen_random_uuid();
  fixture_opportunity_id uuid;
  fixture_request_id uuid;
  first_proposal_id uuid;
  adjusted_proposal_id uuid;
  first_public_token uuid;
  adjusted_public_token uuid;
  form_result record;
  response_result record;
  outbox_before bigint;
  outbox_after bigint;
begin
  select id into manager_id
  from auth.users
  where lower(email) = 'leorangel@gmail.com'
  limit 1;
  assert manager_id is not null, 'Gestor de teste indisponível';

  select count(*) into outbox_before from public.event_outbox;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select * into form_result
  from public.submit_public_quote_request(
    capture_id,
    jsonb_build_object(
      'cliente', jsonb_build_object(
        'nome', 'Fixture piloto P0',
        'email', 'fixture-p0-pilot@example.test',
        'whatsapp', '21999990000',
        'empresa', 'Fixture Eventos'
      ),
      'evento', jsonb_build_object(
        'tipo', 'Evento corporativo',
        'data', '2099-11-19',
        'horario', '19:00',
        'convidados', 32,
        'duracao', 4,
        'motivo', 'Piloto de ponta a ponta',
        'preferencias', 'Atendimento fluido',
        'observacoes', 'Não disparar canais'
      )
    )
  );
  fixture_request_id := form_result.request_id;
  fixture_opportunity_id := form_result.opportunity_id;

  assert fixture_request_id is not null and fixture_opportunity_id is not null,
    'Formulário deve criar solicitação e oportunidade';
  assert (
    select status = 'lead_recebido'
      and origem = 'formulario'
      and responsavel_email = 'eventos@embaixadacarioca.com.br'
      and proxima_acao = 'Responder lead'
    from public.oportunidades
    where id = fixture_opportunity_id
  ), 'Novo lead deve nascer atribuído e acionável';

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', manager_id,
      'email', 'leorangel@gmail.com',
      'role', 'authenticated'
    )::text,
    true
  );
  perform public.record_event_message(
    fixture_opportunity_id,
    'Resposta inicial registrada manualmente no piloto P0.',
    'whatsapp',
    'outbound',
    now(),
    manual_message_id
  );
  assert exists (
    select 1 from public.event_messages
    where id = manual_message_id
      and opportunity_id = fixture_opportunity_id
      and source = 'manual'
      and delivery_status = 'manual_sent'
  ), 'Resposta inicial deve ficar registrada sem envio automatizado';

  insert into public.propostas(
    oportunidade_id,
    cliente_nome,
    cliente_email,
    cliente_whatsapp,
    tipo_evento,
    data_evento,
    horario_evento,
    convidados,
    duracao,
    subtotal,
    taxa_servico,
    privatizacao,
    total,
    status,
    publication_status,
    sent_at,
    responsavel_id,
    responsavel_email,
    snapshot
  ) values (
    fixture_opportunity_id,
    'Fixture piloto P0',
    'fixture-p0-pilot@example.test',
    '21999990000',
    'Evento corporativo',
    '2099-11-19',
    '19:00',
    32,
    4,
    10000,
    1200,
    0,
    11200,
    'proposta_enviada',
    'sent',
    now(),
    manager_id,
    'leorangel@gmail.com',
    jsonb_build_object(
      'client', jsonb_build_object('name', 'Fixture piloto P0'),
      'event', jsonb_build_object('type', 'Evento corporativo'),
      'totals', jsonb_build_object('subtotal', 10000, 'serviceFee', 1200, 'total', 11200),
      'selectedItems', jsonb_build_array(jsonb_build_object('name', 'Pacote piloto', 'total', 10000)),
      'commercialHistory', '[]'::jsonb
    )
  ) returning id, public_token into first_proposal_id, first_public_token;

  assert (
    select status = 'proposta_enviada'
      and valor_atual = 11200
      and responsavel_email = 'leorangel@gmail.com'
      and proxima_acao = 'Retomar cliente'
    from public.oportunidades
    where id = fixture_opportunity_id
  ), 'Proposta enviada deve sincronizar o funil comercial';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select * into response_result
  from public.respond_public_proposal(
    first_public_token,
    'alteracao',
    '2099-11-20',
    '20:00',
    36,
    'Ajustar data, horário e quantidade de convidados.',
    null
  );
  assert response_result.ok and response_result.cliente_resposta = 'alteracao',
    'Cliente deve conseguir solicitar o ajuste';
  assert exists (
    select 1 from public.event_messages
    where opportunity_id = fixture_opportunity_id
      and proposal_id = first_proposal_id
      and direction = 'inbound'
      and source = 'public'
  ), 'Solicitação de ajuste deve entrar no histórico';

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', manager_id,
      'email', 'leorangel@gmail.com',
      'role', 'authenticated'
    )::text,
    true
  );
  insert into public.propostas(
    oportunidade_id,
    cliente_nome,
    cliente_email,
    cliente_whatsapp,
    tipo_evento,
    data_evento,
    horario_evento,
    convidados,
    duracao,
    subtotal,
    taxa_servico,
    privatizacao,
    total,
    status,
    publication_status,
    sent_at,
    responsavel_id,
    responsavel_email,
    snapshot
  )
  select
    oportunidade_id,
    cliente_nome,
    cliente_email,
    cliente_whatsapp,
    tipo_evento,
    '2099-11-20'::date,
    '20:00'::time,
    36,
    duracao,
    10500,
    1260,
    privatizacao,
    11760,
    'proposta_enviada',
    'sent',
    now(),
    responsavel_id,
    responsavel_email,
    jsonb_set(
      jsonb_set(
        snapshot,
        '{versionChanges}',
        jsonb_build_array('Data alterada', 'Horário alterado', 'Convidados ajustados'),
        true
      ),
      '{totals}',
      jsonb_build_object('subtotal', 10500, 'serviceFee', 1260, 'total', 11760),
      true
    )
  from public.propostas
  where id = first_proposal_id
  returning id, public_token into adjusted_proposal_id, adjusted_public_token;

  assert (
    select count(*) = 2
      and count(*) filter (where is_current) = 1
      and max(versao) = 2
    from public.propostas
    where oportunidade_id = fixture_opportunity_id
  ), 'Ajuste deve preservar V1 e promover somente a V2';
  assert (
    select is_current is false and superseded_at is not null
    from public.propostas
    where id = first_proposal_id
  ), 'Versão anterior deve permanecer como histórico';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select * into response_result
  from public.respond_public_proposal(
    adjusted_public_token,
    'confirmar',
    null,
    null,
    null,
    'Proposta ajustada aprovada. Segue comprovante do sinal.',
    jsonb_build_object(
      'nome', 'comprovante-piloto.pdf',
      'tipo', 'application/pdf',
      'tamanho', 32,
      'dataUrl', 'data:application/pdf;base64,JVBERi0xLjQK'
    )
  );
  assert response_result.ok and response_result.status = 'negociacao',
    'Aprovação pública deve aguardar validação humana do sinal';
  assert not exists (
    select 1 from public.event_reservations
    where opportunity_id = fixture_opportunity_id
      and status = 'confirmed'
  ), 'Aprovação do cliente não pode reservar antes da validação do sinal';

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', manager_id,
      'email', 'leorangel@gmail.com',
      'role', 'authenticated'
    )::text,
    true
  );
  update public.propostas
  set status = 'confirmado',
      snapshot = jsonb_set(
        snapshot,
        '{pagamentoSinal}',
        jsonb_build_object(
          'valor', 5880,
          'data', current_date,
          'bancos', jsonb_build_array('Validado no piloto'),
          'registradoEm', now(),
          'registradoPor', 'Gestor do piloto',
          'validacaoPendente', false
        ),
        true
      )
  where id = adjusted_proposal_id;

  assert exists (
    select 1 from public.event_reservations
    where opportunity_id = fixture_opportunity_id
      and proposal_id = adjusted_proposal_id
      and status = 'confirmed'
  ), 'Sinal validado deve confirmar a reserva';

  update public.propostas
  set status = 'planejamento',
      snapshot = jsonb_set(
        jsonb_set(
          snapshot,
          '{pagamentoRestante}',
          jsonb_build_object(
            'valor', 5880,
            'data', current_date,
            'bancos', jsonb_build_array('Validado no piloto'),
            'registradoEm', now(),
            'registradoPor', 'Gestor do piloto'
          ),
          true
        ),
        '{operationalChecklist}',
        jsonb_build_object(
          'saldo_agendado', true,
          'cardapio_confirmado', true,
          'insumos_conferidos', true,
          'extras_confirmados', true,
          'responsavel_dia', true,
          'operacao_avisada', true,
          'observacoes_revisadas', true
        ),
        true
      )
  where id = adjusted_proposal_id;

  assert (
    select status = 'planejamento'
      and valor_atual = 11760
      and proxima_acao = 'Concluir checklist operacional'
    from public.oportunidades
    where id = fixture_opportunity_id
  ), 'Handoff deve chegar ao planejamento com ação operacional';
  assert (
    select (snapshot #>> '{operationalChecklist,saldo_agendado}')::boolean
      and (snapshot #>> '{operationalChecklist,cardapio_confirmado}')::boolean
      and (snapshot #>> '{operationalChecklist,insumos_conferidos}')::boolean
      and (snapshot #>> '{operationalChecklist,extras_confirmados}')::boolean
      and (snapshot #>> '{operationalChecklist,responsavel_dia}')::boolean
      and (snapshot #>> '{operationalChecklist,operacao_avisada}')::boolean
      and (snapshot #>> '{operationalChecklist,observacoes_revisadas}')::boolean
    from public.propostas
    where id = adjusted_proposal_id
  ), 'Checklist operacional deve concluir os sete controles';

  select count(*) into outbox_after from public.event_outbox;
  assert outbox_after = outbox_before,
    'Piloto não pode criar envios em canais';
  assert not exists (
    select 1 from public.event_messages
    where opportunity_id = fixture_opportunity_id
      and source = 'provider'
  ), 'Piloto não pode registrar entrega de provedor';
end $$;

rollback;
