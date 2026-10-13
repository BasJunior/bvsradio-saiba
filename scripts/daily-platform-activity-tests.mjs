import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx = (type, props) => ({ type, props });
function load(path, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (name in imports) return imports[name]; throw Error(name); }, URL, URLSearchParams, Date, ...globals });
  return exports;
}
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
let clock = '2026-10-13T23:59:00Z';
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return new Date(clock).getTime(); } }
const sent = [], localStorage = storage(), sessionStorage = storage(), document = { visibilityState: 'visible' };
const navigator = { doNotTrack: '0' };
const analytics = load('src/lib/analytics.ts', {}, {
  Date: Clock, document, navigator, crypto: { randomUUID: () => 'visitor-123' },
  window: { localStorage, sessionStorage, location: { pathname: '/app/ios/explore', search: '' } },
  fetch: (_url, options) => { sent.push({ ...JSON.parse(options.body), headers: options.headers }); return Promise.resolve({ ok: true }); },
});
analytics.trackPlatformVisit(); analytics.trackPlatformVisit();
assert.equal(sent.length, 1, 'Repeated browsing in the same tab/day is recorded once');
assert.equal(sent[0].event, 'platform_visit'); assert.equal(sent[0].properties.surface, 'ios');
assert.equal(sent[0].userId, null);
analytics.setAnalyticsIdentity('member-a', 'token-a'); analytics.trackPlatformVisit(); analytics.trackPlatformVisit();
assert.equal(sent.length, 2, 'Signing in after a guest visit records the authenticated identity once');
assert.equal(sent[1].headers.Authorization, 'Bearer token-a');
assert.equal(sent[0].visitorId, sent[1].visitorId, 'Guest and signed-in events retain one browser identity');
clock = '2026-10-14T00:01:00Z'; analytics.trackPlatformVisit();
assert.equal(sent.length, 3, 'An open tab records the next UTC day');
document.visibilityState = 'hidden'; analytics.setAnalyticsIdentity('member-b', 'token-b'); analytics.trackPlatformVisit(); assert.equal(sent.length, 3);
document.visibilityState = 'visible'; localStorage.setItem('bvs.analytics.disabled', '1'); analytics.trackPlatformVisit(); assert.equal(sent.length, 3);
localStorage.setItem('bvs.analytics.disabled', '0'); navigator.doNotTrack = '1'; analytics.trackPlatformVisit(); assert.equal(sent.length, 3);
navigator.doNotTrack = '0'; analytics.trackPlatformVisit(); assert.equal(sent.length, 4);

let permitted = false; const requests = [];
const route = load('src/app/api/admin/editorial/analytics/route.ts', {
  'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
  '@/lib/editorial-server': { editorialIdentity: async () => permitted ? { role: 'editor' } : null, editorialUrl: path => `https://db.test/${path}`, serviceHeaders: { Authorization: 'server-only' } },
}, { fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => url.includes('/rpc/') ? [{ day: '2026-10-13', visitors: '12', signed_in_users: '3', visit_tracking: true }] : [] }; } });
assert.equal((await route.GET(new Request('https://bvsradio.com/api/admin/editorial/analytics'))).status, 403);
assert.equal(requests.length, 0, 'Daily activity cannot be fetched without staff authorization');
permitted = true;
const response = await route.GET(new Request('https://bvsradio.com/api/admin/editorial/analytics?days=7'));
assert.equal(response.status, 200); assert.equal(response.body.platformActivity.daily[0].visitors, 12); assert.equal(response.body.platformActivity.daily[0].signedInUsers, 3);
const rpc = requests.find(request => request.url.includes('/rpc/'));
assert.equal(rpc.options.method, 'POST'); assert.equal(rpc.options.headers.Authorization, 'server-only');
const range = JSON.parse(rpc.options.body); assert.equal(Math.round((new Date(range.end_day) - new Date(range.start_day)) / 86400000), 6);
assert.deepEqual(Object.keys(response.body.platformActivity.daily[0]).sort(), ['day', 'signedInUsers', 'visitTracking', 'visitors']);

const Chart = load('src/components/DailyActivityChart.tsx', { react: { useMemo: fn => fn() }, 'react/jsx-runtime': { jsx, jsxs: jsx } }).default;
function nodes(tree) { return tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : []; }
for (const daily of [[], [{ day: '2026-10-13', visitors: 0, signedInUsers: 0 }], [{ day: '2026-10-12', visitors: 30, signedInUsers: 4 }, { day: '2026-10-13', visitors: 50, signedInUsers: 8 }]]) {
  const rendered = nodes(Chart({ activity: { timezone: 'UTC', daily }, rangeDays: 7 }));
  assert.equal(rendered.filter(node => node.type === 'polyline').length, 2);
  for (const line of rendered.filter(node => node.type === 'polyline')) assert(!/NaN|Infinity/.test(line.props.points));
  assert.equal(rendered.filter(node => node.type === 'tr').length, daily.length + 1, 'Exact daily numbers remain available to touch and assistive readers');
}
console.log('Daily activity passed: browse-only visits, auth transitions, daily rollover, opt-outs, staff access, numeric aggregates and accessible zero/single-day charts.');
