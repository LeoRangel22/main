// The durable database claim is the idempotency boundary. Never retry transport
// after a claim, including timeouts and successful POSTs whose receipt write fails.
export async function dispatchLeadAlert(worker:any,leadId:string,send:(record:any)=>Promise<any>) {
 const claim=await worker.rpc('event_claim_lead_alert',{target_lead:leadId});
 if(claim.error||typeof claim.data?.claimed!=='boolean')throw Error('claim_unavailable');
 if(!claim.data.claimed)return {leadId,state:'skipped',code:claim.data.code};
 const c=claim.data;
 if(typeof c.claimId!=='string'||!c.record||c.record.id!==leadId||!['complete','abandoned'].includes(c.kind))throw Error('claim_invalid');
 let state='uncertain',reference:string|null=null;
 try{const result=await send(c.record);if(result?.state==='accepted'&&typeof result.providerId==='string'){state='accepted';reference=result.providerId;}else if(result?.state==='failed')state='failed';}
 catch{ /* Unknown provider result must stay claimed/uncertain; never retry. */ }
 const saved=await worker.rpc('event_finish_lead_alert',{target_claim:c.claimId,outcome:state,reference_id:reference});
 if(saved.error||saved.data!==true)throw Error('receipt_unconfirmed');
 return {leadId,state};
}
