import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('inline scripts remain syntactically valid',()=>{
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(match[0].includes('application/ld+json'))continue;
    new vm.Script(match[1]);
  }
});
test('header is compact and has an explicit accessible return action',()=>{
  assert.match(html,/aria-label="Retour aux annonces">← Annonces<\/button>/);
  assert.match(html,/class="objeo-detail-heading">Détails de l’annonce/);
  assert.match(html,/#legacy \.legacy-toolbar>#shareArea\{display:none!important\}/);
});
test('AI search is moved beside contextual actions for lost items',()=>{
  assert.match(html,/safetyActions'\)\.appendChild\(aiButton\)/);
  assert.match(html,/aiButton\.style\.display=objeoAdById\(id\)\?\.type==='lost'/);
  assert.match(html,/Chercher des objets similaires/);
});
test('author cannot contact own ad from this detail view',()=>{
  assert.match(html,/const currentUserIsAuthor=/);
  assert.match(html,/style\.display=currentUserIsAuthor\?'none':'inline-block'/);
});
