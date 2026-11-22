import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const home=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const pro=fs.readFileSync(new URL('../etablissements.html',import.meta.url),'utf8');
const chat=fs.readFileSync(new URL('../assets/objeo-chat-enhancements.js',import.meta.url),'utf8');

test('all modified scripts parse',()=>{
 for(const html of [home,pro])for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[0].includes('application/ld+json')||!m[1].trim())continue;
  new vm.Script(m[1]);
 }
 new vm.Script(chat);
});
test('professional owner is routed to dedicated dashboard',()=>{
 assert.match(home,/async function objeoEnforceAccountSpace\(\)/);
 assert.match(home,/from\('objeo_establishments'\)\.select\('id'\)\.eq\('owner_id',user\.id\)/);
 assert.match(home,/location\.replace\('\/etablissements\.html'\)/);
 assert.match(home,/objeoProfessionalMode/);
 assert.match(home,/objeo-professional-chat-only/);
});
test('professional messaging remains accessible but personal inbox is hidden',()=>{
 assert.match(home,/params\.has\('pro_conversation'\)/);
 assert.match(home,/params\.get\('pro_messages'\)==='1'/);
 assert.match(chat,/proOwned\?\.length\?\{data:\[\],error:null\}/);
 assert.match(chat,/await objeoAppendProInbox\(ctx,list,status,groups\.size\)/);
});
test('the Pro dashboard does not lead an established owner back to the consumer site',()=>{
 assert.match(pro,/id="proPublicBackLink"/);
 assert.match(pro,/\$\('proPublicBackLink'\)\.classList\.toggle\('hidden',!!est\)/);
 assert.match(pro,/class="brand" href="\/etablissements\.html"/);
});
