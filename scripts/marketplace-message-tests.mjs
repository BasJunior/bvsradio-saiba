import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const editorialPage = fs.readFileSync('src/app/editorial/marketplace/page.tsx', 'utf8');
const editorialApi = fs.readFileSync('src/app/api/admin/editorial/marketplace/route.ts', 'utf8');
const notificationsPage = fs.readFileSync('src/app/notifications/page.tsx', 'utf8');
const marketplaceInbox = fs.readFileSync('src/app/api/marketplace/messages/notifications/route.ts', 'utf8');
const navbar = fs.readFileSync('src/components/layout/Navbar.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260914164500_creator_marketplace_review_messages.sql', 'utf8');

assert.match(editorialPage, /Send message/, 'Editorial Marketplace needs an explicit send-message action');
assert.match(editorialPage, /decision === "send_message"/, 'message send must not depend on a moderation status transition');
assert.match(editorialPage, /Conversation/, 'Editorial must show the Marketplace conversation history');
assert.match(editorialApi, /creator_marketplace_review_messages/, 'Editorial messages must persist in a dedicated conversation table');
assert.match(editorialApi, /creator_marketplace_profile_message_sent/, 'profile messages must be audited');
assert.match(editorialApi, /creator_marketplace_listing_message_sent/, 'listing messages must be audited');
assert.match(notificationsPage, /Reply to Editorial/, 'creators need a reply control in Notifications');
assert.match(notificationsPage, /\/api\/marketplace\/messages/, 'creator replies must use the authenticated Marketplace message endpoint');
assert.match(marketplaceInbox, /author_kind=eq\.editor/, 'creator inbox must only surface Editorial-authored Marketplace messages');
assert.match(navbar, /\/api\/marketplace\/messages\/notifications/, 'notification badge must count new Marketplace Editorial messages');
assert.match(navbar, /operationalUnread \+ marketplaceUnread/, 'Marketplace messages must contribute to the unread badge total');
assert.match(migration, /author_kind text not null check \(author_kind in \('editor', 'creator'\)\)/, 'message table must distinguish Editorial and creator authors');
assert.match(migration, /auth\.uid\(\) = seller_user_id/, 'Marketplace message RLS must scope reads to the seller');

const uid = '11111111-1111-4111-8111-111111111111';
const listingId = '22222222-2222-4222-8222-222222222222';
const foreignId = '33333333-3333-4333-8333-333333333333';
let writes = [];

globalThis.__marketplaceMessageTest = {
  NextResponse: { json: (data, options) => Response.json(data, options) },
  creatorHeaders: {},
  creatorIdentity: async () => ({ user: { id: uid }, profile: { username: 'seller' } }),
  creatorUrl: path => `https://test.invalid/${path}`,
};

let source = fs.readFileSync('src/app/api/marketplace/messages/route.ts', 'utf8')
  .replace(/import[\s\S]*?from\s+"[^"]+";/g, '');
source = 'const {NextResponse,creatorHeaders,creatorIdentity,creatorUrl}=globalThis.__marketplaceMessageTest;\n' + source;
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { POST } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

globalThis.fetch = async (url, options = {}) => {
  if (String(url).includes('creator_marketplace_listings')) {
    return Response.json(String(url).includes(listingId) ? [{ id: listingId }] : []);
  }
  if (String(url).includes('creator_marketplace_profiles')) return Response.json([{ user_id: uid }]);
  if (String(url).includes('creator_marketplace_review_messages') && options.method === 'POST') {
    const payload = JSON.parse(options.body);
    writes.push(payload);
    return Response.json([{ id: '44444444-4444-4444-8444-444444444444', ...payload }]);
  }
  return Response.json([], { status: 404 });
};

const post = body => POST(new Request('https://test.invalid/api/marketplace/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}));

let response = await post({ entity: 'listing', entityId: listingId, message: 'Please clarify the licence.' });
assert.equal(response.status, 200);
assert.equal(writes.at(-1).seller_user_id, uid);
assert.equal(writes.at(-1).author_kind, 'creator');
assert.equal(writes.at(-1).entity_type, 'listing');
assert.equal(writes.at(-1).entity_id, listingId);

response = await post({ entity: 'listing', entityId: foreignId, message: 'Trying another seller listing.' });
assert.equal(response.status, 404, 'creators cannot reply on another seller listing thread');

response = await post({ entity: 'profile', entityId: uid, message: 'Here is the requested profile clarification.' });
assert.equal(response.status, 200);
assert.equal(writes.at(-1).entity_type, 'profile');

response = await post({ entity: 'profile', entityId: uid, message: '   ' });
assert.equal(response.status, 400, 'blank Marketplace replies must be rejected');

console.log('Marketplace messaging tests passed: explicit Editorial send, seller-scoped creator reply, inbox, unread badge and RLS contract.');
