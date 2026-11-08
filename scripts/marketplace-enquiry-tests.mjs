import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`);

const filter = await load(fs.readFileSync("src/lib/marketplace-contact-filter.ts", "utf8"));
const issue = (text) => filter.offPlatformContactIssue([text]);

for (const blocked of [
  "Call +263 00 000 0000",
  "my number is 0700000000",
  "write to seller@example.com",
  "find me @someone_cool",
  "whatsapp me",
  "wa.me/26300000",
  "DM me on IG",
  "I'm on instagram",
  "instagram.com/somebody",
  "Donate: https://paypal.me/somebody",
]) assert.ok(issue(blocked), `must block: ${blocked}`);

for (const allowed of [
  "Is it $200 for the exclusive?",
  "Can we book 2026-11-08 at 14:30?",
  "Beat is 140 BPM in A minor, 3 stems",
  "What's your vocal signal chain?",
  "Can you make an Instagram reel cut?",
  "Please send your email draft through BVS",
]) assert.equal(issue(allowed), null, `must allow: ${allowed}`);
assert.equal(filter.offPlatformContactIssue([undefined, null, 5, ""]), null, "non-text fields are ignored");

const buyer = "11111111-1111-4111-8111-111111111111";
const seller = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
const staff = "44444444-4444-4444-8444-444444444444";
const unapproved = "55555555-5555-4555-8555-555555555555";

let identity = null;
let failDb = false;
let enquiries = [];
let messages = [];
let writes = 0;

globalThis.__enquiryTest = {
  NextResponse: { json: (data, options) => Response.json(data, options) },
  creatorHeaders: {},
  creatorIdentity: async () => identity,
  creatorUrl: (path) => `https://test.invalid/${path}`,
  offPlatformContactIssue: filter.offPlatformContactIssue,
};

const routeSource = fs.readFileSync("src/app/api/marketplace/enquiries/route.ts", "utf8").replace(/import[\s\S]*?from\s+"[^"]+";/g, "");
const route = await load(`const {NextResponse,creatorHeaders,creatorIdentity,creatorUrl,offPlatformContactIssue}=globalThis.__enquiryTest;\n${routeSource}`);

const param = (url, name) => new URL(url).searchParams.get(name)?.replace(/^eq\./, "");

globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (failDb) return new Response("{}", { status: 404 });
  if (options.method === "POST") {
    writes += 1;
    const payload = JSON.parse(options.body);
    if (url.includes("marketplace_enquiries")) {
      let row = enquiries.find((item) => item.buyer_user_id === payload.buyer_user_id && item.seller_user_id === payload.seller_user_id);
      if (!row) {
        row = { id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(enquiries.length).padStart(12, "0")}`, ...payload, created_at: "2026-11-08T10:00:00Z", last_message_at: "2026-11-08T10:00:00Z" };
        enquiries.push(row);
      }
      return Response.json([row]);
    }
    const row = { id: `m${messages.length}`, created_at: "2026-11-08T10:01:00Z", ...payload };
    messages.push(row);
    return Response.json([row]);
  }
  if (url.includes("creator_marketplace_profiles")) return Response.json(param(url, "user_id") === seller ? [{ user_id: seller }] : []);
  if (url.includes("/profiles?")) return Response.json([
    { id: buyer, username: "buyer", display_name: "Buyer Name" },
    { id: seller, username: "seller", creator_public_name: "Seller Store" },
  ]);
  if (url.includes("marketplace_enquiry_messages")) return Response.json(messages.filter((row) => row.enquiry_id === param(url, "enquiry_id")));
  const id = param(url, "id");
  const buyerId = param(url, "buyer_user_id");
  const sellerId = param(url, "seller_user_id");
  if (id) return Response.json(enquiries.filter((row) => row.id === id));
  if (buyerId && sellerId) return Response.json(enquiries.filter((row) => row.buyer_user_id === buyerId && row.seller_user_id === sellerId));
  return Response.json(enquiries);
};

const as = (id, role = "listener") => { identity = id ? { user: { id }, profile: { role } } : null; };
const post = (body) => route.POST(new Request("https://bvs.test/api", { method: "POST", body: JSON.stringify(body) }));
const get = (query = "") => route.GET(new Request(`https://bvs.test/api${query}`));

as(null);
assert.equal((await post({ sellerUserId: seller, message: "Hi" })).status, 401, "sign-in is required to send");
assert.equal((await get()).status, 401, "sign-in is required to read");

as(buyer);
const blocked = await post({ sellerUserId: seller, message: "Call me on +263 00 000 0000" });
assert.equal(blocked.status, 400, "contact details are refused");
assert.match((await blocked.json()).error, /phone number/);
assert.equal(writes, 0, "refused messages are never stored");
assert.equal((await post({ sellerUserId: seller, message: "   " })).status, 400, "empty messages are refused");
assert.equal((await post({ sellerUserId: "nope", message: "Hi" })).status, 400, "invalid sellers are refused");
assert.equal((await post({ sellerUserId: unapproved, message: "Hi" })).status, 404, "unapproved sellers cannot be messaged");

as(seller);
assert.equal((await post({ sellerUserId: seller, message: "Hi" })).status, 400, "sellers cannot message themselves");
assert.equal(writes, 0, "rejected sends store nothing");

as(buyer);
const created = await post({ sellerUserId: seller, message: "Is the $200 beat exclusive?" });
assert.equal(created.status, 200, "a buyer can open an enquiry");
const createdBody = await created.json();
assert.equal(createdBody.messages.length, 1);
assert.equal(createdBody.messages[0].mine, true);
assert.equal(createdBody.enquiry.role, "buyer");
assert.equal(JSON.stringify(createdBody).includes(buyer), false, "user ids are not exposed");
const enquiryId = createdBody.enquiry.id;

await post({ sellerUserId: seller, message: "One more question" });
assert.equal(enquiries.length, 1, "a buyer and seller share one thread");

as(seller);
const replied = await (await post({ enquiryId, message: "Yes, full rights." })).json();
assert.equal(replied.messages.length, 3, "the seller can reply in the thread");
assert.equal(replied.enquiry.role, "seller");
assert.equal(replied.messages[0].authorName, "Buyer Name");

as(stranger);
assert.equal((await post({ enquiryId, message: "Let me in" })).status, 404, "strangers cannot post");
assert.equal((await get(`?id=${enquiryId}`)).status, 404, "strangers cannot read");
assert.equal((await get(`?seller=${seller}&buyer=${buyer}`)).status, 404, "only staff can look up someone else's thread");
assert.equal((await get("?scope=staff")).status, 403, "only staff can list every thread");

as(staff, "admin");
const staffView = await (await get(`?seller=${seller}&buyer=${buyer}`)).json();
assert.equal(staffView.messages.length, 3, "staff can find a thread for a dispute");
assert.equal(staffView.enquiry.role, "staff");
assert.equal((await post({ enquiryId, message: "Staff note" })).status, 404, "staff read threads but do not post as participants");

as(buyer);
const none = await (await get(`?seller=${stranger}`)).json();
assert.deepEqual(none, { enquiry: null, messages: [] }, "no thread yet is not an error");

failDb = true;
assert.equal((await post({ sellerUserId: seller, message: "Hi" })).status, 503, "database failures are reported");
assert.equal((await get()).status, 503, "database failures are reported on read");

const migration = fs.readFileSync("supabase/migrations/20261108190000_marketplace_buyer_enquiries.sql", "utf8");
assert.match(migration, /grant select, insert on table public\.marketplace_enquiry_messages to service_role/, "messages must stay append-only");
assert.doesNotMatch(migration, /grant[^;]*(update|delete)[^;]*marketplace_enquiry_messages/i, "messages cannot be edited or deleted");
assert.match(migration, /enquiry_id uuid not null references public\.marketplace_enquiries\(id\) on delete restrict/, "threads cannot be deleted while messages exist");

const notifications = fs.readFileSync("src/app/api/marketplace/messages/notifications/route.ts", "utf8");
assert.match(notifications, /a failure must not hide Editorial messages/, "enquiry failures must not break the Editorial inbox");
const sellerApi = fs.readFileSync("src/app/api/marketplace/route.ts", "utf8");
assert.match(sellerApi, /offPlatformContactIssue\(\[body\.headline, body\.bio/, "seller-written text must be checked");
const store = fs.readFileSync("src/app/marketplace/[slug]/page.tsx", "utf8");
assert.match(store, /provider\.sellerUserId \? <MarketplaceEnquiryPanel/, "only stores with a linked seller can be messaged");

console.log("Marketplace enquiries: contact filter, access rules, threads and staff review passed.");
