-- CI ONLY: PostgreSQL adapters for managed Supabase services.
-- This does not validate real JWT verification, scheduled execution or HTTP delivery.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(),email text,raw_user_meta_data jsonb default '{}');
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema public,extensions to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
create schema net;
create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$ begin raise exception 'External HTTP prohibited in DB tests'; end $$;
create schema cron;
create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text);
create function cron.schedule(job_name text,job_schedule text,job_command text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values(job_name,job_schedule,job_command) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid $$;
insert into auth.users(email) values('leorangel@gmail.com'),('eventos@embaixadacarioca.com.br'),('financeiro@embaixadacarioca.com.br');
