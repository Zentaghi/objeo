import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('all inline scripts parse',()=>{
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(match[0].includes('application/ld+json'))continue;
    new vm.Script(match[1]);
  }
});
test('contact replaces direct claim on ad detail',()=>{
  assert.match(html,/id="claimAdButton">💬 Contacter/);
  assert.match(html,/function openObjeoContactFromAd\(/);
  assert.match(html,/id="objeoDetailContact">💬 Contacter/);
  assert.match(html,/style\.display='inline-block';\$\('aiMatchButton'\)/);
});
test('messaging reuses existing conversations',()=>{
  assert.match(html,/async function openObjeoContact\(adId\)/);
  assert.match(html,/\.from\('conversations'\)\.insert\(\{ad_id:adId\}\)/);
  assert.match(html,/\.from\('messages'\)\.insert\(\{conversation_id:cid,body\}\)/);
  assert.match(html,/if\(ad\.user_id===ctx\.user\.id\)/);
});
test('claims appear only in conversations for found items',()=>{
  assert.match(html,/canClaim=meta\?\.ads\?\.kind==='found'/);
  assert.match(html,/meta\?\.seeker_id===ctx\.user\.id/);
  assert.match(html,/openSafetyForm\('claim',adId\)/);
  assert.match(html,/if\(type==='claim'&&ad\.type!=='found'\)/);
});
