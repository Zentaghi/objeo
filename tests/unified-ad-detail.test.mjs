import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../annuaire.html',import.meta.url),'utf8');

test('professional detail and public directory JavaScript remains valid',()=>{
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(m[1].trim())new vm.Script(m[1]);}
});
test('professional detail shares the standard Objeo ad hierarchy and sharing',()=>{
 for(const value of ['Détails de l’annonce','Publié par : ','Partager cette annonce','unified-detail-photo','shareWhatsApp','shareFacebook','shareInstagram','copyItem']){
  assert.ok(html.includes(value),value);
 }
 assert.match(html,/document\.body\.classList\.add\('objeo-unified-detail'\)/);
 assert.match(html,/document\.body\.classList\.remove\('objeo-unified-detail'\)/);
});
test('claim validation remains active for professional found items',()=>{
 assert.match(html,/if\(found\)\{\$\('claimForm'\)\.onsubmit=ev=>submitClaim\(ev,item\);updateProClaimEligibility\(est,item\)\}/);
 assert.match(html,/from\('objeo_pro_claims'\)\.insert/);
});
