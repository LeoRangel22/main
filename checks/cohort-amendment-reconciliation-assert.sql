do $$
declare x record; observation event_private.proposal_preparation_evidence; actor uuid; report jsonb; cohort_day date;
begin
 for x in select * from cohort_amendment_expected loop
  assert (select to_jsonb(p)=x.before_row from public.propostas p where p.id=x.proposal_id),'Correction must not modify proposal content, revision or current version';
  select * into observation from event_private.proposal_preparation_evidence where proposal_id=x.proposal_id;
  if x.keep then
   assert found and observation.observed_at=now()-interval '310 days','Preserve the first legitimate original observation';
   assert observation.source=case when x.case_name='ordinary_send' then 'accepted_send' else 'approval_snapshot' end;
  else assert not found,'Applied amendments are not initial proposal preparation';end if;
 end loop;
 select id into actor from auth.users where email='leorangel@gmail.com';
 cohort_day:=((now()-interval '320 days') at time zone 'America/Sao_Paulo')::date;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 report:=public.event_sales_cohort(cohort_day,cohort_day,30);
 assert (report->>'total')::integer=5 and (report->>'prepared')::integer=2,'Only original proposal evidence belongs in the prepared cohort';
 reset role;
end $$;
