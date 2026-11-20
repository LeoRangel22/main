-- Safe pause preserves every claim, accepted POST and uncertain outcome.
-- Do not restore the old sender: it does not honor this pause or deduplication.
begin;
update event_private.lead_alert_policy set enabled=false where id;
do $$
declare job bigint;
begin
 if to_regclass('cron.job') is not null and to_regprocedure('cron.unschedule(bigint)') is not null then
  for job in select jobid from cron.job where jobname='event-lead-alerts-scan-v1' loop
   perform cron.unschedule(job);
  end loop;
 end if;
end $$;
commit;
