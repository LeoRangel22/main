// Last-moment reads complement (not replace) the locked SQL claim checks.
// A stale/error result is a proven non-attempt, never permission to retry.
export async function approvalDispatchCurrent(worker: any, approvalId: string, revision: number, kind='notification') {
  try {
    const {data:a,error:ae}=await worker.from('event_proposal_approvals').select('*').eq('id',approvalId).single();
    if(ae||!a||a.revision!==revision)return false;
    const {data:p,error:pe}=await worker.from('propostas').select('id,revision,is_current,status').eq('id',a.proposal_id).single();
    if(pe||!p||p.is_current!==true||['cancelado','pos_venda'].includes(p.status)||(kind!=='dispatch_attention'&&p.revision!==revision))return false;
    const {data:newer,error:ne}=await worker.from('event_proposal_approvals').select('id').eq('supersedes_id',a.id).limit(1);
    if(ne||!Array.isArray(newer)||newer.length)return false;
    if(kind==='dispatch_attention'){
      if(a.status!=='approved')return false;
      if(!a.send_id)return new Date(a.decided_at).getTime()<=Date.now()-600000;
      const {data:s,error:se}=await worker.from('event_outbox').select('status,delivery_status,updated_at').eq('id',a.send_id).single();
      if(se||!s||['accepted','delivered','read'].includes(s.delivery_status)||s.status==='accepted')return false;
      return ['failed','uncertain'].includes(s.status)||(s.status==='sending'&&new Date(s.updated_at).getTime()<=Date.now()-600000);
    }
    if(a.status!=='pending')return false;
    const expiry=new Date(a.expires_at).getTime();
    if(kind==='approval_expired')return Number.isFinite(expiry)&&expiry<=Date.now();
    if(!Number.isFinite(expiry)||expiry<=Date.now())return false;
    if(kind==='approval_waiting')return new Date(a.created_at).getTime()<=Date.now()-7200000;
    if(['notification_failed','notification_stalled'].includes(kind)){
      const {data:notices,error:nerr}=await worker.from('event_approval_notifications').select('status,updated_at').eq('approval_id',a.id);
      if(nerr||!Array.isArray(notices))return false;
      return notices.some((n:any)=>kind==='notification_failed'?n.status==='failed':n.status==='uncertain'||(['pending','sending'].includes(n.status)&&new Date(n.updated_at).getTime()<=Date.now()-600000));
    }
    return kind==='notification';
  }catch{return false;}
}
