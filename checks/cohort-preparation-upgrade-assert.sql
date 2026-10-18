-- Same isolated connection as the setup and actual migration under test.
do $$
declare fixture record; actual event_private.proposal_preparation_evidence; actor uuid; report jsonb; cohort_day date;
begin
 for fixture in select * from cohort_preparation_upgrade_expected loop
  assert (select to_jsonb(p)=fixture.before_row from propostas p where id=fixture.proposal_id),
   'Preparation migration changed a commercial proposal: '||fixture.case_name;
  select * into actual from event_private.proposal_preparation_evidence where proposal_id=fixture.proposal_id;
  if fixture.expected_at is null then
   assert not found,'Migration invented preparation evidence: '||fixture.case_name;
  else
   assert found and actual.observed_at=fixture.expected_at and actual.source=fixture.expected_source,
    'Migration did not retain the earliest proven observation: '||fixture.case_name;
   assert actual.source_id is not null and actual.opportunity_id=fixture.opportunity_id;
  end if;
 end loop;
 select id into actor from auth.users where email='leorangel@gmail.com';
 select (o.created_at at time zone 'America/Sao_Paulo')::date into cohort_day
  from oportunidades o join cohort_preparation_upgrade_expected e on e.opportunity_id=o.id limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email','leorangel@gmail.com','role','authenticated')::text,true);
 set local role authenticated;
 report:=event_sales_cohort(cohort_day,cohort_day,30);
 assert (report->>'total')::integer=10 and (report->>'mature')::integer=10;
 assert (report->>'prepared')::integer=2,'Only two historical preparations have real evidence within the decision window';
 reset role;
 perform set_config('request.jwt.claims','',true);
 delete from event_proposal_approvals where proposal_id in(select proposal_id from cohort_preparation_upgrade_expected);
 delete from propostas where id in(select proposal_id from cohort_preparation_upgrade_expected);
 delete from oportunidades where id in(select opportunity_id from cohort_preparation_upgrade_expected);
end $$;
drop table cohort_preparation_upgrade_expected;
