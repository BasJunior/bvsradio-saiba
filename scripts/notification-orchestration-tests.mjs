import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/notification-orchestration.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Map, Set });
const { rankNotifications: rank, orchestrationPreferences: prefs } = exports;
const now = Date.parse('2026-10-12T12:00:00Z');
const stamp = ms => new Date(now + ms).toISOString();
const candidate = { id: 'new-release', category: 'new_music', eventType: 'release_published', entityKey: 'track:1', equivalentKey: 'release:1', deepLink: '/song/1', createdAt: stamp(-60000), expiresAt: stamp(86400000), importance: 60, urgency: 1, operational: false, eligible: true, actionCompleted: false, seen: false };
const context = { preferences: { new_music: true, live_shows: true, creator_updates: true }, pushAllowed: true, quiet: false, holdout: false, affinities: { new_music: 1 }, contacts: [] };
const decide = (c = {}, x = {}) => rank([{ ...candidate, ...c }], { ...context, ...x }, now)[0];
assert.equal(decide().action, 'push');
for (const [c, x, reason] of [
  [{ eligible: false }, {}, 'not_eligible'], [{}, { preferences: {} }, 'category_disabled'],
  [{}, { pushAllowed: false }, 'push_unavailable'], [{ deepLink: '//evil.test/a' }, {}, 'missing_exact_destination'],
  [{ deepLink: '/start' }, {}, 'missing_exact_destination'], [{ expiresAt: 'invalid' }, {}, 'expired_or_invalid_time'],
  [{ createdAt: stamp(5000) }, {}, 'expired_or_invalid_time'], [{ expiresAt: stamp(0) }, {}, 'expired_or_invalid_time'],
  [{ seen: true }, {}, 'already_handled'], [{ actionCompleted: true }, {}, 'already_handled'],
  [{ eventType: 'live_started' }, {}, 'live_signal_unconfirmed'],
  [{ eventType: 'live_started', liveSignalAt: stamp(-91000) }, {}, 'live_signal_unconfirmed'],
  [{}, { activeEntityKey: 'track:1', activeAt: stamp(-1000) }, 'already_at_destination'],
  [{}, { quiet: true }, 'quiet_hours'], [{}, { holdout: true }, 'holdout'],
]) assert.equal(decide(c, x).reason, reason);
assert.equal(decide({ eventType: 'live_started', liveSignalAt: stamp(-1000) }).action, 'push');
const contact = (id, hours, extra = {}) => ({ notificationId: id, category: 'new_music', equivalentKey: id, sentAt: stamp(-hours * 3600000), operational: false, ...extra });
assert.equal(decide({}, { contacts: [contact('x', 5, { equivalentKey: 'release:1' })] }).reason, 'equivalent_recently_sent');
assert.equal(decide({}, { contacts: [contact('new-release', 5)] }).reason, 'already_contacted');
assert.equal(decide({}, { contacts: [contact('x', 5), contact('y', 10)] }).reason, 'frequency_cap');
assert.equal(decide({}, { contacts: [contact('x', 5), contact('x', 5)] }).action, 'push', 'multiple devices count once');
assert.equal(decide({}, { contacts: [contact('x', 1)] }).reason, 'contact_cooldown');
assert.equal(decide({ operational: true }, { holdout: true, contacts: [contact('x', 1), contact('y', 2)] }).action, 'push');
assert.equal(decide({ operational: true }, { preferences: {} }).reason, 'category_disabled', 'operational never overrides consent');
const many = [24, 25, 26, 27].map((h, i) => contact(String(i), h));
assert.ok(decide({}, { contacts: many }).score < decide().score, 'unopened category reduces rank');
const ranked = rank([candidate, { ...candidate, id: 'approval', category: 'creator_updates', operational: true }], context, now);
assert.equal(ranked[0].id, 'approval');
assert.equal(ranked[1].reason, 'higher_value_candidate');
assert.equal(prefs({ releases: false }, { followed_artists: true }).followed_artists, false);
assert.equal(prefs({ marketing: true }, { offers: false }).offers, false);
assert.equal(prefs({}).community, false);
console.log('Notification orchestration behavioral gates passed.');

// Execute real server adapter with controlled I/O. Shadow must never call a sender.
const load = (path, imports, globals = {}) => {
  const result = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: result, require: name => name === 'server-only' ? {} : imports[name] || (() => { throw Error(`Unexpected dependency ${name}`); })(),
    Date, Map, Set, console, ...globals,
  });
  return result;
};
let calls = 0, persisted = [], consent = true, broken = false;
const original = { id: 'notice-1', recipient_user_id: 'user-1', category: 'mention', target_href: '/participation/thread/abc', created_at: new Date(Date.now() - 60000).toISOString(), thread_id: 'abc', message_id: null, event_id: 'event-1', seen_at: null, read_at: null };
const env = {};
const shadow = load('src/lib/notification-orchestration-server.ts', {
  '@/lib/notification-orchestration': exports,
  '@/lib/participation-delivery-policy': { notificationHref: () => '/feed/abc', notificationEligible: async () => true, quietNow: () => false },
  '@/lib/participation-server': {
    participationRows: async path => {
      calls++;
      if (broken) throw Error('database unavailable');
      if (path.startsWith('participation_notifications?created_at')) return [original];
      if (path.startsWith('participation_preferences?')) return [{ external_community_enabled: consent, timezone: 'UTC' }];
      if (path.startsWith('app_push_devices?')) return [{ platform: 'ios' }];
      return [];
    },
    participationInsert: async (table, rows) => { assert.ok(table.startsWith('notification_decisions?')); persisted = rows; return []; },
    participationRpc: async () => {},
  },
}, { process: { env } });
assert.equal((await shadow.evaluateNotificationShadow()).enabled, false);
assert.equal(calls, 0, 'disabled means no data reads or writes');
env.BVS_NOTIFICATION_ORCHESTRATION = 'shadow';
assert.equal((await shadow.evaluateNotificationShadow()).evaluated, 1);
assert.equal(persisted[0].action, 'push');
assert.equal(persisted[0].mode, 'shadow');
consent = false;
await shadow.evaluateNotificationShadow();
assert.equal(persisted[0].reason, 'category_disabled', 'durable community consent remains authoritative');
broken = true;
await assert.rejects(shadow.evaluateNotificationShadow(), /database unavailable/);
console.log('Shadow adapter checks passed: disabled isolation, durable decisions, consent, truthful storage failure.');
const link = load('src/lib/notification-push-link.ts', {}, { URL });
const id = '12345678-1234-1234-1234-123456789abc';
const pushHref = link.notificationPushHref('/app/ios/feed/abc?view=replies#reply-123', id);
assert.ok(pushHref.includes(`bvs_notice=${id}`));
const tap = link.notificationPushAction(pushHref);
assert.equal(tap.notificationId, id, 'build 17 href-only bridge retains attribution');
assert.equal(tap.href, '/app/ios/feed/abc?view=replies#reply-123', 'strip tracking without changing destination or anchor');
assert.equal(link.notificationPushAction('/feed/abc?bvs_notice=invalid').notificationId, null);
assert.equal(decide({}, { contacts: [contact('same', 1), contact('same', 25)] }).reason, 'contact_cooldown', 'newest device send must win regardless of ordering');
const { createNotificationInteractionQueue } = load('src/lib/notification-interaction-queue.ts', {}, { fetch, AbortSignal });
let access = '', attempts = 0, fail = true;
const q = createNotificationInteractionQueue(() => access, async () => { attempts++; return { status: fail ? 503 : 204 }; });
q.add(id, 'notification_opened');
await q.flush();
assert.equal(attempts, 0, 'cold login waits for auth');
access = 'token';
await q.flush();
assert.equal(attempts, 1);
fail = false;
await q.flush();
assert.equal(attempts, 2, 'transient failures retry');
await q.flush();
assert.equal(attempts, 2, 'success dequeues');
q.add(id, 'deeplink_opened'); q.clear(); await q.flush();
assert.equal(attempts, 2, 'account switch clears pending interaction');
console.log('Build 17 link correlation and bounded interaction retries passed.');
