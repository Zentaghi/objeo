import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const chat=fs.readFileSync(new URL('../assets/objeo-chat-enhancements.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('inbox JavaScript parses',()=>{new vm.Script(chat)});
test('regular and professional conversations share one descending last-message sort',()=>{
 assert.match(chat,/sortObjeoInbox\(list\)/);
 assert.match(chat,/cards\.sort\(\(a,b\)=>Number\(b\.dataset\.lastActivity\|\|0\)-Number\(a\.dataset\.lastActivity\|\|0\)\)/);
 assert.match(chat,/card\.dataset\.lastActivity=String\(Date\.parse\(items\[0\]\.created_at\)\|\|0\)/);
 assert.match(chat,/card\.dataset\.lastActivity=String\(Date\.parse\(m\?\.created_at\|\|c\.created_at\)\|\|0\)/);
});
test('each inbox card displays an unread count without showing zero',()=>{
 assert.match(chat,/function setObjeoUnreadBadge\(card,count\)/);
 assert.match(chat,/if\(!count\)return/);
 assert.match(chat,/setObjeoUnreadBadge\(card,n\)/);
 assert.match(chat,/setObjeoUnreadBadge\(card,count\)/);
 assert.match(page,/objeo-conversation-unread/);
});
test('professional read receipts are scoped to the current user and thread',()=>{
 assert.match(chat,/from\('objeo_pro_message_reads'\)/);
 assert.match(chat,/user_id:ctx\.user\.id/);
 assert.match(chat,/await markProRead\(ctx,c\.id\)/);
});
test('inbox refreshes when newer messages arrive',()=>{
 assert.match(chat,/function startObjeoInboxPolling\(\)/);
 assert.match(chat,/if\(latest>displayed\)window\.openObjeoMessages\(\)/);
});
