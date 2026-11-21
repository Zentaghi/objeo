import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../assets/objeo-chat-enhancements.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('scripts parse',()=>{
 new vm.Script(script);
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(match[0].includes('application/ld+json'))continue;
  new vm.Script(match[1]);
 }
});
test('notification permissions are requested by direct user action only',()=>{
 assert.match(script,/enable\.onclick=async\(\)=>\{/);
 assert.match(script,/Notification\.requestPermission\(\)/);
 assert.match(script,/objeoAlertPreferenceKey/);
 assert.doesNotMatch(script,/setTimeout\(\(\)=>objeoEnableAlerts/);
});
test('only incoming messages trigger optional browser alerts',()=>{
 assert.match(script,/message\?\.sender_id===objeoRealtimeUser/);
 assert.match(script,/!objeoAlertsEnabled\(\)/);
 assert.match(script,/Notification\.permission!=='granted'/);
 assert.match(script,/document\.hidden&&document\.hasFocus\(\)/);
});
test('no claim that alerts work after the browser closes',()=>{
 assert.match(script,/site est complètement fermé/);
 assert.match(script,/service d’envoi sécurisé/);
});
test('alerts can be disabled locally without altering messaging',()=>{
 assert.match(script,/function objeoDisableAlerts\(\)/);
 assert.match(script,/disable\.onclick=/);
 assert.match(html,/openObjeoAlertSettings/);
});
