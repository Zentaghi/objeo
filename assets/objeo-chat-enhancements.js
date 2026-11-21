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
window.openObjeoMessages=async function(){
 const ctx=await requireObjeoUser();if(!ctx)return;objeoWorkspace('Mes messages 💬','<p id="objeoMessageStatus">Chargement…</p><div id="objeoMessageList"></div>');
 try{
 const r=await ctx.sb.from('messages').select('id,body,created_at,sender_id,conversation_id,conversations(ad_id,seeker_id,ads(title,user_id,kind,status))').order('created_at',{ascending:false}).limit(300);
 if(r.error)throw r.error;const groups=new Map();for(const m of r.data||[]){if(!m.conversations)continue;if(!groups.has(m.conversation_id))groups.set(m.conversation_id,[]);groups.get(m.conversation_id).push(m)}
 const [names,reads]=await Promise.all([objeoLoadChatIdentities(ctx.sb,[...groups.values()].map(v=>person(v[0].conversations,ctx.user.id)),ctx.user),markers(ctx)]);
 const list=document.getElementById('objeoMessageList'),status=document.getElementById('objeoMessageStatus');if(!list||!status)return;
 status.textContent=groups.size?groups.size+' conversation(s)':'Aucune conversation pour le moment.';
 for(const [id,items]of groups){const meta=items[0].conversations,identity=objeoChatIdentity(person(meta,ctx.user.id),names),card=make('button',undefined,'display:block;width:100%;padding:15px;margin:10px 0;text-align:left;background:#fff8f2;border:1px solid #ffddc8;border-radius:12px;cursor:pointer;color:#27313e');card.type='button';card.append(objeoChatIdentityNode(identity),make('div','📦 '+(meta.ads?.title||'Annonce'),'font-size:13px;color:#667085;margin-top:7px'),make('div',(items[0].sender_id===ctx.user.id?'Vous : ':'')+items[0].body.slice(0,100),'margin-top:7px;overflow-wrap:anywhere'),make('small',formatDate(items[0].created_at),'display:block;color:#667085;margin-top:5px'));const n=unread(items,ctx.user.id,reads);if(n)card.append(make('span',n+' nouveau'+(n>1?'x':''),'display:inline-block;margin-top:7px;border-radius:20px;padding:4px 9px;background:#eb6722;color:#fff;font-size:11px'));card.onclick=()=>openObjeoConversation(id,items,ctx,meta);list.append(card)}
 updateBadges(ctx);
 }catch(e){const label=document.getElementById('objeoMessageStatus');if(label)label.textContent='Messagerie indisponible : '+e.message}
};
window.openObjeoConversation=async function(id,items,ctx,metadata){
 const meta=metadata||items[0]?.conversations,other=person(meta,ctx.user.id);objeoWorkspace('Conversation 💬','<div id="objeoChatHeading" style="padding:14px;border-radius:12px;background:#fff8f2;border:1px solid #ffddc8"></div><div id="objeoChatClaimStatus" style="padding:14px;margin:12px 0;border:1px solid #eee;border-radius:12px"></div><div id="objeoChatMessages" aria-live="polite"></div><form id="objeoChatForm"><textarea name="body" required maxlength="2000" rows="3" placeholder="Votre message"></textarea><button type="submit" style="background:#ff6e14;color:#fff;border:0;border-radius:12px;padding:14px;width:100%">Envoyer</button><p id="objeoChatFeedback" role="status"></p></form>');
 const identities=await objeoLoadChatIdentities(ctx.sb,[other],ctx.user),identity=objeoChatIdentity(other,identities),header=document.getElementById('objeoChatHeading');if(!header)return;header.append(objeoChatIdentityNode(identity),make('small','À propos de : '+(meta?.ads?.title||'Annonce'),'display:block;margin-top:7px;color:#667085'));
 const thread=document.getElementById('objeoChatMessages');for(const m of [...items].reverse())thread.append(messageNode(m,ctx,identity));await claimStatus(ctx,meta,other);await markRead(ctx,id);
 const form=document.getElementById('objeoChatForm');if(!form)return;form.onsubmit=async e=>{e.preventDefault();const body=form.elements.body.value.trim(),button=form.querySelector('button[type=submit]'),status=document.getElementById('objeoChatFeedback');if(!body)return;button.disabled=true;try{const r=await ctx.sb.from('messages').insert({conversation_id:id,body}).select('id,body,created_at,sender_id').single();if(r.error)throw r.error;thread.append(messageNode({...r.data,sender_id:ctx.user.id},ctx,identity));form.reset();status.textContent='Envoyé.';await markRead(ctx,id)}catch(err){status.textContent='Échec d’envoi : '+err.message}finally{button.disabled=false}};
};
window.objeoRefreshUnread=updateBadges;
setTimeout(()=>updateBadges(),5500);
setInterval(()=>{if(!document.hidden)updateBadges()},25000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateBadges()});
})();