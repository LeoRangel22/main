// Isolated receipt reconciliation. Never dispatches, opens a gate or consumes
// the commercial bridge cursor. The fetch adapter must authenticate the existing
// Bot export; browser input and copied logs are not evidence sources.
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const id=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,500}$/.test(v);
function stamp(v:unknown,now:number):boolean {
  if(typeof v!=='string')return false;
  const p=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(v);
  if(!p)return false;
  const y=Number(p[1]),month=Number(p[2]),day=Number(p[3]);
  const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  // Validate the source civil date before Date.parse can normalize February 31.
  // Checking UTC components would incorrectly reject valid offset date changes.
  if(month<1||month>12||day<1||day>days[month-1]||Number(p[4])>23||Number(p[5])>59||Number(p[6])>59||
    (p[7]!==undefined&&(Number(p[7])>23||Number(p[8])>59)))return false;
  const time=Date.parse(v);
  return Number.isFinite(time)&&time<=now+300000;
}
function reject():never {throw Error('Diagnostic receipt rejected');}
function unavailable(stage:'context'|'source'|'commit'):never {
  // Preserve uncertainty, never propagate a raw provider/database message or
  // an error cause that may contain a URL, credential or conversation excerpt.
  throw Object.assign(Error(stage==='commit'?'Diagnostic receipt persistence unconfirmed; read before retry':'Diagnostic receipt unavailable'),
    {code:'DIAGNOSTIC_RECEIPT_'+stage.toUpperCase()+'_UNCONFIRMED',writeMayHaveOccurred:stage==='commit'});
}

export function normalizeDiagnosticReceipt(payload:any,pilot:any,now=Date.now()) {
  if(!pilot||!uuid(pilot.id)||pilot.status!=='accepted'||pilot.attempts!==1||!id(pilot.provider_id)||
    !hash(pilot.content_hash)||!stamp(pilot.claimed_at,now))reject();
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!['ok','version','account','scope','content_hash','events'].includes(k))||payload.ok!==true||payload.version!==2||payload.account!=='bot:embaixada_urca'||payload.scope!==pilot.id||payload.content_hash!==pilot.content_hash||
    !Array.isArray(payload.events)||payload.events.length>100)reject();
  const allowed=['key','channel','purpose','kind','send_id','context_id','revision','destination_match','expected_reply_match','message_id','reply_to_id','occurred_at','captured_at','signal'];
  const result:any[]=[];
  for(const e of payload.events) {
    if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!allowed.includes(k))||
      e.channel!=='whatsapp'||e.purpose!=='event_diagnostic'||e.send_id!==pilot.id||e.context_id!==pilot.id||e.revision!==1||
      e.destination_match!==true||!id(e.key)||!id(e.message_id)||!stamp(e.occurred_at,now)||!stamp(e.captured_at,now)||
      Date.parse(e.occurred_at)<Date.parse(pilot.claimed_at)-300000||Date.parse(e.captured_at)<Date.parse(e.occurred_at)-300000)reject();
    if(e.kind==='status') {
      if(e.message_id!==pilot.provider_id||!['accepted','delivered','read'].includes(e.signal)||e.expected_reply_match!==undefined||e.reply_to_id!==undefined)reject();
    } else if(e.kind==='inbound') {
      // The authenticated Bot checks the exact response/destination locally;
      // the raw phone and body are never supplied to this module.
      if(e.reply_to_id!==pilot.provider_id||e.expected_reply_match!==true||e.signal!==undefined)reject();
    } else reject();
    // Revalidate correlation/hash/attestations in SQL, without phone/body.
    result.push({key:e.key,kind:e.kind,send_id:e.send_id,context_id:e.context_id,revision:e.revision,
      content_hash:payload.content_hash,destination_match:true,
      expected_reply_match:e.kind==='inbound'?true:null,message_id:e.message_id,reply_to_id:e.reply_to_id||null,
      signal:e.signal||null,occurred_at:new Date(e.occurred_at).toISOString(),captured_at:new Date(e.captured_at).toISOString()});
  }
  return result;
}

export async function reconcileDiagnosticReceipt(pilotId:unknown,deps:{
  readOwnedPilot:(id:string)=>Promise<any>;
  fetchAuthenticatedReceipt:(request:{scope:string,contentHash:string,originalProviderId:string})=>Promise<any>;
  commit:(id:string,events:any[])=>Promise<any>;
}) {
  if(!uuid(pilotId))reject();
  let pilot:any;
  try{pilot=await deps.readOwnedPilot(pilotId as string);}catch{unavailable('context');}
  if(!pilot||pilot.id!==pilotId)reject();
  // Validate even an empty receipt before allowing a network request.
  normalizeDiagnosticReceipt({ok:true,version:2,account:'bot:embaixada_urca',scope:pilotId,content_hash:pilot.content_hash,events:[]},pilot);
  let page:any;
  try{page=await deps.fetchAuthenticatedReceipt({scope:pilot.id,contentHash:pilot.content_hash,originalProviderId:pilot.provider_id});}catch{unavailable('source');}
  const events=normalizeDiagnosticReceipt(page,pilot);
  // A failed/uncertain authenticated fetch never synthesizes delivery or reply.
  try{return await deps.commit(pilotId as string,events);}catch{unavailable('commit');}
}
