// Called only in the authenticated backend worker, never returned to a browser.
export async function mailboxTokenEnvironment(worker:any,accountId:string|null,env:(name:string)=>string|undefined){
  if(!accountId)return env;
  const r=await worker.rpc('event_mailbox_oauth_worker_credential',{target_account:accountId});
  if(r.error||typeof r.data?.available!=='boolean')throw Error('oauth_credential_unavailable');
  if(!r.data.available)return env;
  if(env('EVENT_MAILBOX_REFRESH_TOKEN'))throw Error('oauth_credential_source_conflict');
  if(typeof r.data.refresh_token!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(r.data.refresh_token))throw Error('oauth_credential_unavailable');
  const refresh=r.data.refresh_token;
  return (name:string)=>name==='EVENT_MAILBOX_REFRESH_TOKEN'?refresh:env(name);
}
