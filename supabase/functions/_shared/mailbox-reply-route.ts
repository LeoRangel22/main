// Correlation capability only: it never authenticates an author or approves a sale.
const ROUTE=/^eventos\+([a-z2-7]{51}[aq])@embaixadacarioca\.com\.br$/;
export function mailboxReplyRoute(address:unknown) {
 if(typeof address!=='string'||!ROUTE.test(address))throw new Error('reply_route_invalid');
 return address;
}
export function validatePreparedReplyRoute(value:any,contextHash:string) {
 if(!value||Object.keys(value).sort().join(',')!=='context_hash,id,reply_to,version'||value.version!==1||
 !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.id)||
 !/^[0-9a-f]{64}$/.test(contextHash)||value.context_hash!==contextHash)throw new Error('reply_route_invalid');
 mailboxReplyRoute(value.reply_to);
 if(value.reply_to.split('@')[0].length>64)throw new Error('reply_route_invalid');
 return Object.freeze({...value});
}

// A bounded pilot must not enable routing for unrelated proposals.
type ReplyRoutingGate = Readonly<{mode:'off'|'public'|'pilot'; configuration:string}>;
export function proposalReplyRoutingGate(env:(name:string)=>string|undefined, proposalId:string, destination:string, now=Date.now()): ReplyRoutingGate {
 if(env('EVENT_PROPOSAL_REPLY_ROUTES_ENABLED')==='true')return Object.freeze({mode:'public',configuration:''});
 const raw=env('EVENT_PROPOSAL_REPLY_ROUTE_PILOT');
 if(raw===undefined||raw==='')return Object.freeze({mode:'off',configuration:''});
 const invalid=()=>{throw new Error('reply_route_pilot_invalid');};
 let v:any;
 try{if(raw.length>2048)invalid();v=JSON.parse(raw);}catch{invalid();}
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='expires_at,proposal_ids,recipient,started_at'||
 !Array.isArray(v.proposal_ids)||v.proposal_ids.length<1||v.proposal_ids.length>2||
 v.proposal_ids.some((id:unknown)=>typeof id!=='string'||!uuid.test(id))||new Set(v.proposal_ids).size!==v.proposal_ids.length||
 typeof v.recipient!=='string'||v.recipient.length>254||v.recipient!==v.recipient.trim().toLowerCase()||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v.recipient)||
 typeof v.started_at!=='string'||typeof v.expires_at!=='string')invalid();
 const start=Date.parse(v.started_at),end=Date.parse(v.expires_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||new Date(start).toISOString()!==v.started_at||
 new Date(end).toISOString()!==v.expires_at||end<=start||end-start>900000)invalid();
 if(!v.proposal_ids.includes(proposalId))return Object.freeze({mode:'off',configuration:''});
 if(typeof destination!=='string'||destination.trim().toLowerCase()!==v.recipient)throw new Error('reply_route_pilot_recipient');
 if(!Number.isFinite(now)||now<start||now>=end)throw new Error('reply_route_pilot_closed');
 return Object.freeze({mode:'pilot',configuration:raw});
}
