import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const settle = () => new Promise(resolve => setImmediate(resolve));
function harness(fetch) {
  const slots = [], effects = [], timers = new Map();
  let index = 0, timerId = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = index++; return slots[i] ||= { current: initial }; },
    useEffect(fn, deps) {
      const i = index++, previous = slots[i];
      if (!previous || deps.some((dep, n) => dep !== previous.deps[n])) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync('src/lib/use-discovery-search.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, AbortController, fetch, window: { setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } }, require: name => { assert.equal(name, 'react'); return react; } });
  return {
    render(params, enabled = true) { index = 0; const result = exports.useDiscoverySearch(params, enabled); effects.splice(0).forEach(fn => fn()); return result; },
    flush() { const pending = [...timers.values()]; timers.clear(); return Promise.all(pending.map(fn => fn())); },
  };
}
const item = id => ({ id: String(id), kind: 'beat', title: `Beat ${id}`, subtitle: 'Producer', href: `/beat/${id}` });
const page = items => ({ items, counts: { beat: 180 }, total: 180, sounds: [], unavailable: [], offset: 0, limit: 100 });
let calls = [], requests = [];
const race = harness((url, options) => { calls.push(url); return new Promise(resolve => requests.push({ url, options, resolve })); });
race.render({ q: 'first', limit: 8 }, false); await race.flush();
assert.equal(calls.length, 0, 'Closed header must not request the catalogue');
race.render({ q: 'first', limit: 8 }); const first = race.flush();
race.render({ q: 'second', limit: 8 }); const second = race.flush();
assert(requests[0].options.signal.aborted, 'Previous query must be cancelled');
requests[1].resolve({ ok: true, json: async () => page([item('second')]) }); await second;
let result = race.render({ q: 'second', limit: 8 });
assert.equal(result.items[0].id, 'second');
requests[0].resolve({ ok: true, json: async () => page([item('first')]) }); await first;
result = race.render({ q: 'second', limit: 8 });
assert.equal(result.items[0].id, 'second', 'Late results must not overwrite a newer query');

const offsets = [];
const pagination = harness(async address => {
  const params = new URL(address, 'https://bvsradio.com').searchParams;
  const offset = Number(params.get('offset')), limit = Number(params.get('limit'));
  offsets.push(offset);
  return { ok: true, json: async () => page(Array.from({ length: Math.min(limit, 180 - offset) }, (_, i) => item(i + offset))) };
});
pagination.render({ q: 'beat', type: 'beat', limit: 40 }); await pagination.flush();
assert.equal(pagination.render({ q: 'beat', type: 'beat', limit: 40 }).items.length, 40);
pagination.render({ q: 'beat', type: 'beat', limit: 80 }); await pagination.flush();
assert.equal(pagination.render({ q: 'beat', type: 'beat', limit: 80 }).items.length, 80);
pagination.render({ q: 'beat', type: 'beat', limit: 200 }); await pagination.flush();
result = pagination.render({ q: 'beat', type: 'beat', limit: 200 });
assert.equal(result.items.length, 180, 'Load more must cross API page boundaries');
assert.equal(new Set(result.items.map(item => item.id)).size, 180);
assert.deepEqual(offsets, [0, 40, 80, 180], 'Load more must append rather than refetch older pages');
let failures = true;
const recovery = harness(async () => failures ? { ok: false } : { ok: true, json: async () => page([item('recovered')]) });
recovery.render({ q: 'beat', limit: 8 }); await recovery.flush();
result = recovery.render({ q: 'beat', limit: 8 });
assert.equal(result.loading, false);
assert.equal(result.unavailable.length, 1, 'An API failure must not masquerade as a complete empty result');
failures = false; result.retry(); recovery.render({ q: 'beat', limit: 8 }); await recovery.flush();
assert.equal(recovery.render({ q: 'beat', limit: 8 }).items[0].id, 'recovered');
await settle();
console.log('Search client passed: intent gating, debounce cleanup, stale-response cancellation, appended pagination past 100, failure state and retry.');
