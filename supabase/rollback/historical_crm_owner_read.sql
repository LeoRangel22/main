-- Disable the read surface; preserve every imported record and operational table.
drop function if exists public.event_crm_history(text,text,text,integer,integer,text,text);
drop function if exists event_crm_api.read_history(text,text,text,integer,integer,text,text);
drop function if exists event_crm_api.matches_query(jsonb,text);
drop function if exists event_crm_api.normalize_text(text);
drop schema if exists event_crm_api;
