import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => imports[name], AbortController, ...globals });
  return exports;
}
function harness() {
  let cursor = 0;
  const values = [], effects = [], callbacks = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useCallback(fn, deps) { const i = cursor++; const old = callbacks[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) callbacks[i] = { fn, deps }; return callbacks[i].fn; },
    useEffect(fn, deps) { const i = cursor++; const old = effects[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) { old?.cleanup?.(); effects[i] = { fn, deps, pending: true }; } },
  };
  return { react, render(fn) { cursor = 0; return fn(); }, commit() { effects.forEach(effect => { if (effect.pending) { effect.pending = false; effect.cleanup = effect.fn(); } }); }, stop() { effects.forEach(effect => effect.cleanup?.()); } };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const requests = [];
const h = harness();
const timers = new Map(); let timerId = 0;
const account = load('src/lib/use-account-json.ts', { react: h.react }, {
  window: { setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) },
  fetch: (url, init) => new Promise(resolve => requests.push({ url, init, resolve })),
});
const render = (owner, token = owner, enabled = true) => h.render(() => account.useAccountJson({ owner, token, enabled, url: '/private' }));
assert.equal(render('A').loading, true); h.commit();
requests[0].resolve({ ok: true, json: async () => ({ title: 'A private work' }) }); await flush();
assert.equal(render('A').data.title, 'A private work');
assert.equal(render('B').data, null, 'Old account must disappear before effects run'); h.commit();
assert.equal(requests[0].init.signal.aborted, true);
requests[1].resolve({ ok: true, json: async () => ({ title: 'B private work' }) }); await flush();
assert.equal(render('B').data.title, 'B private work');
render('C'); h.commit(); render('D'); h.commit();
requests[3].resolve({ ok: true, json: async () => ({ title: 'D private work' }) }); await flush();
requests[2].resolve({ ok: true, json: async () => ({ title: 'C late work' }) }); await flush();
assert.equal(render('D').data.title, 'D private work', 'Superseded response must not replace current work');
assert.equal(render('D', 'D', false).data, null, 'Revoked access hides retained work immediately'); h.commit();
assert.equal(render('', '').data, null);
render('E'); h.commit(); const pending = requests.at(-1);
for (const callback of [...timers.values()]) callback();
assert.equal(pending.init.signal.aborted, true, 'Slow request must be bounded');
h.stop(); pending.resolve({ ok: true, json: async () => ({ title: 'unmounted' }) }); await flush();

const storage = new Map(); let ownerEvents = 0;
const library = load('src/lib/library.ts', {}, { window: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, dispatchEvent: () => ownerEvents++ }, CustomEvent: class {} });
const item = { id: 'song', kind: 'track', title: 'Song', subtitle: 'Artist', href: '/radio' };
library.writeLibrary('history', [item]); library.setLibraryCacheOwner('A');
assert.equal(library.libraryItemsFromSnapshot(library.getLibrarySnapshot('history', 'A')).length, 1);
assert.equal(library.getLibrarySnapshot('history', 'B'), '[]');
assert.equal(library.getLibrarySnapshot('history', ''), '[]', 'Signed-out view hides account cache');
assert.equal(library.libraryItemsFromSnapshot('[null,{},"bad"]').length, 0);
assert.equal(library.libraryItemsFromSnapshot('{"broken":true}').length, 0);
const before = ownerEvents; library.setLibraryCacheOwner('B'); assert.equal(ownerEvents, before + 1, 'Owner change must notify mounted Library views');

const authHarness = harness(); let listener, resolveInitial;
const browser = load('src/lib/use-browser-session.ts', { react: authHarness.react,
  '@/lib/auth-client-flow': { withAuthTimeout: promise => promise },
  '@/lib/supabase': { isSupabaseConfigured: () => true, createClient: () => ({ auth: { onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; }, getSession: () => new Promise(resolve => { resolveInitial = resolve; }) } }) },
});
authHarness.render(browser.useBrowserSession); authHarness.commit();
listener('SIGNED_IN', { user: { id: 'B' }, access_token: 'B' });
resolveInitial({ data: { session: { user: { id: 'A' }, access_token: 'A' } } }); await flush();
assert.equal(authHarness.render(browser.useBrowserSession).session.user.id, 'B', 'Late initial session must not revert a newer auth event');
listener('SIGNED_OUT', null); assert.equal(authHarness.render(browser.useBrowserSession).session, null); authHarness.stop();
console.log('Account collection behavior passed: owner isolation, stale responses, revoked access, deadlines, malformed cache, auth race.');
