import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=f=>fs.readFileSync(new URL(f,root),'utf8');
const index=read('index.html');
const legacy=read('backups/index-before-leboncoin-2026-11-18.html');
const chat=read('assets/objeo-chat-enhancements.js');
const sql=read('supabase/migrations/20261122_author_only_close_ad.sql');

test('all inline scripts and chat module parse',()=>{
 for(const page of [index,legacy])for(const m of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[0].includes('application/ld+json'))continue;
  new vm.Script(m[1]);
 }
 new vm.Script(chat);
});
test('only author can close a listing, and no ad deletion is used',()=>{
 assert.match(sql,/a\.user_id = \(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/IF v_status <> 'open'/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.objeo_close_own_ad\(uuid\) TO authenticated/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.objeo_close_own_ad\(uuid\) FROM PUBLIC, anon/);
 assert.doesNotMatch(sql,/DELETE FROM public\.ads/);
});
test('found and lost listings are both marked returned',()=>{
 assert.match(sql,/IF v_kind = 'found'/);
 assert.match(sql,/PERFORM public\.objeo_mark_returned\(p_ad_id\)/);
 assert.match(sql,/ELSIF v_kind = 'lost'/);
 assert.match(sql,/SET status = 'returned'/);
});
test('author controls are labeled for both kinds',()=>{
 assert.match(index,/J’ai remis l’objet/);
 assert.match(index,/J’ai récupéré mon objet/);
 assert.match(legacy,/J’ai remis l’objet/);
 assert.match(legacy,/J’ai récupéré mon objet/);
 assert.match(chat,/objeoChatOwnerReturn/);
 assert.match(chat,/closeObjeoAd\(ad\.id,\{ctx\}\)/);
});
test('legacy completion does not delete ads, photos or conversations',()=>{
 const block=legacy.slice(legacy.indexOf('async function doneAd(){'),legacy.indexOf('function mine(){'));
 assert.match(block,/objeo_close_own_ad/);
 assert.doesNotMatch(block,/\.delete\(\)/);
 assert.doesNotMatch(block,/\.storage\.from/);
 assert.doesNotMatch(block,/S\.msgs=S\.msgs\.filter/);
});
test('profile retains returned listing in its history',()=>{
 assert.match(index,/a\.status==='returned'\|\|a\.status==='resolved'\?'Restitué'/);
 assert.match(index,/objeo-author-closed/);
 assert.match(index,/objeoPublishedShare/);
 assert.match(index,/objeo:ad-closed/);
});
