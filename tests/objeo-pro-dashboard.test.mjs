import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../etablissements.html',import.meta.url),'utf8');

test('Objeo Pro scripts parse after dashboard extensions',()=>{
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(match[0].includes('application/ld+json'))continue;
  new vm.Script(match[1]);
 }
});
test('automatic refresh has visibility, cleanup and reentry guards',()=>{
 assert.match(html,/function startProAutoRefresh\(/);
 assert.match(html,/function stopProAutoRefresh\(/);
 assert.match(html,/proRefreshBusy/);
 assert.match(html,/document\.hidden/);
 assert.match(html,/setInterval\(refreshProForeground,45000\)/);
});
test('dashboard metrics are based on the signed-in establishment',()=>{
 assert.match(html,/eq\('establishment_id',myEst\.id\)/);
 assert.match(html,/id="proMetricRate"/);
 assert.match(html,/function refreshProInsights\(/);
 assert.match(html,/function renderProMonthlyAnalytics\(/);
});
test('old ads are reviewed, never automatically marked returned',()=>{
 const block=html.slice(html.indexOf('function reviewOldProItems(){'),html.indexOf('let proRefreshTimer='));
 assert.match(block,/goProSection\('proMyItemsSection'\)/);
 assert.doesNotMatch(block,/update\(\{status:'returned'\}\)/);
});
