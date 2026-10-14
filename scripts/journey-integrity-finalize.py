from pathlib import Path
# This script only transforms repository code and isolated tests; no production calls.
p=Path('app.js');s=p.read_text()
assert '${escapeHtml(subtitle)}' in s
s=s.replace('${escapeHtml(subtitle)}','${escapeHtml(subtitle).replace(/&lt;br&gt;/g, "<br>")}')
s=s.replace('value: "Financeiro / eventos"','value: "Financeiro / gestor"')
p.write_text(s)
p=Path('tests/dashboard-qa.spec.js');s=p.read_text()
assert 'expect(operationalHtml).not.toContain("Financeiro");' in s
s=s.replace('expect(operationalHtml).not.toContain("Financeiro");','// Sector ownership may name Financeiro, but the operational copy must not expose the financial section or currency.\n    expect(operationalHtml).not.toContain("<h2>Financeiro</h2>");')
assert 'expect(operationalHtml).not.toContain("R$");' in s
p.write_text(s)
p=Path('scripts/journey-integrity-migration.sql');s=p.read_text()
s="-- Monotonic server-owned lock. No historical data is rewritten.\nalter table public.propostas add column journey_commercial_locked boolean not null default false;\n\n"+s
marker=" if tg_op='UPDATE' then\n  prior:=old.snapshot;"
assert marker in s
s=s.replace(marker,""" if tg_op='UPDATE' then
  new.journey_commercial_locked:=old.journey_commercial_locked or old.publication_status='sent' or old.status=any(booked)
    or exists(select 1 from public.event_outbox b where b.proposal_id=old.id and b.status in ('sending','accepted','uncertain'))
    or exists(select 1 from event_private.proposal_public_baseline b where b.proposal_id=old.id);
  prior:=old.snapshot;""")
s=s.replace("if (old.publication_status='sent' or old.status=any(booked)) and", "if new.journey_commercial_locked and")
marker=" for key in select unnest(array['pagamentoSinal','pagamentoRestante']) loop"
assert marker in s
s=s.replace(marker,""" if tg_op='INSERT' then new.journey_commercial_locked:=new.publication_status='sent' or new.status=any(booked); end if;
"""+marker)
s=s.replace("(new.status='done' or new.acknowledged_at is distinct from old.acknowledged_at)","((new.status='done' and old.status is distinct from new.status) or (new.acknowledged_at is not null and new.acknowledged_at is distinct from old.acknowledged_at))")
p.write_text(s)
# Older subsystem tests deliberately mutate fixtures to prove discount/handoff invalidation.
# Fixture preparation uses the database administrator, not a user write; role/RPC tests remain intact.
p=Path('checks/event-operations.sql');s=p.read_text();lines=s.splitlines();out=[]
for line in lines:
 if line.strip().startswith('update public.propostas set snapshot=jsonb_set(snapshot,') and 'where id=p1;' in line:
  out.extend(["  -- Administrative fixture preparation for the discount subsystem; real user writes are rejected by journey-integrity.sql.","  perform set_config('request.jwt.claims','',true);",line,"  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);"])
 else: out.append(line)
p.write_text('\n'.join(out)+'\n')
p=Path('checks/p1-assisted-sales-handoff.sql');s=p.read_text()
needle='  update public.propostas set convidados = 76 where id = fixture_proposal_id;'
assert needle in s
s=s.replace(needle,"""  -- Simulate an authorized source revision at subsystem level, retaining all history assertions.
  -- Direct changes by the seller are separately required to fail in journey-integrity.sql.
  perform set_config('request.jwt.claims','',true);
"""+needle+"""
  perform set_config('request.jwt.claims',jsonb_build_object('sub',team_user,'email',(select email from auth.users where id=team_user),'role','authenticated')::text,true);""")
p.write_text(s)
# Explicit regressions for status-downgrade evasion and legitimate notes after validation.
p=Path('checks/journey-integrity.sql');s=p.read_text()
needle=" reset role;\n perform set_config('request.jwt.claims',jsonb_build_object('sub',finance"
assert needle in s
s=s.replace(needle,""" select * into p from save_event_proposal(p.id,'{"publication_status":"ready"}'::jsonb,p.revision,null);
 assert p.journey_commercial_locked,'Operational restaging cannot unlock a released agreement';
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"generalTerms":"Bypass attempt"}'),p.revision,null);
 exception when sqlstate 'PT409' then blocked:=true;end;assert blocked,'Restaging cannot enable an in-place contractual overwrite';
"""+needle)
needle=" assert p.snapshot#>>'{pagamentoSinal,validadoPor}'=finance::text,'Financial validation has a server-recorded actor';"
assert needle in s
s=s.replace(needle,needle+"""
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',seller,'email','eventos@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 select * into p from save_event_proposal(p.id,jsonb_build_object('snapshot',jsonb_set(p.snapshot,'{event,notes}','"Internal operational note"')),p.revision,null);
 assert p.snapshot#>>'{pagamentoSinal,validadoPor}'=finance::text,'Notes preserve the financial validation';
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',finance,'email','financeiro@embaixadacarioca.com.br','role','authenticated')::text,true);
 set local role authenticated;
 blocked:=false;begin perform save_event_proposal(p.id,jsonb_build_object('snapshot',p.snapshot||'{"pagamentoSinal":{"valor":1}}'),p.revision,null);
 exception when insufficient_privilege then blocked:=true;end;assert blocked,'Finance cannot authorize a below-standard exception';
""")
# Changing source notes correctly invalidates the handoff; explicitly review that source version in the test before release.
s=s.replace(" set local role authenticated;\n blocked:=false;begin perform update_event_handoff_task(release_id,'done'", " set local role authenticated;\n perform acknowledge_event_handoff_changes(opp,h.version);\n blocked:=false;begin perform update_event_handoff_task(release_id,'done'",1)
p.write_text(s)
print('Monotonic agreement lock, financial invalidation, document privacy and isolated regressions prepared')
