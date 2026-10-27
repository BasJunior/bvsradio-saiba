import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const webPage = read('src/app/notifications/page.tsx');
const appPage = read('src/components/app-vnext/AppNotificationsClient.tsx');

assert.doesNotMatch(
  webPage,
  /acknowledgeNotificationInbox/,
  'Web notifications must not acknowledge native app notifications as seen.',
);
assert.doesNotMatch(
  webPage,
  /\/api\/app\/participation\/notifications[^\n]*PATCH|method:\s*['"]PATCH['"][\s\S]{0,300}\/api\/app\/participation\/notifications/,
  'Web notifications must never PATCH participation read/seen state.',
);
assert.doesNotMatch(
  webPage,
  /read:\s*true|seen:\s*true/,
  'Web notification viewing must not clear app notification state.',
);
assert.match(
  appPage,
  /acknowledgeNotificationInbox/,
  'Native inbox must still acknowledge app notifications when the app inbox is viewed.',
);
assert.match(
  appPage,
  /\/api\/app\/participation\/notifications/,
  'Native inbox must retain the server-backed participation clear path.',
);
assert.match(
  appPage,
  /read:\s*true/,
  'Opening a participation notification in the native app must still clear its unread state.',
);

console.log('Notification surface separation passed: web views persist in app until cleared from the app.');
