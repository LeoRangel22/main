const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async function(c,connect,database){
 for(const firstKind of ['draft','submit']){
  const token=randomUUID(),a=await connect(database),b=await connect(database);let pending,opportunity;
  const attribution={version:1,utm_source:'embaixadacarioca',utm_medium:'website',utm_campaign:'eventos',utm_content:'index_es'};
  const snapshot={cliente:{nome:'Synthetic Concurrent Visitor',email:'concurrent@example.invalid',idioma:'es'},evento:{tipo:'Coquetel',convidados:20},attribution};
  try{
   await a.query('begin');await a.query('set local session_replication_role=replica');
   await b.query('begin');await b.query('set local session_replication_role=replica');
   const first=(await a.query(firstKind==='draft'?"select * from upsert_public_quote_draft($1,$2,'essencial')":'select * from submit_public_quote_request($1,$2)',[token,JSON.stringify(snapshot)])).rows[0];opportunity=first.opportunity_id;
   const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
   pending=b.query('select * from submit_public_quote_request($1,$2)',[token,JSON.stringify({...snapshot,attribution:{...attribution,utm_content:'contato'}})]);
   const observed=pending.then(result=>({result}),error=>({error}));let waiting=false;
   for(let i=0;i<100;i++){const row=(await c.query('select wait_event from pg_stat_activity where pid=$1',[pid])).rows[0];if(row?.wait_event==='advisory'){waiting=true;break}await new Promise(r=>setTimeout(r,20))}
   assert.equal(waiting,true,`${firstKind}/submit must wait on existing capture-token fence`);
   await a.query('commit');const next=await observed;if(next.error)throw next.error;await b.query('commit');
   assert.equal(next.result.rows[0].request_id,first.request_id);assert.equal(next.result.rows[0].opportunity_id,first.opportunity_id);
   const rows=(await c.query('select snapshot, oportunidade_id from solicitacoes_cotacao where capture_token=$1',[token])).rows;
   assert.equal(rows.length,1);assert.deepEqual(rows[0].snapshot.attribution,attribution);
   const metadata=(await c.query('select metadata from oportunidades where id=$1',[opportunity])).rows[0].metadata;assert.deepEqual(metadata.attribution,attribution);
   console.log(`PASS native ${firstKind}/submit race preserves first attribution and one request/opportunity`);
  }finally{
   await a.query('rollback').catch(()=>{});await pending?.catch(()=>{});await b.query('rollback').catch(()=>{});await Promise.all([a.end(),b.end()]);
   await c.query('begin');try{await c.query('set local session_replication_role=replica');await c.query('delete from solicitacoes_cotacao where capture_token=$1',[token]);if(opportunity)await c.query('delete from oportunidades where id=$1',[opportunity]);await c.query('commit')}catch(e){await c.query('rollback');throw e}
  }
 }
};
