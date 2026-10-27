// Isolated receipt reconciliation. Never dispatches, opens a gate or consumes
// the commercial bridge cursor. The fetch adapter must authenticate the existing
// Bot export; browser input and copied logs are not evidence sources.
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const id=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,500}$/.test(v);
const stamp=(v:unknown,now:number)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=now+300000;
function reject():never {throw Error('Diagnostic receipt rejected');}
function unavailable(stage:'context'|'source'|'commit'):never {
  // Preserve uncertainty, never propagate a raw provider/database message or
  // an error cause that may contain a URL, credential or conversation excerpt.
  throw Object.assign(Error(stage==='commit'?'Diagnostic receipt persistence unconfirmed; read before retry':'Diagnostic receipt unavailable'),
    {code:'DIAGNOSTIC_RECEIPT_'+stage.toUpperCase()+'_UNCONFIRMED',writeMayHaveOccurred:stage==='commit'});
}

export function normalizeDiagnosticReceipt(payload:any,pilot:any,now=Date.now()) {
  if(!pilot||!uuid(pilot.id)||pilot.status!=='accepted'||pilot.attempts!==1||!id(pilot.provider_id)||
    typeof pilot.destination!=='string'||!/^\d{11,15}$/.test(pilot.destination)||!stamp(pilot.claimed_at,now))reject();
  if(!payload||payload.ok!==true||payload.version!==2||payload.account!=='bot:embaixada_urca'||payload.scope!==pilot.id||
    !Array.isArray(payload.events)||payload.events.length>100)reject();
  const allowed=['key','channel','purpose','kind','send_id','context_id','revision','destination','body','message_id','reply_to_id','occurred_at','captured_at','signal'];
  const result:any[]=[];
  for(const e of payload.events) {
    if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!allowed.includes(k))||
      e.channel!=='whatsapp'||e.purpose!=='event_diagnostic'||e.send_id!==pilot.id||e.context_id!==pilot.id||e.revision!==1||
      e.destination!==pilot.destination||!id(e.key)||!id(e.message_id)||!stamp(e.occurred_at,now)||!stamp(e.captured_at,now)||
      Date.parse(e.occurred_at)<Date.parse(pilot.claimed_at)-300000||Date.parse(e.captured_at)<Date.parse(e.occurred_at)-300000)reject();
    if(e.kind==='status') {
      if(e.message_id!==pilot.provider_id||!['accepted','delivered','read'].includes(e.signal)||e.body!==undefined||e.reply_to_id!==undefined)reject();
    } else if(e.kind==='inbound') {
      // Do not import a conversation. Only the requested exact test response,
      // explicitly replying to the one provider message, is eligible.
      if(e.reply_to_id!==pilot.provider_id||e.body!=='TESTE RECEBIDO'||e.signal!==undefined)reject();
    } else reject();
    // Private worker->database only. SQL rechecks the destination and exact
    // response, then discards phone/body instead of importing a conversation.
    result.push({key:e.key,kind:e.kind,message_id:e.message_id,reply_to_id:e.reply_to_id||null,
      destination:e.destination,body:e.kind==='inbound'?e.body:null,
      signal:e.signal||null,occurred_at:new Date(e.occurred_at).toISOString(),captured_at:new Date(e.captured_at).toISOString()});
  }
  return result;
}

export async function reconcileDiagnosticReceipt(pilotId:unknown,deps:{
  readOwnedPilot:(id:string)=>Promise<any>;
  fetchAuthenticatedReceipt:(scope:string)=>Promise<any>;
  commit:(id:string,events:any[])=>Promise<any>;
}) {
  if(!uuid(pilotId))reject();
  let pilot:any;
  try{pilot=await deps.readOwnedPilot(pilotId as string);}catch{unavailable('context');}
  if(!pilot||pilot.id!==pilotId)reject();
  // Validate even an empty receipt before allowing a network request.
  normalizeDiagnosticReceipt({ok:true,version:2,account:'bot:embaixada_urca',scope:pilotId,events:[]},pilot);
  let page:any;
  try{page=await deps.fetchAuthenticatedReceipt(pilotId as string);}catch{unavailable('source');}
  const events=normalizeDiagnosticReceipt(page,pilot);
  // A failed/uncertain authenticated fetch never synthesizes delivery or reply.
  try{return await deps.commit(pilotId as string,events);}catch{unavailable('commit');}
}
