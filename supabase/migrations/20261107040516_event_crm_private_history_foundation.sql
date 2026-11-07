CREATE SCHEMA event_crm AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA event_crm FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE event_crm.import_batches (
 id text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 source_period_start date NOT NULL,
 source_period_end date NOT NULL,
 status text NOT NULL CHECK (status IN ('preparing','validated','failed')),
 manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object')
);
CREATE TABLE event_crm.foundation_records (
 batch_id text NOT NULL REFERENCES event_crm.import_batches(id),
 kind text NOT NULL CHECK(kind IN ('organization','contact','case','event','action','source_index','quality_issue','event_party')),
 record_id text NOT NULL CHECK(length(record_id)>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 search_document tsvector GENERATED ALWAYS AS
 (jsonb_to_tsvector('pg_catalog.portuguese'::regconfig,payload,'["string"]'::jsonb)) STORED,
 PRIMARY KEY(batch_id,kind,record_id)
);
CREATE INDEX foundation_records_search_idx ON event_crm.foundation_records USING gin(search_document);
CREATE INDEX foundation_records_email_idx ON event_crm.foundation_records(lower(payload->>'email')) WHERE kind='contact';
CREATE INDEX foundation_records_event_date_idx ON event_crm.foundation_records((payload->>'event_date')) WHERE kind='event';
ALTER TABLE event_crm.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_crm.foundation_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA event_crm FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA event_crm FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA event_crm REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON SCHEMA event_crm IS 'Private evidence-backed CRM foundation; no API access, notifications, worker, financial or proposal mutations.';
COMMENT ON TABLE event_crm.foundation_records IS 'Versioned provisional CRM data. Counts distinguish conversation, reservation, performed event and evidence. No automatic marketing permission or current identity verification.';
CREATE VIEW event_crm.validated_records WITH (security_invoker=true) AS
 SELECT r.batch_id,r.kind,r.record_id,r.payload
 FROM event_crm.foundation_records r
 JOIN event_crm.import_batches b ON b.id=r.batch_id
 WHERE b.status='validated';
REVOKE ALL ON event_crm.validated_records FROM PUBLIC, anon, authenticated, service_role;
