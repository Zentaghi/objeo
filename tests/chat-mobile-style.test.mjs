import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const chat=fs.readFileSync(new URL('../assets/objeo-chat-enhancements.js',import.meta.url),'utf8');
test('chat enhancement and inline application scripts parse',()=>{
 new vm.Script(chat);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[0].includes('application/ld+json')||!m[1].trim())continue;
  new vm.Script(m[1]);
 }
});
test('professional and personal chats use the same message bubbles',()=>{
 assert.match(chat,/objeo-chat-bubble/);
 assert.match(chat,/className='objeo-chat-bubble'\+\(own/);
 assert.match(chat,/window\.openUnifiedObjeoProThread/);
 assert.match(chat,/window\.openObjeoConversation/);
 assert.equal(chat.split('decorateObjeoChatWorkspace();').length-1,2);
});
test('chat composer and bubble layout is responsive',()=>{
 for(const value of ['objeo-chat-mobile-refresh','objeo-chat-bubble.is-mine','objeo-chat-composer','20261122-chat-ui']){
  assert.ok(html.includes(value),value);
 }
 assert.match(chat,/form\.requestSubmit\(\)/);
});
