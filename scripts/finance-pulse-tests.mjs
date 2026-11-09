import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString("base64")}`);
const pulse = await load(read("src/lib/finance-pulse.ts"));
const now = new Date("2026-11-09T12:00:00Z");

for (const provider of ["manual_review_seed", "staff_benefit", "challenge_prize", "", null]) assert.equal(pulse.isPayingMembership({ provider, status: "active" }, now), false, `${provider} is not paying`);
assert.equal(pulse.isPayingMembership({ provider: "stripe", status: "active", ends_at: "2026-11-20T00:00:00Z" }, now), true);
assert.equal(pulse.isPayingMembership({ provider: "paynow", status: "active", ends_at: "2026-09-20T00:00:00Z" }, now), false, "a lapsed term stops counting");
assert.equal(pulse.isPayingMembership({ provider: "stripe", status: "cancelled" }, now), false);
assert.equal(pulse.membershipMonthlyUsd({ plan_id: "artist_founding", billing_interval: "month" }), 9);
assert.equal(pulse.membershipMonthlyUsd({ plan_id: "artist_standard", billing_interval: "year" }), 10);
assert.equal(pulse.membershipMonthlyUsd({ plan_id: "producer_pro", billing_interval: "month" }), 10);

assert.equal(pulse.orderItemLine("beat"), "beats");
assert.equal(pulse.orderItemLine("artist_premium"), "premium_sales");
assert.equal(pulse.orderItemLine("creator_service"), "services");
assert.equal(pulse.orderItemLine("single"), "music");

const line = { minVolume: 10 };
const bad = { minVolume: 5, lowerIsBetter: true };
assert.equal(pulse.classifyChange(0, 0, line), "quiet");
assert.equal(pulse.classifyChange(2, 1, line), "thin", "tiny numbers aren't called a trend");
assert.equal(pulse.classifyChange(20, 0, line), "new");
assert.equal(pulse.classifyChange(20, 10, line), "growing");
assert.equal(pulse.classifyChange(10, 20, line), "attention");
assert.equal(pulse.classifyChange(21, 20, line), "steady");
assert.equal(pulse.classifyChange(20, 10, bad), "attention", "more unfinished checkouts is bad");
assert.equal(pulse.classifyChange(10, 20, bad), "growing");
assert.equal(pulse.classifyChange(5, null, line), "all_time");

const streams = pulse.PULSE_LINES.find((row) => row.id === "streams");
const events = [["2026-11-09", 30, 0, "A"], ["2026-11-01", 40, 0, "B"], ["2026-10-31", 50, 0, "B"], ["2026-10-20", 10, 0, "C"], ["2026-09-01", 99, 0, "D"]];
const sum = pulse.summariseLine(streams, events, 30, "2026-11-09");
assert.equal(sum.current, 130, "the window includes today and 29 days before");
assert.equal(sum.top[0].label, "B");
assert.equal(sum.buckets.length, 30, "empty days stay on the chart");
assert.equal(sum.buckets.reduce((total, bucket) => total + bucket.value, 0), 130, "bars add up to the total");
const week = pulse.summariseLine(streams, events, 7, "2026-11-09");
assert.equal(week.current, 30);
assert.equal(week.previous, 90, "the previous period is the same length just before");
assert.equal(week.status, "attention");
assert.equal(pulse.summariseLine(streams, events, 90, "2026-11-09").buckets.reduce((total, bucket) => total + bucket.value, 0), 130 + 99 - 0, "weekly buckets keep every event");
const all = pulse.summariseLine(streams, events, "all", "2026-11-09");
assert.equal(all.current, 229);
assert.equal(all.previous, null);
assert.deepEqual(all.buckets.map((bucket) => bucket.key), ["2026-09", "2026-10", "2026-11"]);
const money = pulse.PULSE_LINES.find((row) => row.id === "beats");
assert.equal(pulse.summariseLine(money, [["2026-11-09", 1, 29.5, "Beat"]], 30, "2026-11-09").current, 29.5, "money lines add amounts");

const sums = pulse.PULSE_LINES.map((row) => pulse.summariseLine(row, row.id === "unfinished" ? [["2026-11-05", 9, 180, "Paynow"]] : row.id === "paid_orders" ? [["2026-11-05", 1, 4, "Paid"]] : [], 30, "2026-11-09"));
const notes = pulse.buildPulseNotes(sums, { payingMemberships: 1, monthlyRecurring: 9, nonPayingMemberships: 5, publicBeats: 150, publishedListings: 2, staffListens: 0, staffTestCheckouts: 0, staffPayingMemberships: 0, staffMonthlyRecurring: 0 }, "in the last 30 days");
assert.match(notes.attention[0].text, /9 of 10 checkouts were never paid, worth \$180/, "unfinished checkouts lead");
assert.match(notes.attention[1].text, /Only 1 paying customer on a plan, worth \$9/);
assert.ok(notes.attention.some((note) => /No beat licences sold in the last 30 days, with 150 beats/.test(note.text)));
assert.equal(pulse.formatPulseValue(1234.5, "money"), "$1,234.50");
assert.equal(pulse.formatPulseValue(1234, "count"), "1,234");

let identity = null;
let failSource = "";
let requests = [];
const orderRows = [
  { status: "paid", subtotal: 4, total: 4.76, payment_method: "card", created_at: "2026-11-02T10:00:00Z", items: [{ productType: "beat", title: "Beat One", price: 4, quantity: 1, customerEmail: "secret@example.com" }] },
  { status: "pending_payment", subtotal: 20, payment_method: "paynow", created_at: "2026-11-03T10:00:00Z", items: [] },
  { status: "pending_payment", subtotal: 99, payment_method: "paynow", created_at: "2026-11-03T10:00:00Z", items: [], customer_user_id: "staff-1", customer_email: "Tester@Example.com" },
  { status: "pending_payment", subtotal: 50, payment_method: "paynow", created_at: "2026-11-03T11:00:00Z", items: [], customer_email: "tester@example.com" },
  { status: "paid", subtotal: 4, payment_method: "card", created_at: "2026-11-02T10:00:00Z", items: [{ productType: "mix", title: "Test Mix", price: 4, quantity: 1 }], customer_email: "tester@example.com" },
  { status: "free_workspace", subtotal: 0, created_at: "2026-11-03T10:00:00Z", items: [] },
];
const manyStreams = [...Array.from({ length: 2500 }, (_, index) => ({ track_id: "t1", qualified_at: "2026-11-04T00:00:00Z", index })), { track_id: "t1", user_id: "staff-1", qualified_at: "2026-11-04T00:00:00Z" }];
globalThis.__pulse = { NextResponse: { json: (data, options) => Response.json(data, options) }, editorialIdentity: async () => identity, editorialUrl: (path) => `https://t.invalid/${path}`, serviceHeaders: {}, isPayingMembership: pulse.isPayingMembership, membershipMonthlyUsd: pulse.membershipMonthlyUsd, orderItemLine: pulse.orderItemLine };
const source = read("src/app/api/admin/editorial/finance/pulse/route.ts").replace(/import[\s\S]*?from\s+"[^"]+";/g, "");
const route = await load(`const {NextResponse,editorialIdentity,editorialUrl,serviceHeaders,isPayingMembership,membershipMonthlyUsd,orderItemLine}=globalThis.__pulse;\n${source}`);
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));
  requests.push({ url: String(input), method: options.method || "GET" });
  const table = url.pathname.slice(1);
  if (failSource === table) return new Response("{}", { status: 503 });
  const limit = Number(url.searchParams.get("limit"));
  const offset = Number(url.searchParams.get("offset"));
  const data = { orders: orderRows, stream_qualifications: manyStreams, editorial_staff: [{ user_id: "staff-1" }], tracks: [{ id: "t1", artist_name: "Artist" }], bvs_memberships: [{ plan_id: "artist_founding", billing_interval: "month", status: "active", provider: "stripe", starts_at: "2026-08-01T00:00:00Z" }, { plan_id: "producer_pro", status: "active", provider: "staff_benefit", starts_at: "2026-09-01T00:00:00Z" }, { user_id: "staff-1", plan_id: "artist_founding", billing_interval: "month", status: "active", provider: "stripe", starts_at: "2026-09-01T00:00:00Z" }], profiles: [{ role: "artist", created_at: "2026-11-01T00:00:00Z" }], beats: [{ genre: "trap", is_public: true, created_at: "2026-11-01T00:00:00Z" }] }[table] || [];
  return Response.json(data.slice(offset, offset + limit));
};
const get = () => route.GET(new Request("https://bvs.test/api"));
assert.equal((await get()).status, 403, "staff only");
assert.equal(requests.length, 0, "no data is read for non-staff");
identity = { user: { id: "s" } };
const body = await (await get()).json();
assert.equal(body.lines.streams.events[0][1], 2500, "every page of data is read, past the 1,000 row cap");
assert.equal(body.snapshot.payingMemberships, 1, "benefits don't count as paying");
assert.equal(body.snapshot.monthlyRecurring, 9);
assert.equal(body.snapshot.nonPayingMemberships, 1);
assert.equal(body.snapshot.staffListens, 1, "staff listening is left out");
assert.equal(body.snapshot.staffPayingMemberships, 1, "staff who pay aren't counted as customers");
assert.equal(body.snapshot.staffMonthlyRecurring, 9);
assert.equal(body.lines.memberships.events.reduce((sum, row) => sum + row[1], 0), 1, "the new-member trend is customers only");
assert.equal(body.lines.beats.events[0][2], 4);
assert.equal(body.lines.unfinished.events[0][3], "Paynow");
assert.equal(body.lines.unfinished.events.reduce((sum, row) => sum + row[1], 0), 1, "staff tests aren't customer checkouts, even as a guest");
assert.equal(body.lines.unfinished.events[0][2], 20);
assert.equal(body.snapshot.staffTestCheckouts, 2);
assert.equal(body.lines.paid_orders.events.reduce((sum, row) => sum + row[1], 0), 1, "the checkout rate uses customers only");
assert.equal(body.lines.music.events[0][2], 4, "money actually paid still counts as a sale");
assert.equal(JSON.stringify(body).toLowerCase().includes("tester@example.com"), false, "staff emails never reach the page");
assert.equal(JSON.stringify(body).includes("secret@example.com"), false, "customer details never reach the page");
assert.ok(requests.every((row) => row.method === "GET"), "the pulse never writes");
failSource = "profiles";
const partial = await (await get()).json();
assert.equal(partial.lines.signups.available, false, "a missing source is flagged, not shown as zero");
failSource = "orders";
assert.equal((await get()).status, 503, "orders failing never looks like no sales");

const finance = read("src/app/api/admin/editorial/finance/route.ts");
assert.equal((finance.match(/isPayingMembership\(row, now\)/g) || []).length, 2, "Finance counts only real payers");
assert.match(read("src/app/admin/editorial/finance/page.tsx"), /\/editorial\/finance\/pulse/);
console.log("Business pulse: real payers, trends, periods, notes, paging, privacy and staff access passed.");
