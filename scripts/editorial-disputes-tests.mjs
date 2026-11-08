import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`);
const strip = (path) => fs.readFileSync(path, "utf8").replace(/import[\s\S]*?from\s+"[^"]+";/g, "");

const csv = await load(fs.readFileSync("src/lib/csv.ts", "utf8"));
assert.equal(csv.csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)", "text formulas must be neutralised");
assert.equal(csv.csvCell("@SUM"), "'@SUM");
assert.equal(csv.csvCell(-4.5), "-4.5", "real negative numbers stay numeric");
assert.equal(csv.csvCell('say "hi", ok'), '"say ""hi"", ok"', "commas and quotes must be escaped");
assert.equal(csv.csvCell(null), "");

const buyer = "11111111-1111-4111-8111-111111111111";
const seller = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const parentOrder = "44444444-4444-4444-8444-444444444444";
const enquiryId = "55555555-5555-4555-8555-555555555555";
const order = { id: orderId, order_id: parentOrder, order_reference: "BVS-1", buyer_user_id: buyer, seller_user_id: seller, title_snapshot: "Mix", brief: "Please mix", amount_usd: 100, status: "disputed", revisions_used: 1, revisions_included: 2, created_at: "2026-11-08T10:00:00Z", updated_at: "2026-11-08T11:00:00Z" };

let identity = null;
let audits = [];
let writes = 0;
let failOrders = false;
let enquiriesMissing = false;
let requested = [];
const finance = ["founder", "administrator", "commerce_manager"];

globalThis.__disputes = {
  NextResponse: Object.assign(function (body, init) { return new Response(body, init); }, { json: (data, options) => Response.json(data, options) }),
  editorialIdentity: async () => identity,
  editorialUrl: (path) => `https://test.invalid/${path}`,
  serviceHeaders: {},
  can: (who, permission) => who.permissions.includes(permission),
  audit: async (actor, action, type, id, details) => { audits.push({ actor, action, type, id, details }); },
  csvDocument: csv.csvDocument,
};
const prelude = "const {NextResponse,editorialIdentity,editorialUrl,serviceHeaders,can,audit,csvDocument}=globalThis.__disputes;\n";
const disputes = await load(prelude + strip("src/app/api/admin/editorial/disputes/route.ts"));
const exporter = await load(prelude + strip("src/app/api/admin/editorial/finance/export/route.ts"));

globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  requested.push(url);
  if (options.method && options.method !== "GET") { writes += 1; return Response.json([]); }
  if (url.includes("creator_service_orders")) return failOrders ? new Response("{}", { status: 500 }) : Response.json(url.includes(`id=eq.${orderId}`) || !url.includes("id=eq.") ? [order] : []);
  if (url.includes("creator_service_order_events")) return Response.json([{ id: "e1", actor_user_id: buyer, event_type: "dispute", message: "Not delivered", file_path: "private/key.wav", created_at: "2026-11-08T12:00:00Z" }]);
  if (url.includes("commerce_seller_settlements")) {
    if (url.includes("offset=1000")) return Response.json([]);
    return Response.json([{ created_at: "2026-11-08", order_reference: "=BVS-1", seller_user_id: seller, provider: "paynow", seller_plan_id: "free", gross_product_revenue: 100, platform_fee_amount: 20, processor_fee_allocated: 3, processor_fee_status: "actual", seller_net: 77, settlement_status: "posted", policy_version: "v1", order_id: parentOrder }]);
  }
  if (url.includes("marketplace_enquiry_messages")) return Response.json([{ id: "m1", author_user_id: seller, body: "Yes, full rights", created_at: "2026-11-07T10:00:00Z" }]);
  if (url.includes("marketplace_enquiries")) return enquiriesMissing ? new Response("{}", { status: 404 }) : Response.json([{ id: enquiryId, buyer_user_id: buyer, seller_user_id: seller, last_message_at: "2026-11-07T10:00:00Z" }]);
  if (url.includes("/profiles?")) return Response.json([{ id: buyer, display_name: "Buyer Name" }, { id: seller, creator_public_name: "Seller Store" }]);
  return Response.json([]);
};

const get = (query = "") => disputes.GET(new Request(`https://bvs.test/api${query}`));
const staff = (permissions) => ({ user: { id: "99999999-9999-4999-8999-999999999999" }, permissions });
const financeStaff = staff(["manage_artist_wallet"]);

identity = null;
assert.equal((await get()).status, 403, "non-staff are refused");
assert.equal((await exporter.GET(new Request("https://bvs.test/x"))).status, 403, "non-staff cannot export");
identity = staff(["approve_submissions"]);
assert.equal((await get()).status, 403, "staff without finance access cannot read cases");
assert.equal((await exporter.GET(new Request("https://bvs.test/x"))).status, 403, "staff without finance access cannot export");
assert.equal(audits.length, 0, "refused requests are not recorded as views");

identity = financeStaff;
requested = [];
const list = await (await get()).json();
assert.match(requested.join(" "), /status=in\.\(disputed,cancel_requested\)/, "the default view is cases needing attention");
assert.equal(list.orders[0].buyerName, "Buyer Name");
assert.equal(JSON.stringify(list).includes(buyer), false, "user ids are not exposed");
assert.equal(audits.length, 0, "listing cases is not a case view");

const opened = await (await get(`?order=${orderId}`)).json();
assert.equal(audits.length, 1, "opening a case is audited");
assert.equal(audits[0].action, "marketplace_dispute_viewed");
assert.equal(opened.events[0].actorRole, "buyer");
assert.equal(opened.events[0].hasFile, true);
assert.equal(JSON.stringify(opened).includes("private/key.wav"), false, "private file paths are not exposed");
assert.equal(opened.enquiryMessages[0].authorRole, "seller", "the pre-sale thread joins the case");
assert.equal(opened.settlement.provider, "paynow");

audits = [];
const thread = await (await get(`?enquiry=${enquiryId}`)).json();
assert.equal(thread.messages.length, 1);
assert.equal(audits[0].action, "marketplace_enquiry_viewed", "opening an enquiry is audited");

assert.equal((await get("?order=nope")).status, 404, "invalid ids are refused");

enquiriesMissing = true;
const partial = await (await get(`?order=${orderId}`)).json();
assert.equal(partial.enquiryAvailable, false, "missing enquiries are reported, not shown as empty");
assert.equal((await (await get("?view=enquiries")).json()).available, false);
enquiriesMissing = false;

failOrders = true;
assert.equal((await get()).status, 503, "a failed load is an error, not an empty queue");
failOrders = false;

audits = [];
const exported = await exporter.GET(new Request("https://bvs.test/x"));
assert.equal(exported.status, 200);
assert.match(exported.headers.get("content-type"), /text\/csv/);
assert.equal(exported.headers.get("cache-control"), "no-store");
const body = await exported.text();
assert.match(body, /'=BVS-1/, "exported text cannot run as a formula");
assert.match(body, /Seller Store/);
assert.equal(body.includes(seller), false, "exports use names, not user ids");
assert.equal(audits[0].action, "finance_settlements_exported", "exports are audited");
assert.equal(audits[0].details.rows, 1);
assert.equal(writes, 0, "this desk does not write business data");

for (const role of finance) assert.ok(new RegExp(`${role}: \\[[^\\]]*manage_artist_wallet`).test(fs.readFileSync("src/lib/editorial.ts", "utf8")), `${role} needs finance access`);
const page = fs.readFileSync("src/app/editorial/disputes/page.tsx", "utf8");
assert.ok(page.indexOf('state === "error"') < page.indexOf("emptyText}"), "failed cases must not render as empty");
assert.match(fs.readFileSync("src/components/EditorialWorkspaceNav.tsx", "utf8"), /\/editorial\/disputes/, "Editorial needs a Disputes link");

console.log("Editorial disputes: staff access, audit trail, case history, failure states and CSV export passed.");
