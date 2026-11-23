/* Objeo advertising - user consent required before third-party scripts load.
   Master switch: change enabled to false to disable all ad placements. */
(function(){
'use strict';
const config={enabled:true,consentKey:'objeo_ads_consent_v1',preview:new URLSearchParams(location.search).get('ads_preview')==='1'};
const sources={
 native:'https://bauval.org/21/e3bf0418d4904fbdca8931da81ae2786',
 banners:{
 desktop:{key:'eefaa1b099c09a5cb7a49e001b10d5ba',width:728,height:90},
 mobile:{key:'90983dc0cf826114c37237d5f2e0c69c',width:320,height:50},
 detail:{key:'d86ad9c13b175d8052b0d456ddd451d5',width:300,height:250}
 }};
const accepted=()=>config.enabled&&localStorage.getItem(config.consentKey)==='accepted';
const eligible=()=>config.enabled&&(config.preview||accepted());
const formatLabel=(slot,name)=>{slot.classList.add('objeo-ad-slot','is-live');slot.removeAttribute('hidden');slot.setAttribute('aria-label','Publicité');if(!slot.dataset.adLoaded)slot.innerHTML='<span class="objeo-ad-label">PUBLICITÉ</span><div class="objeo-ad-content"></div>';};
const queue=[];let running=false;
async function scheduleBanner(slot,variant){
 if(!slot||slot.dataset.adLoaded)return;
 formatLabel(slot);slot.dataset.adLoaded='1';
 queue.push({slot,variant});if(running)return;running=true;
 while(queue.length){
  const item=queue.shift();if(!item.slot.isConnected)continue;
  const opt=sources.banners[item.variant],mount=item.slot.querySelector('.objeo-ad-content');if(!mount)continue;
  window.atOptions={key:opt.key,format:'iframe',height:opt.height,width:opt.width,params:{}};
  await new Promise(resolve=>{
   const script=document.createElement('script');script.dataset.cfasync='false';script.src='https://bauval.org/22/'+opt.key;
   let done=false;const finish=()=>{if(done)return;done=true;resolve();};
   script.onload=finish;script.onerror=finish;mount.appendChild(script);
   setTimeout(finish,12000);
  });
 }
 running=false;
}
function loadNative(slot){
 if(!slot||slot.dataset.adLoaded)return;
 formatLabel(slot);slot.dataset.adLoaded='1';
 const mount=slot.querySelector('.objeo-ad-content');
 const target=document.createElement('div');target.id='container-e3bf0418d4904fbdca8931da81ae2786';mount.appendChild(target);
 const script=document.createElement('script');script.async=true;script.dataset.cfasync='false';script.fetchPriority='high';script.src=sources.native;mount.appendChild(script);
}
function refresh(){
 const home=document.getElementById('objeoAdHome'),detail=document.querySelector('#legacy .objeo-ad-detail');
 if(!eligible()){[home,detail].forEach(x=>{if(x){x.classList.remove('is-live');x.style.display='none';}});return;}
 if(config.preview&&!accepted()){
  [home,detail].forEach(x=>{if(x){x.style.display=x===detail&&!document.getElementById('legacy')?.classList.contains('on')?'none':'flex';x.classList.add('is-live');x.innerHTML='<span class="objeo-ad-label">PUBLICITÉ · APERÇU</span><span>Emplacement publicitaire (aucun script chargé)</span>';}});
  document.querySelectorAll('#objeoWorkspace .objeo-ad-detail').forEach(x=>{x.classList.add('is-live');x.innerHTML='<span class="objeo-ad-label">PUBLICITÉ · APERÇU</span>';});
  return;
 }
 if(home){home.style.display='flex';scheduleBanner(home,innerWidth<700?'mobile':'desktop');}
 if(detail&&document.getElementById('legacy')?.classList.contains('on')){detail.style.display='flex';scheduleBanner(detail,'detail');}
 document.querySelectorAll('#objeoWorkspace .objeo-ad-detail').forEach(x=>scheduleBanner(x,'detail'));
 const results=document.getElementById('objeoAdResults');if(results)loadNative(results);
}
function attachResults(preserved){
 const grid=document.getElementById('grid');if(!grid)return;
 const cards=grid.querySelectorAll('article.card');if(!cards.length)return;
 const slot=preserved||document.createElement('aside');slot.id='objeoAdResults';slot.className='objeo-ad-slot objeo-ad-results';
 slot.setAttribute('aria-label','Publicité dans les résultats');
 if(!eligible()){slot.style.display='none';return;}
 slot.style.display='flex';if(cards.length>4)grid.insertBefore(slot,cards[4]);else grid.appendChild(slot);
 if(config.preview&&!accepted()){slot.innerHTML='<span class="objeo-ad-label">PUBLICITÉ · APERÇU</span><span>Emplacement publicitaire dans les résultats</span>';return;}
 loadNative(slot);
}
function installConsentStyles(){
 if(document.getElementById('objeoConsentStyles'))return;
 const style=document.createElement('style');style.id='objeoConsentStyles';
 style.textContent=`
 #objeoAdConsentDialog{position:fixed!important;inset:0!important;max-width:none!important;margin:0!important;padding:16px!important;z-index:2147483600!important;display:flex!important;align-items:center;justify-content:center;background:rgba(15,23,42,.57)!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow-y:auto}
 #objeoAdConsentDialog .objeo-consent-inner{box-sizing:border-box;width:min(100%,510px);max-height:calc(100dvh - 32px);overflow:auto;border-radius:22px;background:#fff;padding:27px;box-shadow:0 24px 80px rgba(0,0,0,.22);color:#263142;font:400 14px/1.55 Inter,system-ui,sans-serif}
 #objeoAdConsentDialog .objeo-consent-heading{display:flex;gap:13px;align-items:center;margin-bottom:14px}
 #objeoAdConsentDialog .objeo-cookie-icon{display:grid;place-items:center;flex:none;width:47px;height:47px;border-radius:13px;background:#fff1e7;font-size:25px}
 #objeoAdConsentDialog h2{font-size:21px;line-height:1.2;letter-spacing:-.5px;margin:0;font-weight:800;color:#202936}
 #objeoAdConsentDialog p{font-size:14px;line-height:1.6;color:#566273;margin:0 0 14px}
 #objeoAdConsentDialog .objeo-consent-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:19px}
 #objeoAdConsentDialog button{box-sizing:border-box;font:700 14px/1.35 Inter,system-ui,sans-serif;cursor:pointer;min-height:46px;border-radius:11px;padding:11px 12px}
 #objeoAdConsentDialog .objeo-consent-reject{background:#fff!important;color:#283445!important;border:1px solid #cfd6df!important}
 #objeoAdConsentDialog .objeo-consent-accept{background:#ff6e14!important;color:#fff!important;border:1px solid #ff6e14!important}
 #objeoAdConsentDialog .objeo-consent-customize{display:block;width:100%;margin-top:10px;background:#fff;border:1px solid #d7dce4;color:#344054}
 #objeoAdConsentDialog button:focus-visible,#objeoAdConsentDialog input:focus-visible{outline:3px solid #ffb77f;outline-offset:2px}
 #objeoAdConsentDialog .objeo-consent-panel{margin-top:14px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:13px}
 #objeoAdConsentDialog .objeo-consent-toggle{display:flex;gap:12px;justify-content:space-between;align-items:center;font-weight:700;color:#283445}
 #objeoAdConsentDialog .objeo-consent-toggle input{width:22px;height:22px;accent-color:#ff6e14;flex:none}
 #objeoAdConsentDialog .objeo-consent-note{font-size:12px;color:#64748b;margin:8px 0 0}
 #objeoAdConsentDialog .objeo-consent-links{margin-top:14px;font-size:12px;display:flex;gap:14px;flex-wrap:wrap}
 #objeoAdConsentDialog .objeo-consent-links a{color:#ae480b;text-decoration:underline}
 @media(max-width:480px){#objeoAdConsentDialog{padding:10px!important;align-items:flex-end}#objeoAdConsentDialog .objeo-consent-inner{padding:21px;border-radius:19px;max-height:calc(100dvh - 20px)}#objeoAdConsentDialog h2{font-size:19px}#objeoAdConsentDialog button{font-size:13px}}
 `;
 document.head.appendChild(style);
}
function showSettings(){
 installConsentStyles();
 document.getElementById('objeoAdConsentDialog')?.remove();
 const box=document.createElement('section');
 box.id='objeoAdConsentDialog';
 box.setAttribute('role','dialog');
 box.setAttribute('aria-modal','true');
 box.setAttribute('aria-labelledby','objeoConsentTitle');
 box.innerHTML=`<div class="objeo-consent-inner">
 <div class="objeo-consent-heading"><span class="objeo-cookie-icon" aria-hidden="true">🍪</span><h2 id="objeoConsentTitle">Votre vie privée sur Objeo</h2></div>
 <p>Objeo est une plateforme gratuite financée par la publicité.</p>
 <p>Avec votre accord, notre partenaire Adsterra peut utiliser des cookies et autres traceurs pour afficher des publicités et mesurer leur performance.</p>
 <p>Vous pouvez refuser sans perdre l'accès à Objeo. Vous pourrez modifier votre choix à tout moment.</p>
 <div class="objeo-consent-actions">
 <button type="button" class="objeo-consent-reject" data-ads-choice="rejected">Tout refuser</button>
 <button type="button" class="objeo-consent-accept" data-ads-choice="accepted">Tout accepter</button>
 </div>
 <button type="button" class="objeo-consent-customize" aria-expanded="false" aria-controls="objeoConsentPanel">Personnaliser mes choix</button>
 <div class="objeo-consent-panel" id="objeoConsentPanel" hidden>
 <label class="objeo-consent-toggle"><span>Publicités avec Adsterra</span><input type="checkbox" id="objeoAdsToggle"></label>
 <p class="objeo-consent-note">Un seul choix est disponible pour l'ensemble des scripts Adsterra : ils sont activés ou désactivés ensemble. Nous ne proposons pas de réglages par finalité avec cette régie.</p>
 <button type="button" class="objeo-consent-customize" id="objeoAdsSave">Enregistrer mon choix</button>
 </div>
 <div class="objeo-consent-links"><a href="/cookies.html">Politique de cookies</a><a href="/confidentialite.html">Confidentialité</a></div>
 </div>`;
 document.body.appendChild(box);
 const save=value=>{localStorage.setItem(config.consentKey,value);location.reload();};
 box.querySelectorAll('[data-ads-choice]').forEach(btn=>btn.addEventListener('click',()=>save(btn.dataset.adsChoice)));
 const toggle=box.querySelector('#objeoAdsToggle');
 toggle.checked=accepted();
 box.querySelector('.objeo-consent-customize').addEventListener('click',e=>{
   const panel=box.querySelector('#objeoConsentPanel'),expanded=e.currentTarget.getAttribute('aria-expanded')==='true';
   panel.hidden=expanded;e.currentTarget.setAttribute('aria-expanded',String(!expanded));
   if(!expanded)toggle.focus();
 });
 box.querySelector('#objeoAdsSave').addEventListener('click',()=>save(toggle.checked?'accepted':'rejected'));
 box.querySelector('.objeo-consent-reject').focus();
}
function initialize(){
 const footer=document.querySelector('.footer-bottom')||document.querySelector('footer');
 if(footer&&!document.getElementById('objeoAdSettings')){const button=document.createElement('button');button.id='objeoAdSettings';button.type='button';button.textContent='Gérer les publicités';button.addEventListener('click',showSettings);footer.appendChild(button);}
 if(!localStorage.getItem(config.consentKey)&&config.enabled&&!config.preview)showSettings();
 refresh();
}
window.objeoAdsAttachResults=attachResults;
window.objeoAdsRefresh=refresh;
window.objeoAdsSettings=showSettings;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
