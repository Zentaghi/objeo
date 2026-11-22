import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../annuaire.html',import.meta.url),'utf8');

test('public directory scripts parse',()=>{
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[1].trim())new vm.Script(m[1]);
 }
});
test('claims cannot be submitted by establishment owner or team members',()=>{
 assert.match(html,/est\.owner_id===user\.id/);
 assert.match(html,/from\('objeo_pro_team'\)/);
 assert.match(html,/await proClaimAccountRestriction\(user,currentProfile\)/);
 assert.match(html,/if\(reason\)\{status\.textContent=reason;return\}/);
});
test('public claims still pass through existing server-enforced RLS',()=>{
 assert.match(html,/from\('objeo_pro_claims'\)\.insert\(\{item_id:item\.id,claimant_id:user\.id,evidence\}\)/);
 assert.match(html,/error\.code==='42501'/);
 assert.match(html,/updateProClaimEligibility\(est,item\)/);
});
