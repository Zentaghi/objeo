import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const old=read('messages-pro.html'),directory=read('annuaire.html'),dashboard=read('etablissements.html'),messages=read('assets/objeo-chat-enhancements.js');
test('all unified messenger scripts parse',()=>{
 for(const html of [old,directory,dashboard])for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(m[1].trim())new vm.Script(m[1]);}
 new vm.Script(messages);
});
test('Pro listings contact through original Objeo page',()=>{
 assert.match(directory,/\?pro_objet=/);
 assert.match(directory,/Contacter l’établissement/);
 assert.doesNotMatch(directory,/id="claimForm"/);
 assert.match(old,/location\.replace\(to\.href\)/);
});
test('Pro messages use same workspace and message bubbles as regular messages',()=>{
 assert.match(messages,/window\.openUnifiedObjeoProThread=async function/);
 assert.match(messages,/objeoWorkspace\('Conversation 💬'/);
 assert.match(messages,/messageNode\(m,ctx,identity\)/);
 assert.match(messages,/window\.openObjeoProFromListing=async function/);
 assert.match(messages,/from\('objeo_pro_conversations'\)\.insert/);
 assert.match(messages,/from\('objeo_pro_messages'\)\.insert/);
});
test('Pro inbox is included in normal messages without a separate link',()=>{
 assert.match(messages,/await objeoAppendProInbox\(ctx,list,status,groups\.size\)/);
 assert.doesNotMatch(messages,/Ouvrir la messagerie Objeo Pro/);
 assert.match(dashboard,/href="\/\?pro_messages=1"/);
});
test('only owner can close professional listing in thread',()=>{
 assert.match(messages,/if\(owner&&item\.status==='open'\)/);
 assert.match(messages,/\.update\(\{status:'returned'\}\)/);
});
