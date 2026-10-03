import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => readFileSync(path, 'utf8');
function load(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: name => { if (name in imports) return imports[name]; throw Error(name); }, URL, AbortSignal, setTimeout, clearTimeout, ...globals });
  return exports;
}
const auth = load('src/lib/auth-client-flow.ts');
for (const value of ['//evil.test', '/\\evil.test', '/\n/evil.test', 'https://evil.test', '/app/ios/../android', '/app/ios-other']) {
  assert.equal(auth.safeAuthDestination(value, '/app/ios/you', '/app/ios'), '/app/ios/you');
}
assert.equal(auth.safeAuthDestination('/app/ios/feed?post=x#thread', '/', '/app/ios'), '/app/ios/feed?post=x#thread');
assert.equal(await auth.withAuthTimeout(Promise.resolve('ok'), 100, 'timeout'), 'ok');
await assert.rejects(auth.withAuthTimeout(new Promise(() => {}), 5, 'timeout'), /timeout/);
const routes = load('src/lib/app-link-routing.ts');
for (const surface of ['ios', 'android']) {
  for (const path of ['/feed', '/feed/post-id', '/beat/beat-id', '/playlist/playlist-id']) {
    assert.equal(routes.appRouteForNativeUrl(`https://bvsradio.com${path}?x=1#target`, surface), `/app/${surface}${path}?x=1#target`);
  }
  assert.equal(routes.appRouteForNativeUrl('bvsradio://creator/studio/songs/work-id', surface), `/app/${surface}/studio/songs/work-id`);
  assert.equal(routes.appRouteForNativeUrl('https://evil.test/feed', surface), null);
  assert.equal(routes.appRouteForNativeUrl('/\\evil.test/feed', surface), null);
  assert.equal(routes.appRouteForNativeUrl('https://bvsradio.com/privacy', surface), null);
}

// Run the real session provider with delayed account responses and an auth-lock sentinel.
let cursor = 0, states = [], refs = [], effects = [], authListener, inAuthCallback = false, sessionReads = 0;
const timers = new Map(); let timerId = 0;
const pending = new Map();
const react = {
  createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
  useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return refs[i] ||= { current: initial }; },
  useCallback: callback => { cursor++; return callback; }, useMemo: callback => { cursor++; return callback(); },
  useEffect(callback) { cursor++; effects.push(callback); },
};
const provider = load('src/components/app-vnext/AppSessionProvider.tsx', {
  react, 'react/jsx-runtime': { jsx: (_tag, props) => props, jsxs: (_tag, props) => props },
  '@/lib/auth-client-flow': auth,
  '@/lib/supabase': { isSupabaseConfigured: () => true, createClient: () => ({ auth: {
    getSession: async () => { sessionReads++; assert.equal(inAuthCallback, false, 'getSession must never run inside the auth callback'); return { data: { session: null } }; },
    onAuthStateChange: callback => { authListener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  } }) },
  '@capacitor/core': { Capacitor: { getPlatform: () => 'ios' } },
  '@/lib/app-native': { isNativeRuntime: () => false },
}, { setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id), fetch: (_url, init) => new Promise(resolve => pending.set(init.headers.Authorization, resolve)) });
function render() { cursor = 0; effects = []; return provider.AppSessionProvider({ children: null }).value; }
render(); const clean = effects[0]();
function emit(session) { inAuthCallback = true; authListener('SIGNED_IN', session); inAuthCallback = false; }
async function flush() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); for(let i=0;i<8;i++) await Promise.resolve(); }
const sessionA = { user: { id: 'A' }, access_token: 'A' }, sessionB = { user: { id: 'B' }, access_token: 'B' };
emit(sessionA); await flush(); emit(sessionB); await flush();
pending.get('Bearer B')({ ok: true, json: async () => ({ access: { artist: true }, profileDisplayName: 'B', premiumActive: false }) }); await flush();
pending.get('Bearer A')({ ok: true, json: async () => ({ access: { admin: true }, profileDisplayName: 'A', premiumActive: true }) }); await flush();
let value = render(); assert.equal(value.user.id, 'B'); assert.equal(value.profileDisplayName, 'B'); assert.equal(value.access.admin, undefined); assert.equal(value.premiumActive, false);
emit(null); await flush(); value = render(); assert.equal(value.signedIn, false); assert.equal(value.access, null); assert.equal(value.profileDisplayName, null); assert.equal(sessionReads, 0, 'Auth events must reuse their session rather than reacquire the lock'); clean();

// Run real Studio save handlers while the user continues editing.
cursor = 0; states = []; refs = []; effects = [];
const writes = [];
const workspace = load('src/components/SongWorkspace.tsx', {
  react, 'react/jsx-runtime': { jsx: (_tag, props) => props, jsxs: (_tag, props) => props },
  'next/link': { default: 'Link' }, 'next/navigation': { useRouter: () => ({ push() {} }) },
  '@/lib/analytics': { trackEvent() {} },
  '@/lib/draft-save-queue': load('src/lib/draft-save-queue.ts'),
  '@/lib/auth-client-flow': auth,
  '@/lib/supabase': { isSupabaseConfigured: () => true, createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'writer' } } }) } }) },
}, { window: { setTimeout: () => 1, clearTimeout() {} }, fetch: (_url, init) => init.method === 'PATCH'
  ? new Promise((resolve, reject) => writes.push({ body: JSON.parse(init.body), resolve, reject }))
  : Promise.resolve({ ok: true, json: async () => ({ workspace: { id: 'song', lyrics: '', notes: '', songTitle: '', workspaceKind: 'blank', licenceCode: 'free', audioUrl: 'stable-audio' } }) }) });
function renderWorkspace() { cursor = 0; effects = []; return workspace.default({ id: 'song' }); }
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...Object.values(tree).flatMap(value => Array.isArray(value) ? value.flatMap(nodes) : nodes(value))]; }
async function settle() { for (let i=0; i<15; i++) await Promise.resolve(); }
renderWorkspace(); effects[0](); await settle();
let tree = renderWorkspace(); nodes(tree).find(node => node.placeholder === '[Verse]\nStart writing here…').onChange({ target: { value: 'first draft' } });
tree = renderWorkspace(); nodes(tree).find(node => node.children === 'Save now').onClick(); await settle();
assert.equal(writes[0].body.lyrics, 'first draft');
nodes(tree).find(node => node.placeholder === '[Verse]\nStart writing here…').onChange({ target: { value: 'newer draft' } });
tree = renderWorkspace(); nodes(tree).find(node => node.children === 'Save now').onClick(); await settle();
assert.equal(writes.length, 1, 'Studio PATCH requests must be serialized');
writes[0].resolve({ ok: true, json: async () => ({ workspace: { lyrics: 'first draft', audioUrl: 'changed-audio' } }) }); await settle();
assert.equal(states[5], true, 'An old response must not mark newer writing as saved');
assert.equal(states[1].audioUrl, 'stable-audio', 'Saving lyrics must not restart the attached beat');
assert.equal(writes[1].body.lyrics, 'newer draft');
writes[1].reject(Error('network lost')); await settle();
assert.equal(states[5], true); assert.equal(states[6], 'error', 'Network errors must retain edits and expose retry');
tree = renderWorkspace(); nodes(tree).find(node => node.children === 'Save now').onClick(); await settle();
writes[2].resolve({ ok: true, json: async () => ({ workspace: { lyrics: 'newer draft' } }) }); await settle();
assert.equal(states[5], false); assert.equal(states[6], 'saved', 'The save queue must recover after a failed request');

// The actual offline worker must never retain account documents or RSC payloads.
const handlers = {}, puts = [], deleted = [];
const cache = { addAll: async () => {}, put: async (request) => puts.push(request.url || request), keys: async () => [], delete: async () => true };
let online = true;
const worker = {
  self: { location: { origin: 'https://bvsradio.com' }, addEventListener: (name, handler) => handlers[name] = handler, skipWaiting: async () => {}, clients: { claim: async () => {} } },
  caches: { open: async () => cache, keys: async () => ['bvs-shell-v1', 'other-app-cache'], delete: async key => deleted.push(key), match: async request => request === '/offline.html' ? new Response('BVS offline') : undefined },
  fetch: async () => { if (!online) throw Error('offline'); return new Response('account document'); }, URL, Response, Promise,
};
vm.runInNewContext(read('public/sw.js'), worker);
const waits = []; handlers.activate({ waitUntil: value => waits.push(value) }); await Promise.all(waits); assert.deepEqual(deleted, ['bvs-shell-v1']);
async function request(path, mode = 'navigate', headers = {}) {
  let response; const waits=[];
  handlers.fetch({ request: { url: 'https://bvsradio.com'+path, method: 'GET', mode, headers: new Headers(headers) }, respondWith: value => response=value, waitUntil: value => waits.push(value) });
  const result = response ? await response : undefined; await Promise.all(waits); return result;
}
assert.equal(await (await request('/account')).text(), 'account document'); assert.equal(puts.length, 0);
assert.equal(await request('/api/library'), undefined); assert.equal(await request('/library', 'cors', { RSC: '1' }), undefined); assert.equal(await request('/private-cover.jpg', 'cors'), undefined);
online=false; assert.equal(await (await request('/account')).text(), 'BVS offline'); assert.equal(puts.length, 0);
assert.match(read('src/components/app-vnext/AppExperienceStyle.tsx'), /touch-action: manipulation/, 'Native rails must support sideways panning and pinch zoom');
assert.match(read('src/components/app-vnext/AppExperienceStyle.tsx'), /--bvs-app-bottom-nav-height: var\(--bvs-nav-height,/, 'The player must consume the actual contained-nav measurement at every viewport width');
assert.match(read('src/components/app-vnext/AppExperienceStyle.tsx'), /bottom: var\(--bvs-app-bottom-nav-height\) !important/, 'Desktop player utilities must not cover the contained tab bar');
assert.doesNotMatch(read('src/components/app-vnext/AppGestureBridge.tsx'), /player\.(next|previous|closeNowPlaying)\(/, 'One shared bridge must own Now Playing swipes');
console.log('Audit regressions passed: bounded auth, safe redirects, native links, auth-lock/session isolation and private offline-cache safety.');
