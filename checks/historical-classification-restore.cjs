'use strict';
const {Client}=require('pg'),assert=require('node:assert/strict');
const address=new URL(process.env.TEST_DATABASE_URL||'postgres://postgres:event-test-only@127.0.0.1:5432/postgres');
if(!['localhost','127.0.0.1','postgres'].includes(address.hostname))throw Error('Only disposable local databases');
async function signature(c){
 const data=(await c.query("select (select count(*)::int from event_crm.classification_review_events) reviews,(select md5(coalesce(jsonb_agg(to_jsonb(e) order by request_id)::text,'[]')) from event_crm.classification_review_events e) audit_hash,(select md5(coalesce(jsonb_agg(to_jsonb(r) order by batch_id,kind,record_id)::text,'[]')) from event_crm.foundation_records r) source_hash,(select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'[]')) from public.propostas p) proposal_hash")).rows[0];
 const control=(await c.query("select (select relrowsecurity from pg_class where oid='event_crm.classification_review_events'::regclass) rls,has_table_privilege('authenticated','event_crm.classification_review_events','SELECT') raw_read,has_table_privilege('authenticated','event_crm.classification_review_events','INSERT') raw_write,has_function_privilege('anon','public.event_crm_review_classification(text,text,text,integer,uuid,text,text,text)','EXECUTE') anonymous_write,exists(select 1 from pg_trigger where tgrelid='event_crm.classification_review_events'::regclass and tgname='immutable_classification_review' and tgenabled='O') immutable")).rows[0];
 assert.deepEqual(control,{rls:true,raw_read:false,raw_write:false,anonymous_write:false,immutable:true});
 return{data,control};
}
(async()=>{
 const connections=['events_test','events_restored_test'].map(name=>{const url=new URL(address);url.pathname='/'+name;return new Client({connectionString:url.toString()});});
 try{await Promise.all(connections.map(c=>c.connect()));const before=await signature(connections[0]),after=await signature(connections[1]);assert.ok(before.data.reviews>0,'Synthetic audit fixtures required');assert.deepEqual(after,before);console.log('PASS restored classification authorship, reasons, complete audit, source/proposal fingerprints, RLS and ACLs');}
 finally{await Promise.all(connections.map(c=>c.end()));}
})().catch(e=>{console.error(e);process.exitCode=1;});
