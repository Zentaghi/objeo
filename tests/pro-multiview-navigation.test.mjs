import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../etablissements.html',import.meta.url),'utf8');

test('Objeo Pro application JavaScript still parses',()=>{
 for(const m of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[0].includes('application/ld+json')||!m[1].trim())continue;
  new vm.Script(m[1]);
 }
});
test('professional screens use a single active view and own content',()=>{
 for(const id of ['proAppNav','proDashboard','proSettingsView','proPublishSection','proMyItemsSection','proClaimsSection','proQRSection','proHistorySection','proAnalyticsSection']){
  assert.ok(source.includes(id),id);
 }
 assert.match(source,/function goProView\(view,options=\{\}\)/);
 assert.match(source,/section\.classList\.toggle\('pro-view-off',section\.dataset\.proView!==view\)/);
 assert.match(source,/const screens=\[/);
 assert.match(source,/#manage \.pro-view-off\{display:none!important\}/);
});
test('editing announcements and establishment opens the corresponding view',()=>{
 assert.match(source,/goProView\('publish'\);\$\('itemForm'\)\.scrollIntoView/);
 assert.match(source,/function editEstablishment\(\)\{goProView\('settings'\)/);
});
test('new establishment starts on settings, existing establishment starts on home',()=>{
 assert.match(source,/goProView\(est\?\(new URLSearchParams\(location\.search\)\.get\('vue'\)\|\|'home'\):'settings'/);
 assert.match(source,/document\.querySelectorAll\('\[data-pro-nav\]'\)/);
});
