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
function showSettings(){
 document.getElementById('objeoAdConsentDialog')?.remove();
 const box=document.createElement('div');box.id='objeoAdConsentDialog';box.setAttribute('role','dialog');box.setAttribute('aria-label','Préférences publicitaires');
 box.innerHTML='<div class="objeo-consent-inner"><strong>Publicités sur Objeo</strong><p>Objeo est gratuit grâce aux publicités. Si vous acceptez, des scripts publicitaires Adsterra peuvent déposer des traceurs et traiter des données. Vous pouvez refuser sans perdre accès au service et modifier votre choix à tout moment.</p><div class="objeo-consent-actions"><button type="button" data-ads-choice="rejected">Refuser</button><button type="button" data-ads-choice="accepted">Accepter les publicités</button></div></div>';
 document.body.appendChild(box);
 box.querySelectorAll('[data-ads-choice]').forEach(btn=>btn.addEventListener('click',()=>{localStorage.setItem(config.consentKey,btn.dataset.adsChoice);location.reload();}));
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
