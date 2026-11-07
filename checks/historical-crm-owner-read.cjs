const assert=require("node:assert/strict");
module.exports=async function(c,sql,fixtureOwner,migrationFiles){
 assert.ok(["localhost","127.0.0.1","postgres"].includes(c.connectionParameters.host),"Disposable database only");
 assert.ok(["events_test","events_fresh_test","events_current_upgrade_test"].includes(c.connectionParameters.database),"Disposable named test database only");
 const owner=await fixtureOwner(c);
 const outside="a44e3666-3f09-45cb-a2d7-77de05479991";
 const session="a44e3666-3f09-45cb-a2d7-77de05479992";
 const claims={sub:owner.id,email:owner.email,role:"authenticated",session_id:session};
 async function actor(jwt,query,args=[],role="authenticated"){
  await c.query("savepoint crm_actor");
  try{
   await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(jwt)]);
   await c.query(role==="anon"?"set local role anon":"set local role authenticated");
   return await c.query(query,args);
  }finally{await c.query("rollback to savepoint crm_actor");await c.query("release savepoint crm_actor");}
 }
 const read=async(p={})=>(await actor(claims,"select public.event_crm_history($1,$2,$3,$4,$5,$6,$7) data",
  [p.kind||"organization",p.query||"",p.sort||"name",p.limit??20,p.offset??0,p.id??null,p.org??null])).rows[0].data;
 const deny=async(jwt=claims,role="authenticated")=>{
  await assert.rejects(actor(jwt,"select public.event_crm_history()",[],role),e=>e.code==="42501");
 };
 await c.query("begin");
 try{
  // This fixture adapter is used only inside this rolled-back local test.
  await c.query("alter table auth.users add column if not exists deleted_at timestamptz; alter table auth.users add column if not exists banned_until timestamptz");
  await c.query("create table if not exists auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz)");
  await c.query("insert into auth.users(id,email) values($1,'crm-outsider@example.test') on conflict(id) do nothing",[outside]);
  await c.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour') on conflict(id) do update set user_id=excluded.user_id,not_after=excluded.not_after",[session,owner.id]);
  const before=(await c.query("select (select count(*) from public.propostas)::int proposals,(select count(*) from public.oportunidades)::int opportunities,(select count(*) from public.solicitacoes_cotacao)::int requests")).rows[0];
  const meta=(await c.query("select has_schema_privilege('authenticated','event_crm','USAGE') data_schema,has_table_privilege('authenticated','event_crm.foundation_records','SELECT') table_select,(select prosecdef from pg_proc where oid='public.event_crm_history(text,text,text,integer,integer,text,text)'::regprocedure) public_definer,(select prosecdef from pg_proc where oid='event_crm_api.read_history(text,text,text,integer,integer,text,text)'::regprocedure) private_definer")).rows[0];
  assert.deepEqual(meta,{data_schema:false,table_select:false,public_definer:false,private_definer:true});
  assert.equal((await c.query("select event_crm_api.normalize_text('ÁGÊNCIA' collate \"C\") normalized")).rows[0].normalized,"agencia","Accent search is independent of database locale");
  await deny({}, "anon");
  await deny({...claims,sub:outside,email:"crm-outsider@example.test"});
  await deny({...claims,sub:outside}); // Forged Master e-mail cannot change the current account.
  await deny({...claims,session_id:"a44e3666-3f09-45cb-a2d7-77de05479993"});
  await deny({...claims,session_id:undefined});
  await c.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[session]);await deny();
  await c.query("update auth.sessions set not_after=now()+interval '1 hour' where id=$1",[session]);
  await c.query("update auth.users set banned_until=now()+interval '1 hour' where id=$1",[owner.id]);await deny();
  await c.query("update auth.users set banned_until=null,deleted_at=now() where id=$1",[owner.id]);await deny();
  await c.query("update auth.users set deleted_at=null where id=$1",[owner.id]);
  await c.query("insert into event_crm.import_batches(id,source_period_start,source_period_end,status,created_at,manifest) values ('crm_fixture_old','2097-01-01','2097-12-31','validated','2097-01-01','{}'),('crm_fixture_current','2098-01-01','2099-02-19','validated','2099-01-01','{}'),('crm_fixture_preparing','2100-01-01','2100-12-31','preparing','2100-01-01','{}')");
  const rows=[
   ["organization","org-a",{id:"org-a",name:"Ágência Aurora",domain:"aurora.example.test",source_ids:["source-a"],last_contact_at:"2099-02-19T12:00:00Z"}],
   ["organization","org-z",{id:"org-z",name:"Zulu Empresa",domain:null,source_ids:[],last_contact_at:"2099-02-20T12:00:00Z"}],
   ["contact","contact-a",{id:"contact-a",name:"Contato sintético",email:"contact_one@example.test",organization_id:"org-a",phones:[{raw:"(21) 98765-4321",digits:"5521987654321"}],source_ids:["source-a"]}],
   ["case","case-a",{id:"case-a",title:"Conversa sintética",contact_ids:["contact-a"],source_ids:["source-a"],observations:[{kind:"quote",data:{raw:"<script>literal</script>"},source_id:"source-a"}]}],
   ["event","event-a",{id:"event-a",title:"Evento de teste",organization_domain:"aurora.example.test",event_date:"2099-02-19",guests_planned:2,guests_billed:8,guests_actual:null,phase:"realizado_comprovado",invoiced_brl:"1491.75",payment_claimed_brl:null,source_ids:["source-a"]}],
   ["event_party","party-a",{event_id:"event-a",organization_id:"org-a",role:"agency"}],
   ["event_party","party-z",{event_id:"event-a",organization_id:"org-z",role:"end_client"}],
   ["action","action-a",{id:"action-a",organization_id:"org-a",organization:"Ágência Aurora",priority:"alta",next_action:"Revisar contato"}],
   ["source_index","source-a",{id:"source-a",kind:"email",subject:"Fonte sintética",from_email:"source@example.test",occurred_at:"2099-02-19T12:00:00Z",message_id:"<synthetic@example.test>",body:"PRIVATE_BODY_NOT_FOR_API",quoted_history:"PRIVATE_QUOTED_HISTORY",source_files:[{entry:"private/local/path"}]}]
  ];
  for(const [kind,id,payload]of rows)await c.query("insert into event_crm.foundation_records(batch_id,kind,record_id,payload) values('crm_fixture_current',$1,$2,$3)",[kind,id,JSON.stringify(payload)]);
  for(const batch of ["crm_fixture_old","crm_fixture_preparing"])await c.query("insert into event_crm.foundation_records(batch_id,kind,record_id,payload) values($1,'organization','decoy','{\"id\":\"decoy\",\"name\":\"EXCLUDED\"}')",[batch]);
  const first=await read();assert.equal(first.batch_id,"crm_fixture_current");assert.equal(first.total,2);
  assert.deepEqual(first.records.map(x=>x.id),["org-a","org-z"]);assert.equal(first.summary.realized,1);
  assert.deepEqual((await read({sort:"recent",limit:1})).records.map(x=>x.id),["org-z"]);
  assert.deepEqual((await read({limit:1,offset:1})).records.map(x=>x.id),["org-z"]);
  for(const query of ["agencia aurora","Ágência Aurora","contact_one@example.test","(21) 98765-4321","21987654321"])
   assert.equal((await read({query})).total,1,query);
  assert.equal((await read({kind:"contact",query:"aurora contact_one@example.test"})).total,1);
  assert.equal((await read({kind:"event",query:"19/02/2099"})).total,1);
  assert.equal((await read({kind:"event",org:"org-z"})).total,1,"End client sees the same distinct event");
  assert.equal((await read({kind:"case",org:"org-a"})).total,1);
  assert.equal((await read({kind:"contact",org:"org-z"})).total,0);
  const event=await read({kind:"event",id:"event-a"});
  assert.equal(event.record.guests_planned,2);assert.equal(event.record.guests_billed,8);
  assert.equal(event.record.guests_actual,null);assert.equal(event.record.payment_claimed_brl,null);
  assert.equal(event.record.invoiced_brl,"1491.75");
  const detail=await read({id:"org-a"});
  assert.equal(detail.source_total,1);assert.equal(detail.sources[0].message_id,"<synthetic@example.test>");
  for(const field of ["body","quoted_history","source_files"])assert.equal(field in detail.sources[0],false,field);
  for(const p of [{kind:"source_index"},{limit:51},{offset:-1},{query:"a".repeat(201)},{sort:"injected"},{id:"missing"}])
   await assert.rejects(read(p),e=>e.code==="22023");
  await assert.rejects(actor(claims,"select * from event_crm.foundation_records"),e=>e.code==="42501");
  const after=(await c.query("select (select count(*) from public.propostas)::int proposals,(select count(*) from public.oportunidades)::int opportunities,(select count(*) from public.solicitacoes_cotacao)::int requests")).rows[0];
  assert.deepEqual(after,before,"Reads do not alter operational records");
  const countBefore=(await c.query("select count(*)::int n from event_crm.foundation_records")).rows[0].n;
  await c.query("savepoint crm_rollback");
  await c.query(sql("supabase/rollback/historical_crm_owner_read.sql"));
  assert.equal((await c.query("select to_regprocedure('public.event_crm_history(text,text,text,integer,integer,text,text)') p")).rows[0].p,null);
  assert.equal((await c.query("select count(*)::int n from event_crm.foundation_records")).rows[0].n,countBefore);
  await c.query("rollback to savepoint crm_rollback");await c.query("release savepoint crm_rollback");
  const migration=migrationFiles.find(f=>f.endsWith("_historical_crm_owner_read.sql"));
  await c.query(sql("supabase/migrations/"+migration));
  assert.equal((await read()).total,2,"Reapplying the migration preserves historical rows");
  assert.equal((await c.query("select count(*)::int n from event_crm.foundation_records")).rows[0].n,countBefore);
  console.log("PASS historical CRM active Master/session gate, anonymous and forged identity denial, search, pagination, evidence scope, no operational writes, idempotence and data-preserving rollback");
 }finally{await c.query("rollback");}
};
