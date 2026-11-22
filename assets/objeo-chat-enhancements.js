/* Objeo — messaging improvements. Requires the read-receipts/contact migration. */
(function(){
'use strict';
const formatDate=value=>{const d=new Date(value);return Number.isNaN(+d)?'':new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)};
const person=(meta,userId)=>String(meta?.ads?.user_id)===String(userId)?meta?.seeker_id:meta?.ads?.user_id;
const make=(tag,text,styles)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(styles)el.style.cssText=styles;return el};
const messageNode=(message,ctx,identity)=>{
 const item=make('div',undefined,'padding:12px 14px;margin:9px 0;background:#f5f6f8;border-radius:12px;overflow-wrap:anywhere;white-space:pre-wrap');
 item.append(make('div',(message.sender_id===ctx.user.id?'Moi':identity.name)+' : '+message.body),make('small',formatDate(message.created_at),'display:block;margin-top:6px;color:#667085;font-size:11px'));
 return item;
};
async function markers(ctx){
 const r=await ctx.sb.from('objeo_message_reads').select('conversation_id,last_read_at').eq('user_id',ctx.user.id).limit(500);
 if(r.error){console.warn('Read receipts not installed',r.error.message);return null}
 return new Map((r.data||[]).map(x=>[String(x.conversation_id),x.last_read_at]));
}
function unread(messages,userId,reads){return reads?messages.filter(m=>m.sender_id!==userId&&new Date(m.created_at)>new Date(reads.get(String(m.conversation_id))||0)).length:0}
async function markRead(ctx,id){const r=await ctx.sb.from('objeo_message_reads').upsert({conversation_id:id,user_id:ctx.user.id,last_read_at:new Date().toISOString()},{onConflict:'conversation_id,user_id'});if(r.error)console.warn('Read receipt',r.error.message);else updateBadges(ctx)}
async function updateBadges(ctx){try{if(!ctx){const sb=auth2GetClient(),r=await sb.auth.getUser();if(!r.data?.user)return;ctx={sb,user:r.data.user}}const [m,reads]=await Promise.all([ctx.sb.from('messages').select('conversation_id,sender_id,created_at').order('created_at',{ascending:false}).limit(500),markers(ctx)]);if(m.error||!reads)return;const n=unread(m.data||[],ctx.user.id,reads);document.querySelectorAll('[data-objeo-unread]').forEach(el=>{el.hidden=n===0;el.textContent=n>99?'99+':String(n)});document.querySelectorAll('[data-objeo-unread-caption]').forEach(el=>{el.textContent=n?n+' nouveau'+(n>1?'x':'')+' message'+(n>1?'s':''):''})}catch(e){console.warn('Message badge',e)}}
async function claimStatus(ctx,meta,other){
 const root=document.getElementById('objeoChatClaimStatus');if(!root||meta?.ads?.kind!=='found')return;
 const owner=String(meta.ads.user_id)===String(ctx.user.id),claimant=owner?other:ctx.user.id;
 const r=await ctx.sb.from('objeo_claims').select('id,status,evidence,created_at').eq('ad_id',meta.ad_id).eq('claimant_id',claimant).order('created_at',{ascending:false}).limit(1);
 if(!root.isConnected)return;root.replaceChildren();if(r.error){root.append(make('small','Suivi des revendications indisponible.'));return}
 const claim=r.data?.[0];
 if(!claim){if(!owner&&meta.ads.status==='open'){const b=make('button','🔐 Revendiquer cet objet');b.type='button';b.className='primary';b.onclick=()=>openSafetyForm('claim',meta.ad_id);root.append(b)}else root.hidden=true;return}
 root.hidden=false;root.append(make('strong',({pending:'⏳ Demande en attente',accepted:'✅ Demande acceptée',rejected:'❌ Demande refusée'})[claim.status]||'Demande de restitution'));
 if(owner){root.append(make('p','Preuve fournie : '+(claim.evidence||'Aucune'),'white-space:pre-wrap;overflow-wrap:anywhere'))}
 if(owner&&claim.status==='pending'){const row=make('div',undefined,'display:flex;gap:10px;flex-wrap:wrap');for(const [label,accept]of [['✓ Accepter',true],['✕ Refuser',false]]){const b=make('button',label);b.type='button';b.className=accept?'primary':'outline';b.onclick=async()=>{if(!confirm(accept?'Accepter après vérification des preuves ?':'Refuser cette revendication ?'))return;row.querySelectorAll('button').forEach(x=>x.disabled=true);const response=await ctx.sb.rpc('objeo_decide_claim',{p_claim_id:claim.id,p_accept:accept});if(response.error){alert('Décision non enregistrée : '+response.error.message);row.querySelectorAll('button').forEach(x=>x.disabled=false);return}await claimStatus(ctx,meta,other);refreshNotificationCount();refreshClaimBadge()};row.append(b)}root.append(row)}
 if(claim.status==='accepted'){
 root.append(make('p','Vous pouvez organiser la remise directement. Ne confirmez la restitution qu’après la remise physique.'));
 if(!owner){const area=make('div','Chargement des coordonnées autorisées…');root.append(area);const [email,phone]=await Promise.all([ctx.sb.rpc('objeo_accepted_claim_contact',{p_claim_id:claim.id}),ctx.sb.rpc('objeo_accepted_claim_phone',{p_claim_id:claim.id})]);if(!area.isConnected)return;area.replaceChildren();
 const address=email.data?.[0]?.poster_email;
 if(!email.error&&address){const link=make('a','✉ '+address,'display:block;padding:7px 0');link.href='mailto:'+address;area.append(link)}
 if(!phone.error&&typeof phone.data==='string'&&phone.data){const link=make('a','📞 '+phone.data,'display:block;padding:7px 0');link.href='tel:'+phone.data.replace(/[^+0-9]/g,'');area.append(link)}
 if(!area.childNodes.length)area.textContent='Coordonnées indisponibles : poursuivez l’échange dans Objeo.'}
 }
}
// A single RLS-filtered Realtime subscription is shared by the inbox and open thread.
// Never subscribe to an unfiltered public broadcast; table SELECT RLS protects recipients.
let objeoRealtimeChannel=null,objeoRealtimeClient=null,objeoRealtimeUser=null;
let objeoRealtimeState='OFFLINE',objeoRealtimeInboxRefresh=null;
const objeoRealtimeRendered=new Map();
const objeoRealtimeThreadKeys=new Set();
let objeoRealtimeActiveThread=null,objeoRealtimeThreadIdentity=null,objeoRealtimeThreadCtx=null;
function objeoRealtimeStatus(status){objeoRealtimeState=status;const label=document.getElementById('objeoRealtimeStatus');if(label){label.textContent=status==='SUBSCRIBED'?'● Messages en direct':status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'Connexion instable · actualisation disponible':'Connexion à la messagerie…';label.style.color=status==='SUBSCRIBED'?'#18824b':'#667085'}}
function objeoRealtimeForgetThread(){objeoRealtimeActiveThread=null;objeoRealtimeThreadIdentity=null;objeoRealtimeThreadCtx=null;objeoRealtimeThreadKeys.clear()}
function objeoRealtimeStop(){if(objeoRealtimeInboxRefresh){clearTimeout(objeoRealtimeInboxRefresh);objeoRealtimeInboxRefresh=null}if(objeoRealtimeClient&&objeoRealtimeChannel){objeoRealtimeClient.removeChannel(objeoRealtimeChannel)}objeoRealtimeChannel=null;objeoRealtimeClient=null;objeoRealtimeUser=null;objeoRealtimeForgetThread();objeoRealtimeStatus('OFFLINE')}
async function objeoRealtimeRefreshThread(){
 const ctx=objeoRealtimeThreadCtx,cid=objeoRealtimeActiveThread,identity=objeoRealtimeThreadIdentity;
 const root=document.getElementById('objeoChatMessages');
 if(!ctx||!cid||!identity||!root)return;
 const response=await ctx.sb.from('messages').select('id,body,created_at,sender_id,conversation_id').eq('conversation_id',cid).order('created_at',{ascending:false}).limit(300);
 if(response.error){console.warn('Synchronisation de conversation',response.error.message);return}
 if(root!==document.getElementById('objeoChatMessages')||cid!==objeoRealtimeActiveThread)return;
 let added=0;
 for(const msg of [...(response.data||[])].reverse()){
   const key=String(msg.id);if(objeoRealtimeThreadKeys.has(key))continue;
   objeoRealtimeThreadKeys.add(key);
   const node=messageNode(msg,ctx,identity);node.dataset.messageId=key;
   root.appendChild(node);added++;
 }
 if(added&&!document.hidden&&document.hasFocus())await markRead(ctx,cid);
}
function objeoRealtimeMessage(event){
 const m=event?.new;if(!m?.id||!m.conversation_id)return;
 const id=String(m.id),cid=String(m.conversation_id);
 // Ignore all events that aren't visible for this user, as enforced by Supabase RLS.
 if(objeoRealtimeActiveThread===cid&&objeoRealtimeThreadCtx&&objeoRealtimeThreadIdentity&&document.getElementById('objeoChatMessages')){
   const thread=document.getElementById('objeoChatMessages');
   if(!objeoRealtimeThreadKeys.has(id)){
     objeoRealtimeThreadKeys.add(id);
     const item=messageNode(m,objeoRealtimeThreadCtx,objeoRealtimeThreadIdentity);
     item.dataset.messageId=id;
     thread.appendChild(item);
     if(!document.hidden&&document.hasFocus())markRead(objeoRealtimeThreadCtx,cid);
   }
 }else if(document.getElementById('objeoMessageList')){
   if(objeoRealtimeInboxRefresh)clearTimeout(objeoRealtimeInboxRefresh);
   objeoRealtimeInboxRefresh=setTimeout(()=>{objeoRealtimeInboxRefresh=null;if(document.getElementById('objeoMessageList'))openObjeoMessages()},350);
 }
 // A new message may affect the unread count on any other screen.
 updateBadges();
}
async function objeoRealtimeStart(ctx){
 if(!ctx?.sb||!ctx?.user?.id)return;
 if(objeoRealtimeChannel&&objeoRealtimeClient===ctx.sb&&objeoRealtimeUser===ctx.user.id)return;
 objeoRealtimeStop();
 objeoRealtimeClient=ctx.sb;objeoRealtimeUser=ctx.user.id;
 const channel=ctx.sb.channel('objeo-messages-'+ctx.user.id)
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},objeoRealtimeMessage)
 .subscribe(status=>{if(objeoRealtimeChannel!==channel)return;objeoRealtimeStatus(status);if(status==='SUBSCRIBED'){updateBadges(ctx);objeoRealtimeRefreshThread()}});
 objeoRealtimeChannel=channel;
}
async function objeoRealtimeEnsure(){try{const sb=auth2GetClient();const result=await sb.auth.getUser();if(!result.data?.user){if(objeoRealtimeChannel)objeoRealtimeStop();return}await objeoRealtimeStart({sb,user:result.data.user})}catch(e){console.warn('Realtime Objeo indisponible, lecture classique conservée',e)}}
window.openObjeoMessages=async function(){
 const ctx=await requireObjeoUser();if(!ctx)return;objeoRealtimeForgetThread();objeoRealtimeStart(ctx);objeoWorkspace('Mes messages 💬','<p id="objeoMessageStatus">Chargement…</p><div id="objeoMessageList"></div>');
 try{
 const r=await ctx.sb.from('messages').select('id,body,created_at,sender_id,conversation_id,conversations(ad_id,seeker_id,ads(title,user_id,kind,status))').order('created_at',{ascending:false}).limit(300);
 if(r.error)throw r.error;const groups=new Map();for(const m of r.data||[]){if(!m.conversations)continue;if(!groups.has(m.conversation_id))groups.set(m.conversation_id,[]);groups.get(m.conversation_id).push(m)}
 const [names,reads]=await Promise.all([objeoLoadChatIdentities(ctx.sb,[...groups.values()].map(v=>person(v[0].conversations,ctx.user.id)),ctx.user),markers(ctx)]);
 const list=document.getElementById('objeoMessageList'),status=document.getElementById('objeoMessageStatus');if(!list||!status)return;
 status.textContent=groups.size?groups.size+' conversation(s)':'Aucune conversation pour le moment.';
 for(const [id,items]of groups){const meta=items[0].conversations,identity=objeoChatIdentity(person(meta,ctx.user.id),names),card=make('button',undefined,'display:block;width:100%;padding:15px;margin:10px 0;text-align:left;background:#fff8f2;border:1px solid #ffddc8;border-radius:12px;cursor:pointer;color:#27313e');card.type='button';card.append(objeoChatIdentityNode(identity),make('div','📦 '+(meta.ads?.title||'Annonce'),'font-size:13px;color:#667085;margin-top:7px'),make('div',(items[0].sender_id===ctx.user.id?'Vous : ':'')+items[0].body.slice(0,100),'margin-top:7px;overflow-wrap:anywhere'),make('small',formatDate(items[0].created_at),'display:block;color:#667085;margin-top:5px'));const n=unread(items,ctx.user.id,reads);if(n)card.append(make('span',n+' nouveau'+(n>1?'x':''),'display:inline-block;margin-top:7px;border-radius:20px;padding:4px 9px;background:#eb6722;color:#fff;font-size:11px'));card.onclick=()=>openObjeoConversation(id,items,ctx,meta);list.append(card)}
 // Surface professional conversations in the same Objeo inbox.
 try{
  const pro=await ctx.sb.from('objeo_pro_conversations').select('id,item_id,created_at').order('created_at',{ascending:false}).limit(100);
  if(!pro.error){
   const entries=pro.data||[];
   if(entries.length){
    const ids=[...new Set(entries.map(c=>c.item_id))];
    const {data:items}=await ctx.sb.from('objeo_establishment_items').select('id,title,establishment_id').in('id',ids);
    const byId=new Map((items||[]).map(i=>[i.id,i]));
    for(const conversation of entries){
     const item=byId.get(conversation.item_id);
     const card=make('button',undefined,'display:block;width:100%;padding:15px;margin:10px 0;text-align:left;background:#eef6ff;border:1px solid #d2e5f9;border-radius:12px;cursor:pointer;color:#27313e');
     card.type='button';
     card.append(make('strong','💬 Objeo Pro · '+(item?.title||'Objet signalé')),make('small','Conversation avec un établissement · '+formatDate(conversation.created_at),'display:block;color:#667085;margin-top:7px'));
     card.onclick=()=>{location.href='/messages-pro.html?conversation='+encodeURIComponent(conversation.id)};
     list.append(card);
    }
   }
   status.textContent=(groups.size+entries.length)?(groups.size+entries.length)+' conversation(s)':'Aucune conversation pour le moment.';
  }
  const proLink=make('a','Ouvrir la messagerie Objeo Pro','display:block;text-align:center;padding:13px;margin:12px 0;border-radius:11px;background:#eef6ff;border:1px solid #c5dcf6;color:#175a95;font-weight:750;text-decoration:none');
  proLink.href='/messages-pro.html';list.append(proLink);
 }catch(err){console.warn('Boîte Pro indisponible',err)}
 updateBadges(ctx);
 }catch(e){const label=document.getElementById('objeoMessageStatus');if(label)label.textContent='Messagerie indisponible : '+e.message}
};
async function objeoChatOwnerReturn(ctx,meta){const root=document.getElementById('objeoChatOwnerReturn');if(!root||!meta?.ad_id)return;const r=await ctx.sb.from('ads').select('id,user_id,kind,status').eq('id',meta.ad_id).maybeSingle();if(!root.isConnected)return;root.replaceChildren();if(r.error||!r.data){root.remove();return}const ad=r.data;if(ad.user_id!==ctx.user.id){root.remove();return}root.style.cssText='padding:14px;margin:12px 0;border:1px solid #d0eadd;background:#f4fbf6;border-radius:12px';if(ad.status!=='open'){root.append(make('strong','✅ Annonce clôturée · Restitué'));return}const intro=make('p',ad.kind==='found'?'L’objet a-t-il été remis à son propriétaire ?':'Avez-vous récupéré votre objet ?');root.append(intro);const button=make('button',ad.kind==='found'?'✅ J’ai remis l’objet':'✅ J’ai récupéré mon objet','background:#168351;color:#fff;border:0;border-radius:10px;padding:13px;font:inherit;font-weight:750');button.type='button';button.onclick=async()=>{button.disabled=true;try{const ok=await closeObjeoAd(ad.id,{ctx});if(ok){meta.ads.status='returned';const claimBox=document.getElementById('objeoChatClaimStatus');if(claimBox){claimBox.hidden=true;claimBox.replaceChildren()}await objeoChatOwnerReturn(ctx,meta)}else if(button.isConnected)button.disabled=false}catch(e){console.warn('Clôture conversation',e);if(button.isConnected)button.disabled=false}};root.append(button)}
window.openObjeoConversation=async function(id,items,ctx,metadata){
 const meta=metadata||items[0]?.conversations,other=person(meta,ctx.user.id);objeoRealtimeStart(ctx);objeoRealtimeForgetThread();objeoRealtimeActiveThread=String(id);objeoRealtimeThreadCtx=ctx;objeoWorkspace('Conversation 💬','<div id="objeoChatHeading" style="padding:14px;border-radius:12px;background:#fff8f2;border:1px solid #ffddc8"></div><div id="objeoChatClaimStatus" style="padding:14px;margin:12px 0;border:1px solid #eee;border-radius:12px"></div><div id="objeoChatOwnerReturn"></div><p id="objeoRealtimeStatus" role="status" style="font-size:12px;color:#667085;margin:10px 0">Connexion à la messagerie…</p><div id="objeoChatMessages" aria-live="polite"></div><form id="objeoChatForm"><textarea name="body" required maxlength="2000" rows="3" placeholder="Votre message"></textarea><button type="submit" style="background:#ff6e14;color:#fff;border:0;border-radius:12px;padding:14px;width:100%">Envoyer</button><p id="objeoChatFeedback" role="status"></p></form>');
 const identities=await objeoLoadChatIdentities(ctx.sb,[other],ctx.user),identity=objeoChatIdentity(other,identities),header=document.getElementById('objeoChatHeading');if(!header)return;header.append(objeoChatIdentityNode(identity),make('small','À propos de : '+(meta?.ads?.title||'Annonce'),'display:block;margin-top:7px;color:#667085'));
 const thread=document.getElementById('objeoChatMessages');objeoRealtimeThreadIdentity=identity;for(const m of [...items].reverse()){objeoRealtimeThreadKeys.add(String(m.id));const node=messageNode(m,ctx,identity);node.dataset.messageId=String(m.id);thread.append(node)}objeoRealtimeStatus(objeoRealtimeState);await claimStatus(ctx,meta,other);await objeoChatOwnerReturn(ctx,meta);if(objeoRealtimeActiveThread===String(id))await markRead(ctx,id);
 const form=document.getElementById('objeoChatForm');if(!form)return;form.onsubmit=async e=>{e.preventDefault();const body=form.elements.body.value.trim(),button=form.querySelector('button[type=submit]'),status=document.getElementById('objeoChatFeedback');if(!body)return;button.disabled=true;try{const r=await ctx.sb.from('messages').insert({conversation_id:id,body}).select('id,body,created_at,sender_id').single();if(r.error)throw r.error;const key=String(r.data.id);if(!objeoRealtimeThreadKeys.has(key)){objeoRealtimeThreadKeys.add(key);const node=messageNode({...r.data,sender_id:ctx.user.id},ctx,identity);node.dataset.messageId=key;thread.append(node)}form.reset();status.textContent='Envoyé.';await markRead(ctx,id)}catch(err){status.textContent='Échec d’envoi : '+err.message}finally{button.disabled=false}};
};
window.openObjeoPhonePreferences=async function(){
 const ctx=await requireObjeoUser();if(!ctx)return;
 objeoWorkspace('Coordonnées de restitution 🔒','<p>Votre adresse e-mail peut être communiquée à une personne dont vous avez <strong>accepté</strong> la revendication. Le téléphone reste facultatif et désactivé par défaut.</p><form id="objeoContactPrefs"><label for="objeoContactPhone">Téléphone facultatif</label><input id="objeoContactPhone" type="tel" autocomplete="tel" maxlength="25" placeholder="+33 6 12 34 56 78" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:10px"><label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0"><input type="checkbox" id="objeoSharePhone" style="margin-top:5px"><span>Autoriser le partage de ce numéro uniquement après acceptation d’une revendication</span></label><button type="submit" class="primary">Enregistrer mes préférences</button><p id="objeoPrefsFeedback" role="status"></p></form>');
 const form=document.getElementById('objeoContactPrefs'),feedback=document.getElementById('objeoPrefsFeedback');const r=await ctx.sb.from('objeo_contact_preferences').select('phone,share_phone_after_acceptance').eq('user_id',ctx.user.id).maybeSingle();if(!form.isConnected)return;if(r.error){feedback.textContent='Préférences non disponibles : vérifiez la migration Supabase.';form.querySelector('button[type=submit]').disabled=true;return}if(r.data){form.querySelector('#objeoContactPhone').value=r.data.phone||'';form.querySelector('#objeoSharePhone').checked=!!r.data.share_phone_after_acceptance}
 form.onsubmit=async e=>{e.preventDefault();const phone=form.querySelector('#objeoContactPhone').value.trim(),share=form.querySelector('#objeoSharePhone').checked;feedback.textContent='Enregistrement…';if(share&&!phone){feedback.textContent='Saisissez un numéro avant d’autoriser le partage.';return}const result=await ctx.sb.from('objeo_contact_preferences').upsert({user_id:ctx.user.id,phone:phone||null,share_phone_after_acceptance:share&&!!phone,updated_at:new Date().toISOString()},{onConflict:'user_id'});feedback.textContent=result.error?'Enregistrement impossible : '+result.error.message:'Préférences enregistrées. Le numéro restera privé sauf pour une revendication acceptée.'}
};
window.objeoRefreshUnread=updateBadges;
window.objeoRealtimeReconnect=objeoRealtimeEnsure;
window.objeoRealtimeDisconnect=objeoRealtimeStop;
setTimeout(()=>{updateBadges();objeoRealtimeEnsure()},5500);
setInterval(()=>{if(!document.hidden){updateBadges();if(objeoRealtimeState!=='SUBSCRIBED')objeoRealtimeRefreshThread()}},25000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateBadges();objeoRealtimeEnsure();objeoRealtimeRefreshThread()}});
})();