import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const pro=read('messages-pro.html');
const directory=read('annuaire.html');
const dashboard=read('etablissements.html');
const messages=read('assets/objeo-chat-enhancements.js');

test('all Objeo Pro messaging scripts parse',()=>{
 for(const html of [pro,directory,dashboard])for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(m[1].trim())new vm.Script(m[1]);}
 new vm.Script(messages);
});
test('Pro listing opens a direct private conversation, not a claim form',()=>{
 assert.match(directory,/messages-pro\.html\?objet=/);
 assert.match(directory,/Contacter l’établissement/);
 assert.doesNotMatch(directory,/id="claimForm"/);
});
test('Pro conversations are tied to the item and authenticated account',()=>{
 assert.match(pro,/from\('objeo_pro_conversations'\)\.insert\(\{item_id:itemId,seeker_id:user\.id\}\)/);
 assert.match(pro,/from\('objeo_pro_messages'\)\.insert\(\{conversation_id:active\.id,sender_id:user\.id,body\}\)/);
 assert.match(pro,/await sb\.auth\.getUser\(\)/);
});
test('Pro message inbox is available in main Objeo messages',()=>{
 assert.match(messages,/from\('objeo_pro_conversations'\)/);
 assert.match(messages,/messages-pro\.html\?conversation=/);
 assert.match(dashboard,/href="\/messages-pro\.html"/);
});
test('only professional owner gets the restitution control',()=>{
 assert.match(pro,/owner=est\?\.owner_id===user\.id/);
 assert.match(pro,/owner&&item\?\.status==='open'/);
 assert.match(pro,/\.update\(\{status:'returned'\}\)/);
});
