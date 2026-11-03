// Server-side bounded capture. This does not enable flags or authorize messages.
export function mailboxCaptureScope(cfg:any,now=Date.now()) {
 const ids=cfg.capture_send_ids,start=cfg.capture_started_at_ms,end=cfg.capture_expires_at_ms,limit=cfg.capture_message_limit,used=cfg.capture_used_messages;
 if(cfg.enabled!==true||cfg.channel_enabled!==true||!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length||ids.some((id:any)=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end-start>900000||now<start||now>=end||!Number.isSafeInteger(limit)||limit<1||limit>20||!Number.isSafeInteger(used)||used<0)throw new Error('mailbox_capture_inactive');
 return {sendIds:ids.slice().sort(),startedAt:start,expiresAt:end,messageLimit:limit,remaining:Math.max(0,limit-used)};
}
