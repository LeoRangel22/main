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
