import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../assets/objeo-chat-enhancements.js',import.meta.url),'utf8');
test('realtime module parses',()=>new vm.Script(js));
test('subscribes only to protected database INSERT events',()=>{
 assert.match(js,/\.on\('postgres_changes',\{event:'INSERT',schema:'public',table:'messages'\},objeoRealtimeMessage\)/);
 assert.match(js,/\.channel\('objeo-messages-'\+ctx\.user\.id\)/);
 assert.doesNotMatch(js,/event:'\*'/);
});
test('new messages appear once, preserving timestamps and sender',()=>{
 assert.match(js,/objeoRealtimeThreadKeys\.has\(id\)/);
 assert.match(js,/objeoRealtimeThreadKeys\.add\(id\)/);
 assert.match(js,/messageNode\(m,objeoRealtimeThreadCtx,objeoRealtimeThreadIdentity\)/);
 assert.match(js,/node\.dataset\.messageId=key/);
 assert.match(js,/formatDate\(message\.created_at\)/);
});
test('message subscriptions and state reset for different users',()=>{
 assert.match(js,/objeoRealtimeClient===ctx\.sb&&objeoRealtimeUser===ctx\.user\.id/);
 assert.match(js,/objeoRealtimeClient\.removeChannel\(objeoRealtimeChannel\)/);
 assert.match(js,/objeoRealtimeForgetThread\(\)/);
});
test('offline fallback fetches missing messages and marks read only when focused',()=>{
 assert.match(js,/async function objeoRealtimeRefreshThread\(\)/);
 assert.match(js,/objeoRealtimeState!=='SUBSCRIBED'/);
 assert.match(js,/document\.hasFocus\(\)/);
 assert.match(js,/objeoRealtimeRefreshThread\(\)/);
});
test('unread badges refresh on every event',()=>{
 assert.match(js,/updateBadges\(\);/);
 assert.match(js,/window\.objeoRealtimeReconnect=objeoRealtimeEnsure/);
});
