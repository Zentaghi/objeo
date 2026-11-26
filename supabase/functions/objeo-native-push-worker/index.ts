import {createClient} from 'npm:@supabase/supabase-js@2.95.3';
type Account={project_id:string;client_email:string;private_key:string};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const enc=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const encode=(value:unknown)=>enc(new TextEncoder().encode(JSON.stringify(value)));
async function accessToken(account:Account){
 const now=Math.floor(Date.now()/1000),body=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const pk=Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'')),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',pk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(body));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:body+'.'+enc(new Uint8Array(sig))}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('FCM authorization failed');
 const data=await r.json();if(!data.access_token)throw Error('FCM token missing');return data.access_token as string;
}
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const ticket=req.headers.get('x-objeo-dispatch-ticket')||'';
 if(!/^[a-f0-9]{64}$/.test(ticket))return json({error:'Unauthorized'},401);
 const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const authorization=await sb.rpc('objeo_native_consume_ticket',{p_token:ticket});
 if(authorization.error||!['probe','dispatch'].includes(authorization.data))return json({error:'Unauthorized'},401);
 const raw=Deno.env.get('OBJEO_FCM_SERVICE_ACCOUNT_JSON');
 if(!raw)return json({error:'FCM not configured'},503);
 try{
 const account=JSON.parse(raw) as Account;if(account.project_id!=='objeo-515101'||!account.private_key||!account.client_email)throw Error('Invalid FCM configuration');
 const access=await accessToken(account);
 if(authorization.data==='probe')return json({configured:true,googleOAuth:true,project:account.project_id,probe:true});
 const {data,error}=await sb.rpc('objeo_native_claim_batch');if(error)throw error;
 let sent=0,failed=0;
 const processRow=async(row:any)=>{
 const filter=()=>sb.from('objeo_native_push_queue').delete().eq('event_key',row.event_key).eq('token',row.token);
 try{
 const {data:device,error:de}=await sb.from('objeo_native_devices').select('user_id').eq('token',row.token).maybeSingle();if(de)throw de;
 if(!device||device.user_id!==row.user_id){await filter();return}
 const response=await fetch('https://fcm.googleapis.com/v1/projects/'+account.project_id+'/messages:send',{method:'POST',headers:{authorization:'Bearer '+access,'content-type':'application/json'},body:JSON.stringify({message:{token:row.token,notification:{title:'Objeo',body:'Vous avez une nouvelle activité sur Objeo.'},android:{priority:'normal',ttl:'3600s',notification:{channel_id:'objeo',tag:row.event_key}},data:{screen:'alerts'}}}),signal:AbortSignal.timeout(8000)});
 if(response.ok){await filter();sent++}else{
 const result=await response.json().catch(()=>({}));const codes=(result.error?.details||[]).map((d:{errorCode?:string})=>d.errorCode);
 if(codes.includes('UNREGISTERED'))await sb.from('objeo_native_devices').delete().eq('token',row.token).eq('user_id',row.user_id);
 else if(row.attempts>=5)await filter();
 failed++;
 }
 }catch{failed++;if(row.attempts>=5)await filter()}
 };
 const rows=data||[];for(let i=0;i<rows.length;i+=8)await Promise.all(rows.slice(i,i+8).map(processRow));
 await sb.from('objeo_native_push_queue').delete().lt('created_at',new Date(Date.now()-86400000).toISOString());
 return json({sent,failed});
 }catch{return json({error:'Native push worker failed'},500)}
});
