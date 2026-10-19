import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/beatstore-server.ts', import.meta.url), 'utf8');
const functionSource = source.slice(source.indexOf('export async function listPublishedBeats('), source.indexOf('export async function listSubmittedBeats(')).replace('export ', '');
const code = ts.transpileModule(functionSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const producer = '53356afa-421e-4648-8936-d729cdcb23d5';
const oldBeats = ['People Watching', 'Lights off', 'Nonstop', 'Glo Gang'].map((title, i) => ({ id: `pluto-${i}`, title, producer_user_id: producer, is_public: true, status: 'published', rights_confirmed: true }));
const rows = [
  ...Array.from({ length: 120 }, (_, i) => ({ id: `new-${i}`, producer_user_id: 'another', is_public: true, status: 'published', rights_confirmed: true })),
  ...oldBeats,
  { ...oldBeats[0], id: 'private', is_public: false },
  { ...oldBeats[0], id: 'draft', status: 'draft' },
  { ...oldBeats[0], id: 'uncleared', rights_confirmed: false },
];
for (const fallback of [false, true]) {
  const context = vm.createContext({
    url: 'https://example.test', service: 'test', creatorHeaders: {},
    creatorUrl: path => `https://example.test/${path}`,
    fairCreatorDailyOrder: rows => rows,
    console: { warn() {}, error() {} },
    fetch: async url => {
      const q = new URL(url).searchParams;
      if (fallback && q.get('select').includes('beat_licence_options')) return { ok: false, status: 400, text: async () => 'embed unavailable' };
      // Simulate PostgREST filters BEFORE limit; guards must survive both query paths.
      for (const [key, value] of Object.entries({ is_public: 'eq.true', status: 'eq.published', rights_confirmed: 'eq.true' })) assert.equal(q.get(key), value);
      let found = rows.filter(row => row.is_public && row.status === 'published' && row.rights_confirmed);
      if (q.has('producer_user_id')) found = found.filter(row => `eq.${row.producer_user_id}` === q.get('producer_user_id'));
      return { ok: true, json: async () => found.slice(0, Number(q.get('limit'))) };
    },
  });
  vm.runInContext(code, context);
  assert.equal((await context.listPublishedBeats(120)).length, 120);
  assert.deepEqual(Array.from(await context.listPublishedBeats(120, producer), row => row.title), oldBeats.map(row => row.title));
}
const flow = await readFile(new URL('../src/components/flow/FlowRelationships.tsx', import.meta.url), 'utf8');
const catalogue = await readFile(new URL('../src/app/catalogue/page.tsx', import.meta.url), 'utf8');
assert.ok(flow.includes('/api/beats?producer_user_id=${encodeURIComponent(id)}'));
assert.ok(catalogue.includes('&producer=${encodeURIComponent(producerFilter)}'));
assert.ok(catalogue.includes('}, [producerFilter]);'));
console.log('Producer catalogue regression passed: older public beats returned; private/draft/uncleared excluded, including embed fallback.');
