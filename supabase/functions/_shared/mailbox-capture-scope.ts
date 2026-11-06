// Server-side bounded capture. This does not enable flags or authorize messages.
export function mailboxCaptureScope(cfg:any,now=Date.now()) {
 if(cfg.capture_mode!==undefined&&!['pilot','continuous'].includes(cfg.capture_mode))throw new Error('mailbox_capture_inactive');
 if(cfg.capture_mode==='continuous'){
  const start=cfg.continuous_started_at_ms,end=cfg.continuous_expires_at_ms;
  if(cfg.enabled!==true||cfg.channel_enabled!==true||cfg.continuous_enabled!==true||
   !Number.isSafeInteger(start)||now<start||typeof cfg.continuous_test_only!=='boolean'||
   !Array.isArray(cfg.capture_send_ids)||cfg.capture_send_ids.length!==0||
   (cfg.continuous_test_only?(!Number.isSafeInteger(end)||end<=start||end-start>3600000||now>=end):end!==null))
   throw new Error('mailbox_capture_inactive');
  return {mode:'continuous' as const,startedAt:start,expiresAt:end,messageLimit:20,remaining:20};
 }
 const ids=cfg.capture_send_ids,start=cfg.capture_started_at_ms,end=cfg.capture_expires_at_ms,limit=cfg.capture_message_limit,used=cfg.capture_used_messages;
 if(cfg.enabled!==true||cfg.channel_enabled!==true||!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length||ids.some((id:any)=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end-start>900000||now<start||now>=end||!Number.isSafeInteger(limit)||limit<1||limit>20||!Number.isSafeInteger(used)||used<0)throw new Error('mailbox_capture_inactive');
 return {sendIds:ids.slice().sort(),startedAt:start,expiresAt:end,messageLimit:limit,remaining:Math.max(0,limit-used)};
}
