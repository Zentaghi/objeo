import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const pro=read('etablissements.html');
const poster=read('affiche-pro.html');
const directory=read('annuaire.html');

test('public and Pro page scripts parse',()=>{
 for(const page of [pro,poster,directory]){
  for(const m of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(m[0].includes('application/ld+json'))continue;
   new vm.Script(m[1]);
  }
 }
});
test('QR poster prints from a real visible page, not a hidden iframe',()=>{
 assert.match(pro,/window\.location\.assign\(destination\)/);
 assert.match(pro,/\/affiche-pro\.html\?etablissement=/);
 assert.doesNotMatch(pro,/frame\.contentWindow\.print\(\)/);
 assert.match(poster,/id="print"/);
 assert.match(poster,/btn\.addEventListener\('click',\(\)=>window\.print\(\)\)/);
 assert.match(poster,/new QRCode\(qr,/);
 assert.match(poster,/\/annuaire\.html\?etablissement=/);
});
test('first establishment can be created while edits remain authenticated',()=>{
 assert.match(pro,/if\(!user\)return msg\('Connectez-vous pour créer ou modifier votre établissement\.'/);
 assert.match(pro,/if\(est\)showEstablishmentSummary\(est\);else/);
 assert.match(pro,/\$\('estForm'\)\.classList\.remove\('hidden'\)/);
 assert.match(pro,/\.insert\(payload\)/);
});
test('dates use local day rather than locale-dependent formatting',()=>{
 assert.match(pro,/function proLocalToday\(\)/);
 assert.match(pro,/if\(!date\|\|date>proLocalToday\(\)\)/);
});
