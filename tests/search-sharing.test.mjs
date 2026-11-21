import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const jsBlocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(match => !match[0].includes('application/ld+json'))
  .map(match => match[1]);

test('inline JavaScript is syntactically valid', () => {
  for (const block of jsBlocks) new vm.Script(block);
});

const start = html.indexOf('function objeoEditDistance(');
const end = html.indexOf('function objeoCategoryMatch(', start);
assert.ok(start >= 0 && end > start, 'Search functions exist');
const source = html.slice(start, end);
const context = {
  normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
};
vm.createContext(context);
vm.runInContext(source, context);

test('tolerates common typos and accents', () => {
  const found = { title: 'Portefeuille noir', cat: 'Papiers', city: 'Rouen', desc: 'Trouvé dans le centre' };
  assert.ok(context.objeoMatchesQuery(found, ['portefeuile']));
  assert.ok(context.objeoMatchesQuery(found, ['portefeuille']));
  assert.ok(context.objeoMatchesQuery({title:'Clés',cat:'Clés et badges',city:'Paris'}, ['cles']));
  assert.equal(context.objeoMatchesQuery(found, ['telephone']), false);
});

test('handles synonyms and ignores duplicate IDs', () => {
  const found = {title:'Téléphone Samsung',cat:'Électronique',city:'Rouen'};
  assert.ok(context.objeoMatchesQuery(found, ['portable']));
  const unique = context.objeoUniqueAds([{id:'a'}, {id:'a'}, {id:'b'}]);
  assert.equal(unique.length, 2);
});

test('search remains publicly accessible and uses one ranking rule', () => {
  assert.match(html, /async function searchWithAi\(\)\{const q=/);
  assert.match(html, /score:objeoMatchScore\(a,terms\)/);
  assert.match(html, /p_query:null/);
});

test('sharing covers geo results and accurate Instagram labeling', () => {
  assert.match(html, /function objeoAdById\(id\)/);
  assert.match(html, /Créer un visuel Instagram/);
  assert.match(html, /async function openObjeoPublicAd\(id\)/);
});

test('city fallback considers nearby towns, not only the exact city', () => {
  assert.match(html, /async function fallbackCityAds\(place\)/);
  assert.match(html, /kmBetween\(place,centre\)<=radius/);
});
