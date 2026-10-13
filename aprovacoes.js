(() => {
  'use strict';
  const client = window.supabase.createClient(window.APPROVAL_CONFIG.url,window.APPROVAL_CONFIG.key);
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const date=v=>String(v||'').split('-').reverse().join('/');
  const lines=v=>Array.isArray(v)?v.map(lines).join('\n'):typeof v==='object'&&v?Object.entries(v).map(([k,x])=>`${k}: ${lines(x)}`).join('\n'):String(v??'');
  const state={id:new URLSearchParams(location.search).get('id'),current:null,user:null,busy:false,generation:0};
  const labels={pending:'Aguardando aprovação',approved:'Aprovação registrada',changes_requested:'Ajustes solicitados',rejected:'Versão rejeitada',invalidated:'Versão alterada — solicite nova aprovação'};
  function notice(message,error=false){$('notice').textContent=message;$('notice').className=error?'error':'';}
  async function api(body){const r=await client.functions.invoke('event-proposal-approval',{body});if(r.error||!r.data?.ok){let message=r.data?.message;try{message=message||(await r.error.context.clone().json()).message;}catch{}throw Error(message||'A operação não foi confirmada. Atualize o histórico antes de repetir.');}return r.data;}
  function disable(value){state.busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);}
  function status(a){if(a.send?.status==='accepted')return 'Aprovada · envio aceito pelo provedor. Entrega não confirmada.';if(a.send?.status==='uncertain'||a.send?.status==='sending')return 'Aprovação registrada · envio em andamento ou incerto. Não repita sem conferir o provedor.';if(a.send?.status==='failed')return 'Aprovação registrada · envio recusado. Revise o canal antes de solicitar novo envio.';if(a.status==='pending'&&(a.stale||a.expired))return a.expired?'Solicitação expirada — solicite nova revisão':'A proposta mudou — solicite nova revisão';return labels[a.status]||a.status;}
  function render(a){
    state.current=a;const p=a.proposal_snapshot,c=a.content,s=p.snapshot||{};
    const discount=Math.max(0,-Number(s.totals?.adjustment||0))+Math.max(0,-Number(s.totals?.privatizationAdjustment||0));
    const allowed=a.can_decide&&!a.expired&&!a.stale&&!a.send_id&&['pending','approved'].includes(a.status);
    const nstatus={pending:'aguardando processamento',sending:'em andamento; resultado ainda não confirmado',accepted:'aceito pelo provedor; entrega não confirmada',failed:'recusado',uncertain:'resultado incerto; não repetir automaticamente'};
    $('detail').hidden=false;$('list').hidden=true;
    $('detail').innerHTML=`<div class="summary"><p class="eyebrow">VERSÃO ${esc(p.versao)} · REVISÃO ${esc(a.revision)}</p><h2>${esc(p.cliente_nome)}</h2><p>${esc(p.tipo_evento)} · ${esc(date(p.data_evento))} às ${esc(String(p.horario_evento||'').slice(0,5))} (Brasília)</p><p class="amount">${esc(money(p.total))}</p><p class="status">${esc(status(a))}</p></div>
      <dl class="metadata">${[['Convidados',p.convidados],['Duração',`${p.duracao} h`],['Subtotal',money(p.subtotal)],['Taxa de serviço',money(p.taxa_servico)],['Privatização',money(p.privatizacao)],['Desconto total',money(discount)],['Canal para o cliente',c.channel],['Destinatário exato',c.destination],['Remetente',c.sender],['Assunto',c.title],['Gestor responsável',a.approver_email],['Validade desta solicitação',new Date(a.expires_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília)']].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${discount>0?'<p class="warning">A aprovação também autoriza o desconto e as condições exibidas nesta versão.</p>':''}
      <h3>Itens da proposta</h3><ul class="items">${(s.selectedItems||[]).map(i=>`<li><strong>${esc(i.name||i.nome||'Item')} — ${esc(money(i.calc?.total??i.total))}</strong><br>${esc(i.description||i.descricao||'')}<br><small>${esc(i.calc?.detail||i.calc?.label||'')}</small></li>`).join('')}</ul>
      <h3>Condições gerais</h3><div class="terms">${esc(lines(s.generalTerms))||'Não informadas'}</div>
      <h3>Condições de pagamento</h3><div class="terms">${esc(lines(s.paymentTerms))||'Confira as condições da proposta'}</div><p>Prazo do sinal: ${esc(s.event?.signalDeadlineHours??48)} horas após o envio.</p>
      <h3>Briefing / observações internas</h3><div class="terms">${esc(s.event?.notes||'Sem observações')}</div>
      <h3>Mensagem exata para o cliente</h3>${c.html?'<iframe id="emailPreview" title="E-mail completo que será enviado" sandbox="" referrerpolicy="no-referrer"></iframe>':''}<label for="exactMessage">${c.html?'Versão completa em texto':'WhatsApp'}</label><textarea id="exactMessage" readonly rows="10">${esc(c.body)}</textarea>
      <details><summary>Avisos e rastreabilidade</summary><p class="notification">${(a.notifications||[]).map(n=>`${esc(n.channel)}: ${esc(nstatus[n.status]||n.status)}`).join('<br>')}</p><p>Solicitação ${esc(a.id)}. Os avisos de WhatsApp e e-mail apontam para esta mesma decisão.</p><button id="retryNotifications">Reprocessar avisos pendentes ou recusados</button></details>
      ${a.reason?`<h3>Orientação registrada</h3><p class="terms">${esc(a.reason)}</p>`:''}
      <div class="decisions">${allowed?`<label class="check"><input type="checkbox" id="confirmed">Revisei a proposta completa, os valores, o desconto, a mensagem e o destinatário. Ao aprovar, autorizo o envio ao cliente.</label><label for="reason">Orientação à equipe</label><textarea id="reason" maxlength="2000" placeholder="Obrigatória para solicitar ajustes ou rejeitar esta versão."></textarea><button class="primary" data-decision="approve">${a.status==='approved'?'Concluir envio aprovado':'Aprovar e enviar ao cliente'}</button>${a.status==='pending'?'<button data-decision="changes_requested">Solicitar ajustes</button><button data-decision="rejected">Rejeitar esta versão</button>':''}`:`<p>${a.can_decide?'Esta solicitação não permite novo envio. Confira o estado acima.':'Somente o gestor designado pode decidir. Você pode acompanhar o estado e as orientações.'}</p>`}</div>`;
    if(c.html)$('emailPreview').srcdoc='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:;">'+c.html;
    $('retryNotifications').disabled=a.status!=='pending'||a.expired||a.stale;
    $('retryNotifications').onclick=()=>run(async()=>{const r=await api({action:'notify',id:a.id});render(r.approval);notice('Avisos processados. Aceitação não comprova entrega.');});
    $('detail').querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>decide(b.dataset.decision));
  }
  async function run(fn){if(state.busy)return;disable(true);try{await fn();}catch(e){notice(e.message,true);}finally{disable(false);const r=$('retryNotifications');if(r&&state.current)r.disabled=state.current.status!=='pending'||state.current.expired||state.current.stale;}}
  async function decide(action){const a=state.current;if(!a||state.busy)return;const reason=$('reason')?.value.trim()||'';
    if(action==='approve'&&!$('confirmed')?.checked){notice('Marque a confirmação após revisar a mensagem e o destinatário.',true);return;}
    if(action!=='approve'&&reason.length<3){notice('Informe o motivo para orientar a equipe.',true);$('reason').focus();return;}
    await run(async()=>{const generation=state.generation;const r=await api({action,id:a.id,reviewHash:a.review_hash,confirmed:true,reason});if(generation!==state.generation)return;render(r.approval);notice(r.warning||status(r.approval),Boolean(r.warning));});
  }
  async function load(){
    const generation=++state.generation;const {data,error}=await client.auth.getUser();
    if(generation!==state.generation)return;
    state.user=data?.user||null;$('login').hidden=Boolean(state.user);$('workspace').hidden=!state.user;$('logout').hidden=!state.user;
    if(error||!state.user){state.current=null;$('detail').innerHTML='';$('list').innerHTML='';notice('Entre para acessar a solicitação. Nenhuma decisão foi registrada.');return;}
    const policy=await client.rpc('event_approval_policy');if(policy.error)throw Error('Esta conta não possui acesso à equipe de Eventos.');
    $('identity').textContent=`${state.user.email} · ${policy.data.is_approver?'Gestor aprovador':'Consulta da equipe'}`;
    if(state.id){if(!/^[0-9a-f-]{36}$/i.test(state.id))throw Error('Identificador de solicitação inválido.');const r=await api({action:'get',id:state.id});if(generation!==state.generation)return;render(r.approval);notice(status(r.approval));}
    else {
      const r=await client.from('event_proposal_approvals').select('id,status,created_at,expires_at,reason,send_id,cliente_nome:proposal_snapshot->>cliente_nome,data_evento:proposal_snapshot->>data_evento,total:proposal_snapshot->>total,channel:content->>channel').order('created_at',{ascending:false}).limit(50);
      if(r.error)throw Error('Não foi possível carregar as solicitações.');if(generation!==state.generation)return;
      $('detail').hidden=true;$('list').hidden=false;$('list').innerHTML=(r.data||[]).map(a=>`<div class="request"><h3>${esc(a.cliente_nome)}</h3><p>${esc(date(a.data_evento))} · ${esc(money(a.total))} · ${esc(a.channel)}</p><p>${esc(labels[a.status]||a.status)}${a.status==='pending'&&Date.parse(a.expires_at)<=Date.now()?' · expirada':''}</p>${a.reason?`<p>${esc(a.reason)}</p>`:''}<a href="./aprovacoes.html?id=${esc(a.id)}">Abrir revisão e histórico</a></div>`).join('')||'<p>Nenhuma solicitação de aprovação registrada.</p>';
      notice('Até 50 solicitações recentes. A equipe acompanha decisões e ajustes nesta central.');
    }
  }
  $('loginForm').onsubmit=e=>{e.preventDefault();run(async()=>{const r=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(r.error)throw Error('Não foi possível entrar. Confira e-mail e senha.');await load();});};
  $('magicLink').onclick=()=>run(async()=>{const email=$('email').value.trim();if(!$('email').reportValidity()||!email)return;const redirect=new URL('aprovacoes.html',location.href);if(state.id)redirect.searchParams.set('id',state.id);const r=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirect.href}});if(r.error)throw Error('Não foi possível enviar o acesso. Use sua senha ou confira a configuração de e-mail.');notice('Acesso solicitado. Confira seu e-mail. O acesso não aprova propostas.');});
  $('logout').onclick=()=>run(async()=>{++state.generation;state.current=null;$('detail').innerHTML='';$('list').innerHTML='';await client.auth.signOut();await load();});
  $('refresh').onclick=()=>run(load);
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){++state.generation;state.current=null;$('workspace').hidden=true;$('detail').innerHTML='';$('list').innerHTML='';$('login').hidden=false;}});
  run(load);
})();
