import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('inline scripts parse',()=>{
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(match[0].includes('application/ld+json'))continue;
  new vm.Script(match[1]);
 }
});
test('conversation partner comes from members or actual establishment ownership',()=>{
 assert.match(html,/\.from\('profiles'\)\.select\('id,name'\)/);
 assert.match(html,/\.from\('objeo_establishments'\)\.select\('owner_id,name'\)/);
 assert.match(html,/function objeoOtherChatUser\(meta,currentId\)/);
 assert.match(html,/String\(meta\.ads\?\.user_id\)===String\(currentId\)\?meta\.seeker_id/);
});
test('pro is a separate visible badge only for a linked establishment',()=>{
 assert.match(html,/pro\.has\(id\)\?\{name:pro\.get\(id\),isPro:true\}/);
 assert.match(html,/badge\.textContent='PRO'/);
 assert.match(html,/badge\.setAttribute\('aria-label','Compte professionnel'\)/);
});
test('name is shown in inbox and inside conversation',()=>{
 assert.match(html,/b\.append\(name,title,preview\)/);
 assert.match(html,/header\.appendChild\(objeoChatIdentityNode\(identity\)\)/);
 assert.match(html,/identity\.name\+' : '\)\+m\.body/);
});
test('no email or phone is exposed by identity query',()=>{
 assert.doesNotMatch(html,/\.from\('profiles'\)\.select\('id,name,email'/);
 assert.doesNotMatch(html,/\.from\('objeo_establishments'\)\.select\('owner_id,name,contact_email'/);
});
