do $$ declare b future_tariff_business_before; fixture_proposal public.propostas; blocked boolean:=false;
begin
 select * into b from future_tariff_business_before;
 assert b.proposals is not distinct from (select jsonb_agg(to_jsonb(p) order by p.id) from public.propostas p),'No proposal rewrite, stamp, revision bump or consent backfill';
 assert b.opportunities is not distinct from (select jsonb_agg(to_jsonb(o) order by o.id) from public.oportunidades o),'No opportunity rewrite';
 assert b.outbox is not distinct from (select jsonb_agg(to_jsonb(o) order by o.id) from public.event_outbox o),'No historical send changes';
 assert b.approvals is not distinct from (select jsonb_agg(to_jsonb(a) order by a.id) from public.event_proposal_approvals a),'No manager decision or content changes';
 assert b.reservations is not distinct from (select jsonb_agg(to_jsonb(r) order by r.opportunity_id) from public.event_reservations r),'No reservation changes';
 assert b.catalogs is not distinct from (select jsonb_agg(to_jsonb(c) order by c.config_key) from public.commercial_settings c),'No catalog changes';
 assert b.catalog_history is not distinct from (select jsonb_agg(to_jsonb(c) order by c.id) from public.commercial_settings_history c),'No historical catalog changes';
 assert b.channels is not distinct from (select jsonb_agg(to_jsonb(c) order by c.provider) from event_private.channel_credentials c),'No channel activation or credential changes';
 assert b.jobs is not distinct from (select jsonb_agg(to_jsonb(j) order by j.jobid) from cron.job j),'No scheduler changes';
 assert not exists(select 1 from future_tariff_functions_before old left join pg_proc p on p.oid=old.oid
  where p.oid is null or (p.proacl,p.prosecdef,p.proconfig) is distinct from (old.proacl,old.prosecdef,old.proconfig)),
  'Every existing function OID, ACL, definer flag and search path is preserved';
 assert not exists(select 1 from future_tariff_functions_before old where old.oid not in
  ('event_private.guard_send_tariff()'::regprocedure,'public.get_public_proposal(uuid)'::regprocedure,'public.get_my_event_history()'::regprocedure)
  and old.definition is distinct from pg_get_functiondef(old.oid)),
  'Save RPC, tariff parser, every fingerprint algorithm and all existing approval/lock guards are unchanged';
 assert not exists(select 1 from future_tariff_relations_before old left join pg_class c on c.oid=old.oid
  where c.oid is null or (c.relacl,c.relrowsecurity) is distinct from (old.relacl,old.relrowsecurity)),
  'Existing table and sequence privileges/RLS are preserved';
 assert not exists(select 1 from future_tariff_triggers_before old left join pg_trigger t on t.oid=old.oid
  where t.oid is null or old.definition is distinct from pg_get_triggerdef(t.oid)),
  'Existing trigger identity, order and lock safeguards are untouched';
 assert not exists(select 1 from event_private.tariff_applications),'No confirmation provenance is backfilled';
 select p0.* into fixture_proposal from public.propostas p0 join future_tariff_fixture f on f.proposal_id=p0.id;
 assert not event_private.tariff_application_valid(fixture_proposal),'Client-authored pre-migration proof is never trusted';
 assert (select snapshot#>'{event,tariffApplication}' is null from public.get_public_proposal(fixture_proposal.public_token)),
  'Public projection must not represent forged legacy proof as confirmation';
 begin
  insert into public.event_outbox(opportunity_id,proposal_id,fingerprint,channel,destination,body,status,approved_by)
  values(fixture_proposal.oportunidade_id,fixture_proposal.id,'tariff-upgrade-forgery','email','tariff-upgrade@example.test','Upgrade fixture','sending',(select id from auth.users order by id limit 1));
 exception when others then blocked:=position('vigência' in sqlerrm)>0;end;
 assert blocked,'Legacy fake JSON still cannot send';
end $$;
-- Remove only the synthetic setup rows, after verifying the upgrade itself was inert.
delete from public.propostas where id in (select proposal_id from future_tariff_fixture);
delete from public.oportunidades where id in (select opportunity_id from future_tariff_fixture);
drop table future_tariff_fixture,future_tariff_functions_before,future_tariff_relations_before,future_tariff_triggers_before,future_tariff_business_before;
