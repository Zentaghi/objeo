const { chromium } = require('playwright');
const fs = require('fs');
const base = 'https://objeo.online';
const dir = 'assets/screenshots';
fs.mkdirSync(dir,{recursive:true});
(async () => {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
 const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'fr-FR',colorScheme:'light'});
 const page = await context.newPage();
 const errors=[];
 const open=async url => { await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(2000); };
 const snap=async file => { await page.screenshot({path:dir+'/'+file,animations:'disabled',fullPage:false});console.log('Screenshot:',file,await page.title()); };
 try {
  await open(base+'/');
  await snap('01-accueil.png');
  // Recherche depuis le parcours utilisateur public, sans compte.
  await page.locator('button.objeo-quick.lost').first().click({timeout:12000});
  await page.waitForTimeout(900);
  await snap('02-recherche.png');
  await open(base+'/');
  await page.locator('button.objeo-quick.found').first().click({timeout:12000});
  await page.waitForTimeout(900);
  await snap('03-publication.png');
  await open(base+'/annuaire.html');
  await snap('04-partenaires.png');
 } finally {await browser.close();}
 const required=['01-accueil.png','02-recherche.png','03-publication.png','04-partenaires.png'];
 for(const f of required) if(!fs.existsSync(dir+'/'+f) || fs.statSync(dir+'/'+f).size<5000)throw new Error('Capture invalide : '+f);
})().catch(e=>{console.error(e);process.exit(1)});
