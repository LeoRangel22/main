import { proposalReplyRoutingGate } from './mailbox-reply-route.ts';

// Re-read from the server before transport; never cache the owner's closing gate.
export async function ownerReplyRoutingGate(env:(name:string)=>string|undefined,
 load:()=>PromiseLike<{data:unknown,error:unknown}>, proposalId:string, destination:string, now=Date.now()) {
 const legacy=proposalReplyRoutingGate(env,proposalId,destination,now);
 const result=await load();
 if(result.error)throw new Error('reply_route_pilot_unavailable');
 if(result.data===null)return legacy;
 const v=result.data as any;
 if(!v||typeof v!=='object'||Array.isArray(v)||
  Object.keys(v).sort().join(',')!=='expires_at,proposal_ids,recipient,started_at,state,version'||
  !Number.isSafeInteger(v.version)||v.version<1||!['open','closed'].includes(v.state))throw new Error('reply_route_pilot_invalid');
 const raw=JSON.stringify({proposal_ids:v.proposal_ids,recipient:v.recipient,started_at:v.started_at,expires_at:v.expires_at});
 const gate=proposalReplyRoutingGate(k=>k==='EVENT_PROPOSAL_REPLY_ROUTE_PILOT'?raw:undefined,proposalId,destination,now);
 if(gate.mode==='off')return legacy;
 if(v.state!=='open')throw new Error('reply_route_pilot_closed');
 if(env('EVENT_PROPOSAL_REPLY_ROUTES_ENABLED')==='true'||env('EVENT_PROPOSAL_REPLY_ROUTE_PILOT'))throw new Error('reply_route_pilot_conflict');
 return Object.freeze({mode:'pilot' as const,configuration:`owner:${v.version}:${gate.configuration}`});
}

export function mailboxPilotRequest(value:any) {
 if(!value||typeof value!=='object'||Array.isArray(value)||
  Object.keys(value).some(k=>!['action','expectedVersion','ids','requestId','confirmed'].includes(k))||
  !['status','open','capture','queue','close'].includes(value.action))throw new Error('request_invalid');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
 const ids=value.ids??[];
 if(!Array.isArray(ids)||ids.length>2||ids.some((v:any)=>typeof v!=='string'||!uuid.test(v))||new Set(ids).size!==ids.length||
  (value.action!=='status'&&(!Number.isSafeInteger(value.expectedVersion)||value.expectedVersion<0))||
  (value.requestId!==undefined&&(typeof value.requestId!=='string'||!uuid.test(value.requestId)))||
  (value.confirmed!==undefined&&typeof value.confirmed!=='boolean'))throw new Error('request_invalid');
 return {action:value.action,expected_version:value.expectedVersion??null,target_ids:ids,
  request_id:value.requestId??null,confirmed:value.confirmed===true};
}

// Functional addresses only, read by an authenticated owner. No provider request.
export function leadNotificationPreflight(env:(name:string)=>string|undefined,hooks:any,owner:string) {
 const to=env('LEAD_ALERT_TO_EMAIL')||'eventos@embaixadacarioca.com.br';
 const from=env('LEAD_ALERT_FROM_EMAIL')||'';
 const email=(v:string)=>v===v.trim()&&v.length<=254&&/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(v);
 const topology=hooks?.insert===true&&hooks?.complete===true&&hooks?.unexpected===0;
 return {configured:Boolean(env('ZEPTO_MAIL_TOKEN')&&email(from)&&email(to)),
  recipient:email(to)?to:null,from:email(from)?from:null,toCount:1,ccCount:0,bccCount:0,
  maxAlertsPerCompletedLead:topology?2:null,topologyVerified:topology,
  safeForPilot:Boolean(topology&&env('ZEPTO_MAIL_TOKEN')&&email(from)&&email(to)&&
   ['eventos@embaixadacarioca.com.br',owner].includes(to.toLowerCase())),
  sendsPerformed:0};
}
