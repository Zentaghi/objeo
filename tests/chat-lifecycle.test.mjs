import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../assets/objeo-chat-enhancements.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261121_chat_read_receipts_optional_phone.sql',import.meta.url),'utf8');

test('JavaScript source parses',()=>{
  new vm.Script(script);
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(match[0].includes('application/ld+json'))continue;
    new vm.Script(match[1]);
  }
});
test('every message has a date and time and messages show unread counts',()=>{
  assert.match(script,/Intl\.DateTimeFormat\('fr-FR'/);
  assert.match(script,/message\.created_at/);
  assert.match(script,/objeo_message_reads/);
  assert.match(html,/data-objeo-unread/);
  assert.match(script,/setInterval\(\(\)=>\{if\(!document\.hidden\)updateBadges\(\)\},25000\)/);
});
test('found-object claim lifecycle is available inside conversations',()=>{
  assert.match(script,/meta\?\.ads\?\.kind!=='found'/);
  assert.match(script,/openSafetyForm\('claim',meta\.ad_id\)/);
  assert.match(script,/objeo_decide_claim/);
  assert.match(script,/pending:'⏳/);
  assert.match(script,/accepted:'✅/);
  assert.match(script,/rejected:'❌/);
});
test('contacts are revealed only after accepted claim and optional explicit phone consent',()=>{
  assert.match(script,/if\(claim\.status==='accepted'\)/);
  assert.match(script,/objeo_accepted_claim_contact/);
  assert.match(script,/objeo_accepted_claim_phone/);
  assert.match(sql,/c\.status='accepted'/);
  assert.match(sql,/cp\.share_phone_after_acceptance IS TRUE/);
  assert.match(sql,/share_phone_after_acceptance boolean NOT NULL DEFAULT false/);
});
test('read receipts belong to conversation participant',()=>{
  assert.match(sql,/user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/c\.seeker_id=\(SELECT auth\.uid\(\)\) OR a\.user_id=\(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
});
test('profile offers optional contact settings',()=>{
  assert.match(html,/openObjeoPhonePreferences/);
  assert.match(script,/window\.openObjeoPhonePreferences/);
  assert.match(script,/share_phone_after_acceptance:share&&!!phone/);
});
