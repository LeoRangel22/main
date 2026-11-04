(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const BASE='https://leorangel22.github.io/main/proposta.html?p=';
  const UUID=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
  const HASH=/^[a-f0-9]{64}$/;
  const SUBJECT='[TESTE EVENTOS] QA-COM-EMAIL-01 — sem valor comercial';
  const TEXT_SHA256='3cb5fe4c494dbfc1153166d1f20d762c2b3d784eabdd6a5d53808616d1267099';
  const SEALED=['sending','accepted','uncertain'];
  const state={actor:null,generation:0,busy:false,record:null,preview:null,attempted:true,prepareAttempted:true};
  let client;
  const notice=text=>{$('emailPilotStatus').textContent=text;};
  const outcome=text=>{$('emailPilotOutcome').textContent=text;};
  const sameActor=(a,b)=>!!a&&!!b&&a.id===b.id&&a.email===b.email;
  const current=(generation,actor)=>generation===state.generation&&sameActor(actor,state.actor);
  const email=value=>typeof value==='string'&&value===value.trim()&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value.toLowerCase():null;
  const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
  async function textMatches(value){
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')===TEXT_SHA256;
  }
  const safeFlags=r=>r?.approvalRequired===false&&r?.captureActive===false;
  const prepareKey=actor=>'event-neutral-email-prepare:'+actor.id;
  const sendKey=(actor,record)=>'event-neutral-email-attempt:'+actor.id+':'+record.proposalId;
  function bounded(work,ms=8000){
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('UNCONFIRMED')),ms);
      Promise.resolve().then(work).then(value=>{clearTimeout(timer);resolve(value);},()=>{clearTimeout(timer);reject(Error('UNCONFIRMED'));});
    });
  }
  function marker(key){return sessionStorage.getItem(key)!==null;}
  function seal(key){sessionStorage.setItem(key,'requested');if(sessionStorage.getItem(key)!=='requested')throw Error('STORAGE_UNAVAILABLE');}
  function clearPreview(){
    state.preview=null;$('emailConfirmSend').checked=false;$('emailPreviewPanel').hidden=true;
    for(const id of ['emailPreviewTo','emailPreviewSender','emailPreviewSubject','emailPreviewText','emailPreviewCloses'])$(id).textContent='';
  }
  function clear(){
    state.actor=null;state.record=null;state.attempted=true;state.prepareAttempted=true;clearPreview();
    $('emailPilotWorkspace').hidden=true;$('emailPilotLogin').hidden=true;$('emailConfirmPrepare').checked=false;
    $('emailPilotMetadata').replaceChildren();$('emailPilotState').textContent='Estado ainda não consultado.';outcome('');
  }
  function livePreview(preview=state.preview){return !!preview&&preview.ready===true&&iso(preview.closesAt)&&Date.now()<Date.parse(preview.closesAt);}
  function ready(record=state.record){return record?.state==='ready'&&safeFlags(record)&&!state.attempted;}
  function controls(){
    const access=!!state.actor&&!state.busy;
    $('emailVerifyAccess').disabled=state.busy;
    $('emailReadStatus').disabled=!access;
    $('emailConfirmPrepare').disabled=!access||state.record?.state!=='absent'||!safeFlags(state.record)||state.prepareAttempted;
    $('emailPrepareCase').disabled=$('emailConfirmPrepare').disabled||!$('emailConfirmPrepare').checked;
    $('emailPreview').disabled=!access||!ready();
    $('emailConfirmSend').disabled=!access||!ready()||!livePreview();
    $('emailSendOnce').disabled=$('emailConfirmSend').disabled||!$('emailConfirmSend').checked;
  }
  function normalized(value,actor){
    const allowed=['state','proposalId','revision','publicToken','email','sendId','approvalRequired','captureActive'];
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||
      !['absent','ready','sending','accepted','uncertain','blocked'].includes(value.state)||
      typeof value.approvalRequired!=='boolean'||typeof value.captureActive!=='boolean')throw Error('INVALID_STATUS');
    if(value.email!==undefined&&email(value.email)!==actor.email)throw Error('WRONG_OWNER');
    for(const key of ['proposalId','publicToken','sendId'])if(value[key]!==undefined&&(typeof value[key]!=='string'||!UUID.test(value[key])))throw Error('INVALID_STATUS');
    if(value.revision!==undefined&&value.revision!==1)throw Error('INVALID_REVISION');
    if(value.state==='ready'&&(!UUID.test(value.proposalId||'')||!UUID.test(value.publicToken||'')||value.revision!==1||email(value.email)!==actor.email))throw Error('INVALID_READY');
    return Object.freeze({...value,email:value.email===undefined?undefined:actor.email});
  }
  const sameCase=(a,b)=>!!a&&!!b&&a.proposalId===b.proposalId&&a.publicToken===b.publicToken&&a.revision===b.revision&&a.email===b.email;
  function renderRecord(record,actor){
    const old=state.record;if(!sameCase(old,record)||record.state!=='ready'||!safeFlags(record))clearPreview();
    state.record=record;
    state.prepareAttempted=marker(prepareKey(actor));
    state.attempted=SEALED.includes(record.state)||!!record.proposalId&&marker(sendKey(actor,record));
    const labels={absent:'Nenhum caso neutro preparado.',ready:'Caso neutro preparado. Nenhum envio comprovado por este estado.',sending:'Tentativa em processamento. Não repita.',accepted:'Aceito pelo provedor. Entrega na caixa de entrada não comprovada.',uncertain:'Resultado incerto. Não repita o envio.',blocked:'Caso bloqueado. Nenhuma ação de envio disponível.'};
    $('emailPilotState').textContent=labels[record.state];
    const rows=[['Estado',labels[record.state]],['Política de aprovação',record.approvalRequired?'Obrigatória: piloto bloqueado':'Sem aprovação obrigatória'],['Captura automática',record.captureActive?'Ativa: piloto bloqueado':'Desligada']];
    if(record.email)rows.push(['Destinatário confirmado',actor.email]);
    if(record.proposalId)rows.push(['Referência do caso',record.proposalId]);
    if(record.sendId)rows.push(['Registro da tentativa',record.sendId]);
    const list=$('emailPilotMetadata');list.replaceChildren();
    for(const [label,text]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=text;list.append(dt,dd);}
    if(!safeFlags(record))outcome('Política de aprovação ou captura ativa impede este piloto. A página não altera esses controles.');
  }
  async function identity(expected){
    return bounded(async()=>{
      const r=await client.auth.getUser(),u=r.data?.user;
      if(r.error||!u||typeof u.id!=='string'||!UUID.test(u.id)||!email(u.email)||!u.email_confirmed_at||!Number.isFinite(Date.parse(u.email_confirmed_at)))throw Error('ACCESS_UNCONFIRMED');
      const actor={id:u.id,email:email(u.email)};
      if(expected&&!sameActor(actor,expected))throw Error('SESSION_CHANGED');
      const [master,team]=await Promise.all([client.rpc('is_super_admin'),client.rpc('is_team_member')]);
      if(master.error||team.error||master.data!==true||team.data!==true)throw Error('ACCESS_UNCONFIRMED');
      return actor;
    }).catch(()=>{if(expected&&sameActor(expected,state.actor))invalidateAccess();throw Error('ACCESS_UNCONFIRMED');});
  }
  async function status(actor){
    const r=await bounded(()=>client.rpc('event_neutral_email_pilot',{action:'status'}));
    if(r.error)throw Error('STATUS_UNCONFIRMED');
    return normalized(r.data,actor);
  }
  function invalidateAccess(){++state.generation;clear();state.busy=false;$('emailPilotLogin').hidden=false;notice('Acesso ou sessão não confirmado. Verifique novamente. Nenhuma ação será repetida automaticamente.');controls();}
  async function load(){
    if(state.busy)return;const generation=++state.generation;clear();state.busy=true;controls();notice('Verificando identidade, Master e equipe.');
    try{const actor=await identity();if(generation!==state.generation)return;state.actor=actor;$('emailPilotWorkspace').hidden=false;notice('Acesso confirmado. Consulte o estado para iniciar. Nada foi criado ou enviado.');}
    catch{if(generation===state.generation){clear();$('emailPilotLogin').hidden=false;notice('Não foi possível confirmar acesso Master, equipe e e-mail confirmado. Entre com sua conta existente.');}}
    finally{if(generation===state.generation){state.busy=false;controls();}}
  }
  async function readback(generation,actor){
    await identity(actor);if(!current(generation,actor))return;
    const record=await status(actor);if(!current(generation,actor))return;renderRecord(record,actor);return record;
  }
  $('emailVerifyAccess').addEventListener('click',()=>void load());
  $('emailConfirmPrepare').addEventListener('change',controls);
  $('emailConfirmSend').addEventListener('change',controls);
  $('emailReadStatus').addEventListener('click',async()=>{
    if(state.busy||!state.actor)return;const generation=state.generation,actor=state.actor;state.busy=true;controls();
    try{const record=await readback(generation,actor);if(record)notice(state.attempted?'Estado consultado. Tentativa selada; somente leitura disponível.':'Estado consultado. Nenhum caso criado ou e-mail enviado.');}
    catch{if(current(generation,actor)){clearPreview();state.record=null;state.attempted=true;notice('Estado não confirmado. Nenhuma ação foi repetida. Consulte novamente somente para leitura.');}}
    finally{if(current(generation,actor)){state.busy=false;controls();}}
  });
  $('emailPrepareCase').addEventListener('click',async()=>{
    if(state.busy||!state.actor||state.record?.state!=='absent'||!safeFlags(state.record)||state.prepareAttempted||!$('emailConfirmPrepare').checked)return;
    const generation=state.generation,actor=state.actor;state.busy=true;controls();let requested=false;
    try{
      await identity(actor);if(!current(generation,actor))return;
      const fresh=await status(actor);if(!current(generation,actor))return;
      if(fresh.state!=='absent'||!safeFlags(fresh)){renderRecord(fresh,actor);throw Error('PRECONDITION_CHANGED');}
      if(marker(prepareKey(actor)))throw Error('ALREADY_ATTEMPTED');
      seal(prepareKey(actor));state.prepareAttempted=true;
      const r=await bounded(()=>{
        if(!current(generation,actor)||!$('emailConfirmPrepare').checked)throw Error('SESSION_CHANGED');
        requested=true;return client.rpc('event_neutral_email_pilot',{action:'prepare'});
      });
      if(!current(generation,actor))return;
      if(r.error)throw Error('PREPARE_UNCONFIRMED');renderRecord(normalized(r.data,actor),actor);notice('Resultado da preparação consultado. Preparar não envia e-mail.');
    }catch{if(current(generation,actor)){outcome(requested?'Preparação não confirmada. Não repita a criação; consulte somente o estado.':'Pré-condições não confirmadas. Nenhuma preparação foi iniciada por esta chamada.');if(requested)try{await readback(generation,actor);}catch{/* Read-only recovery; never repeat prepare. */}}}
    finally{if(current(generation,actor)){state.busy=false;controls();}}
  });
  $('emailPreview').addEventListener('click',async()=>{
    if(state.busy||!state.actor||!ready())return;const generation=state.generation,actor=state.actor,record=state.record;state.busy=true;clearPreview();controls();
    try{
      await identity(actor);if(!current(generation,actor))return;
      const fresh=await status(actor);if(!current(generation,actor))return;
      if(!sameCase(record,fresh)||fresh.state!=='ready'||!safeFlags(fresh)||marker(sendKey(actor,record))){renderRecord(fresh,actor);throw Error('PRECONDITION_CHANGED');}
      const r=await bounded(()=>{
        if(!current(generation,actor)||!sameCase(state.record,record))throw Error('SESSION_CHANGED');
        return client.functions.invoke('send-proposal-email',{body:{proposalId:record.proposalId,email:actor.email,proposalUrl:BASE+record.publicToken,reviewedRevision:1,preview:true,message:''}});
      });
      if(!current(generation,actor)||!sameCase(state.record,record))return;
      const v=r.data,n=v?.neutralPilot;
      if(r.error||v?.ok!==true||email(v.email)!==actor.email||v.reviewedRevision!==1||typeof v.contentHash!=='string'||!HASH.test(v.contentHash)||
        v.subject!==SUBJECT||typeof v.text!=='string'||!v.text.includes('QA-COM-EMAIL-01')||v.text.length>100000||
        typeof v.sender!=='string'||!v.sender.trim()||v.sender.length>1000||!n||n.contract!=='smtp-neutral-receipt-v1'||typeof n.ready!=='boolean'||n.proposalId!==record.proposalId||
        n.ready&&(!iso(n.closesAt)||Date.now()>=Date.parse(n.closesAt)||Date.parse(n.closesAt)-Date.now()>900000)||!await textMatches(v.text))throw Error('PREVIEW_UNCONFIRMED');
      if(!current(generation,actor)||!sameCase(state.record,record))return;
      const preview=Object.freeze({proposalId:record.proposalId,email:actor.email,subject:v.subject,text:v.text,sender:v.sender,contentHash:v.contentHash,ready:n.ready,closesAt:n.closesAt});
      state.preview=preview;$('emailPreviewTo').textContent=preview.email;$('emailPreviewSender').textContent=preview.sender;$('emailPreviewSubject').textContent=preview.subject;$('emailPreviewText').textContent=preview.text;$('emailPreviewCloses').textContent=n.ready?n.closesAt:'Janela não disponível';$('emailPreviewPanel').hidden=false;
      notice(n.ready?'Prévia exata disponível. Revise todos os campos antes de confirmar.':'Prévia disponível, mas a janela de envio não está pronta. Nenhum envio habilitado.');
    }catch{if(current(generation,actor)){clearPreview();notice('Prévia ou janela não confirmada. O envio continua bloqueado. Nenhum e-mail enviado.');}}
    finally{if(current(generation,actor)){state.busy=false;controls();}}
  });
  $('emailSendOnce').addEventListener('click',async()=>{
    if(state.busy||!state.actor||!ready()||!livePreview()||!$('emailConfirmSend').checked)return;
    const generation=state.generation,actor=state.actor,record=state.record,preview=state.preview;state.busy=true;controls();let requested=false;
    try{
      await identity(actor);if(!current(generation,actor))return;
      const fresh=await status(actor);if(!current(generation,actor))return;
      if(!sameCase(record,fresh)||fresh.state!=='ready'||!safeFlags(fresh)){renderRecord(fresh,actor);throw Error('PRECONDITION_CHANGED');}
      if(!livePreview(preview)||state.preview!==preview||marker(sendKey(actor,record)))throw Error('PREVIEW_EXPIRED');
      seal(sendKey(actor,record));state.attempted=true;
      // No cancellation or retry: timeout cannot prove that an in-flight send did not happen.
      const r=await bounded(()=>{
        if(!current(generation,actor)||state.preview!==preview||!sameCase(state.record,record)||!livePreview(preview)||!$('emailConfirmSend').checked)throw Error('SESSION_CHANGED');
        requested=true;return client.functions.invoke('send-proposal-email',{body:{proposalId:record.proposalId,email:actor.email,proposalUrl:BASE+record.publicToken,reviewedRevision:1,preview:false,message:'',approved:true,reviewedContentHash:preview.contentHash}});
      },30000);
      if(!current(generation,actor))return;
      const closed=r.data?.code==='SMTP_PILOT_CLOSED'||r.data?.error==='SMTP_PILOT_CLOSED';
      outcome(closed?'Janela fechada. Não repita o envio; confira somente o estado salvo.':r.error||r.data?.ok!==true?'Resultado não confirmado. Não repita. A consulta salva não prova que uma chamada em voo terminou.':'Solicitação respondida. Consulte o estado persistido; aceite e entrega são evidências diferentes.');
    }catch{if(current(generation,actor)){if(!requested)clearPreview();outcome(requested?'Resultado do envio não confirmado. Não repita; consulte somente o estado salvo.':'Pré-condições não confirmadas. Nenhum envio foi iniciado por esta chamada.');}}
    finally{
      if(current(generation,actor)){
        if(requested)try{await readback(generation,actor);}catch{if(current(generation,actor))notice('Tentativa selada. Estado salvo não confirmado; nenhum envio será repetido.');}
        if(current(generation,actor)){state.busy=false;controls();}
      }
    }
  });
  try{
    client=window.supabase.createClient(window.APPROVAL_CONFIG.url,window.APPROVAL_CONFIG.key);
    client.auth.onAuthStateChange((event,session)=>{
      // This callback stays synchronous. Identity and roles are checked on each explicit action.
      if(state.actor&&session?.user?.id===state.actor.id&&email(session.user.email)===state.actor.email&&['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED'].includes(event))return;
      if(!state.actor&&event==='INITIAL_SESSION')return;
      if(['SIGNED_OUT','SIGNED_IN','USER_UPDATED','PASSWORD_RECOVERY','TOKEN_REFRESHED','INITIAL_SESSION'].includes(event)||session?.user?.id!==state.actor?.id)invalidateAccess();
    });
    setInterval(()=>{if(state.preview?.ready&&!livePreview()){state.preview=null;$('emailConfirmSend').checked=false;notice('A janela da prévia expirou. Nenhum envio novo está habilitado. Consulte o estado e coordene o encerramento.');}controls();},500);
    void load();
  }catch{invalidateAccess();notice('Não foi possível iniciar a verificação. Nenhum caso criado ou e-mail enviado.');}
})();
