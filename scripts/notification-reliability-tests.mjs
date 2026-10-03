import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { EventEmitter } from 'node:events';
import * as crypto from 'node:crypto';
const read = path => readFileSync(path, 'utf8');
function module(path, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === 'server-only' ? {} : imports[name] || (() => { throw Error(name); })(), Date, Intl, Map, Set, Buffer, URL, AbortSignal, setTimeout, clearTimeout, console, ...globals });
  return exports;
}
let failOperations = true;
const inbox = module('src/lib/notification-inbox.ts', {}, { fetch: async url => {
  if (url === '/api/notifications' && failOperations) throw Error('offline');
  const source = url.includes('participation') ? 'community' : url.includes('marketplace') ? 'marketplace' : 'operations';
  return { ok: true, status: 200, json: async () => ({ events: [{ id: source, title: source, created_at: '2026-10-03T10:00:00Z' }], unreadCount: 2 }) };
} });
let result = await inbox.loadNotificationInbox('token', 'ios');
assert.equal(result.failed, 1);
assert.equal(result.loaded.length, 2, 'One source failure must preserve community and Marketplace');
let merged = inbox.mergeNotificationInbox([{ id: 'old-op', source: 'operations', created_at: '2026-10-02T10:00:00Z' }], result.loaded);
assert.equal(merged.length, 3, 'A failed refresh must preserve previously loaded notices');
failOperations = false;
result = await inbox.loadNotificationInbox('token', 'ios');
merged = inbox.mergeNotificationInbox(merged, result.loaded);
assert.equal(merged.length, 3);
assert.ok(!merged.some(e => e.id === 'old-op'), 'A successful refresh replaces only its source');
const categories = module('src/lib/notification-categories.ts', {});
assert.equal(categories.operationNotificationEnabled('order', { orders: false }), false);
assert.equal(categories.operationNotificationEnabled('track', { creator_work: false }), false);
assert.equal(categories.operationNotificationEnabled('show', { shows: false }), false);

// Execute actual native registration against the iOS message bridge.
class WindowEvents extends EventTarget { setTimeout = setTimeout; clearTimeout = clearTimeout; }
class Custom extends Event { constructor(type, options) { super(type); this.detail = options.detail; } }
const win = new WindowEvents();
const stored = new Map();
let permission = 'denied', storageWorks = true, registrations = 0;
win.webkit = { messageHandlers: { bvsPushRegistration: { postMessage(payload) {
  if (payload.action === 'register') {
    registrations++;
    win.dispatchEvent(new Custom('bvs:native-push-permission', { detail: { state: permission } }));
    if (permission === 'granted') win.dispatchEvent(new Custom('bvs:native-push-registration', { detail: { token: 'a'.repeat(64) } }));
  }
} } } };
const native = module('src/lib/app-native.ts', { '@capacitor/core': {
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
  registerPlugin: () => ({ get: async ({ key }) => ({ value: stored.get(key) || null }), set: async ({ key, value }) => stored.set(key, value) }),
} }, { window: win, CustomEvent: Custom, fetch: async () => ({ ok: storageWorks, json: async () => ({ error: 'Storage unavailable' }) }) });
assert.equal((await native.registerPushDevice('access', 'ios')).permission, 'denied');
permission = 'granted'; storageWorks = false;
result = await native.registerPushDevice('access', 'ios');
assert.equal(result.ok, false);
assert.equal(result.permission, 'granted', 'Permission must stay granted when device storage fails');
storageWorks = true;
assert.equal((await native.registerPushDevice('access', 'ios')).ok, true);
assert.equal(stored.get('bvs_push_device_token'), 'a'.repeat(64));
await native.unregisterPushDevice('access');
assert.equal(stored.get('bvs_push_device_token'), '');
assert.equal(registrations, 3);

// Execute APNs request creation; use an ephemeral test key, never a production credential.
const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
let appleHeaders, applePayload;
const apns = module('src/lib/apns-server.ts', { 'node:crypto': crypto, 'node:http2': { connect() {
  const client = new EventEmitter(); client.close = () => {}; client.destroy = () => {};
  client.request = headers => {
    appleHeaders = headers;
    const request = new EventEmitter(); request.setEncoding = () => {};
    request.end = payload => { applePayload = JSON.parse(payload); queueMicrotask(() => { request.emit('response', { ':status': 200, 'apns-id': 'test-receipt' }); request.emit('end'); }); };
    return request;
  }; return client;
} } }, { queueMicrotask, process: { env: { BVS_APNS_KEY_ID: 'test', BVS_APNS_TEAM_ID: 'test', BVS_APNS_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }) } } });
result = await apns.sendApnsPush({ token: 'a'.repeat(64), title: 'BVS', body: 'An update', href: '/app/ios/notifications', notificationId: 'notification-id' });
assert.equal(result.ok, true);
assert.ok(Number(appleHeaders['apns-expiration']) > Date.now() / 1000 + 23 * 3600, 'Offline devices need time for Apple to store the alert');
assert.equal(appleHeaders['apns-collapse-id'], 'notification-id', 'Retry identity must remain stable');
assert.equal(appleHeaders['apns-push-type'], 'alert');
assert.equal(applePayload.aps.sound, 'default');

// Exercise queue consent and retry policy using actual delivery code.
let pref = [], sent = 0, queried = [], patches = [];
const delivery = { id: 'delivery', notification_id: 'notice', recipient_user_id: 'user', destination_key: 'a'.repeat(64), app_identity: 'ios:vnext', status: 'ambiguous', attempts: 1 };
const push = module('src/lib/participation-push-server.ts', {
  'node:crypto': crypto,
  '@/lib/apns-server': { apnsConfigured: () => true, sendApnsPush: async () => { sent++; return { ok: true, receipt: 'accepted' }; } },
  '@/lib/participation-delivery-policy': { notificationEligible: async () => true, notificationHref: () => '/app/ios/notifications', quietNow: () => false },
  '@/lib/participation-server': {
    participationRows: async path => { queried.push(path); if (path.startsWith('participation_preferences')) return pref;
      if (path.startsWith('app_push_devices')) return [{ user_id: 'user', device_token: 'a'.repeat(64), platform: 'ios' }];
      if (path.startsWith('participation_deliveries')) return [delivery];
      if (path.startsWith('participation_notifications')) return [{ id: 'notice', recipient_user_id: 'user', title: 'Update', detail: 'BVS update', target_href: '/notifications' }]; return []; },
    participationPatch: async (path, body) => { patches.push({ path, body }); return body.status === 'processing' ? [delivery] : []; },
    participationInsert: async () => [],
  },
}, { process: { env: {} } });
result = await push.queueParticipationPushNotifications();
assert.equal(result.users, 0, 'Missing preferences must never imply consent');
await push.deliverParticipationPushQueue();
assert.equal(sent, 0, 'No preference row must suppress delivery without crashing');
assert.ok(patches.some(p => p.body.status === 'suppressed'));
pref = [{ user_id: 'user', external_community_enabled: true, timezone: 'UTC' }];
await push.deliverParticipationPushQueue();
assert.equal(sent, 1);
assert.ok(queried.some(p => p.includes('status=in.(queued,failed,ambiguous)')), 'Uncertain deliveries must re-enter bounded retries');
assert.ok(patches.some(p => p.body.status === 'sent'));
const swift = read('ios/App/App/AppDelegate.swift');
assert.match(swift, /action == "ready"/);
assert.match(swift, /action == "ack"/);
assert.match(swift, /guard self.pushActionBridgeReady/);
assert.match(swift, /openSettingsURLString/);
const webPage = read('src/app/notifications/page.tsx');
const appPage = read('src/components/app-vnext/AppNotificationsClient.tsx');
assert.match(webPage, /mergeNotificationInbox/);
assert.match(appPage, /mergeNotificationInbox/);
assert.match(appPage, /bvs:native-push-received/);
assert.match(appPage, /event.kind === "marketplace_message"/);
console.log('Notification reliability tests passed: partial inbox, preferences, iOS registration, logout, APNs payload, consent, retries and cold-start tap handoff.');
