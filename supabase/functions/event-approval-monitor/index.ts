import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { deliverManagerNotice } from "../_shared/approval-notifications.ts";

const site = "https://leorangel22.github.io/main/aprovacoes.html";
const responseHeaders = {"Content-Type":"application/json","Cache-Control":"no-store"};
const respond = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers:responseHeaders});
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const reasonLabels: Record<string,string> = {
 approval_waiting:"Proposta aguardando decisão há pelo menos duas horas.",
 approval_expired:"Solicitação de aprovação expirada. A equipe precisa solicitar uma nova revisão.",
 notification_failed:"Um aviso de aprovação foi recusado. Confira o canal e a configuração.",
 notification_stalled:"Um aviso está parado ou com resultado incerto. Não repita sem conferir o provedor.",
 dispatch_attention:"Uma aprovação foi registrada, mas o envio ao cliente precisa de conferência. Não haverá reenvio automático.",
 probe:"TESTE CONTROLADO dos avisos e alertas de aprovação. Nenhuma proposta de cliente foi criada, aprovada ou enviada.",
};
Deno.serve(async (req: Request) => {
 if(req.method!=="POST") return respond({ok:false,message:"Use POST autenticado."},405);
 const key=req.headers.get("x-approval-watch-key")||"";
 if(!/^[a-f0-9]{64}$/.test(key)) return respond({ok:false,message:"Acesso não autorizado."},401);
 try {
  const raw=await req.text();if(raw.length>256)return respond({ok:false},413);
  const input=JSON.parse(raw||"{}");
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).some(k=>k!=="probeId")||(input.probeId!=null&&!uuid(input.probeId)))return respond({ok:false,message:"Ação inválida."},400);
  const worker=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false}});
  const call=async(name:string,args:any)=>{const r=await worker.rpc(name,args);if(r.error)throw r.error;return r.data;};
  // Service-role-only RPC checks the private per-job key BEFORE reading/claiming work.
  const batch=await call("event_claim_approval_watch",{supplied_key:key,probe_id:input.probeId||null});
  if(batch.skipped)return respond({ok:true,skipped:true,processed:0});
  if(!uuid(batch.run_id)||!Array.isArray(batch.jobs)||batch.jobs.length>8)throw Error("Invalid monitor batch");
  const results=await Promise.all(batch.jobs.map(async(job:any)=>{
   if(!uuid(job.id)||!reasonLabels[job.kind]||(!uuid(job.approval_id)&&job.kind!=="probe"))throw Error("Invalid alert");
   const link=job.approval_id?`${site}?id=${job.approval_id}`:site;
   const title=job.kind==="probe"?"TESTE — avisos de aprovação da Embaixada Carioca":"Atenção — aprovação de proposta";
   const body=[title,reasonLabels[job.kind],`Verificação: ${new Date().toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} (Brasília)`,link,
    "Abrir o link não aprova nem envia propostas. Entre com sua conta para conferir.",`Referência: ${job.reference}`].join("\n\n");
   const result=await deliverManagerNotice(job.channel,job.destination,body,title,link,job.reference);
   await call("event_finish_approval_watch_alert",{target_id:job.id,result_status:result.status,external_id:result.providerId,result_detail:result.detail});
   return {channel:job.channel,status:result.status};
  }));
  await call("event_complete_approval_watch",{target_run:batch.run_id});
  return respond({ok:true,processed:results.length,results});
 }catch(error){return respond({ok:false,message:"Monitor não concluído. Consulte o estado interno antes de repetir."},(error as any)?.code==="42501"?403:503);}
});
