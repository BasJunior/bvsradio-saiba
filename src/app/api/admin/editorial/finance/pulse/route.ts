import { NextResponse } from "next/server";
import { editorialIdentity, editorialUrl, serviceHeaders } from "@/lib/editorial-server";
import { isPayingMembership, membershipMonthlyUsd, orderItemLine, type PulseEvent, type PulseSnapshot } from "@/lib/finance-pulse";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
const PAGE = 1000;
const MAX_ROWS = 50000;

/** The database returns at most one page per request, so every source is read to the end. */
async function allRows(path: string) {
  const rows: Row[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const response = await fetch(editorialUrl(`${path}&limit=${PAGE}&offset=${offset}`), { headers: serviceHeaders, cache: "no-store" });
    if (!response.ok) throw new Error(`pulse source ${response.status}`);
    const page = (await response.json()) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function optionalRows(path: string) {
  try {
    return { rows: await allRows(path), available: true };
  } catch {
    return { rows: [] as Row[], available: false };
  }
}

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};
const day = (value: unknown) => String(value || "").slice(0, 10);
const round = (value: number) => Math.round(value * 100) / 100;
const titleCase = (value: unknown, fallback: string) => {
  const text = String(value || "").replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : fallback;
};
const PAYMENT_LABELS: Record<string, string> = { card: "Card", card_pending: "Card", paynow: "Paynow", ecocash: "EcoCash", mobile_money: "Mobile money", paypal: "PayPal", manual_bank: "Bank transfer", whatsapp: "WhatsApp" };

function collector() {
  const lines = new Map<string, Map<string, PulseEvent>>();
  return {
    add(line: string, when: unknown, label: string, amount = 0) {
      const date = day(when);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (!lines.has(line)) lines.set(line, new Map());
      const bucket = lines.get(line)!;
      const key = `${date}|${label}`;
      const row = bucket.get(key) || [date, 0, 0, label];
      row[1] += 1;
      row[2] = round(row[2] + amount);
      bucket.set(key, row);
    },
    events(line: string) {
      return [...(lines.get(line)?.values() || [])].sort((a, b) => a[0].localeCompare(b[0]));
    },
  };
}

function addOrder(events: ReturnType<typeof collector>, order: Row, staffTest: boolean) {
  const status = String(order.status || "");
  const value = money(order.subtotal ?? order.total);
  if (status === "pending_payment") {
    if (staffTest) return;
    const method = String(order.payment_method || "");
    events.add("unfinished", order.created_at, PAYMENT_LABELS[method] || "Other", value);
    return;
  }
  if (!["paid", "fulfilled"].includes(status)) return;
  if (!staffTest) events.add("paid_orders", order.created_at, "Paid", value);
  const items = (Array.isArray(order.items) ? order.items : []) as Row[];
  const priced = items.map((item) => ({ item, amount: money(item.price ?? item.unitAmount ?? item.unit_amount) * Math.max(1, money(item.quantity) || 1) }));
  const total = priced.reduce((sum, row) => sum + row.amount, 0);
  if (!priced.length) { events.add("products", order.created_at, "Unlabelled order", value); return; }
  priced.forEach(({ item, amount }, index) => {
    const type = item.productType ?? item.product_type ?? item.type;
    const label = String(item.title || item.name || titleCase(type, "Item")).slice(0, 80);
    events.add(orderItemLine(type), order.created_at, label, total > 0 ? amount : index === 0 ? value : 0);
  });
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return NextResponse.json({ error: "Active Editorial staff access is required." }, { status: 403 });

  try {
    const now = new Date();
    const orders = await allRows("orders?select=status,subtotal,total,payment_method,items,created_at,customer_email,customer_user_id&order=created_at.asc");
    const [staff, memberships, streams, tracks, profiles, releases, beats, listings, newsletter] = await Promise.all([
      optionalRows("editorial_staff?select=user_id&order=user_id.asc"),
      optionalRows("bvs_memberships?select=user_id,plan_id,billing_interval,status,provider,starts_at,ends_at,created_at&order=created_at.asc"),
      optionalRows("stream_qualifications?select=track_id,source,qualified_at&order=qualified_at.asc"),
      optionalRows("tracks?select=id,artist_name&order=created_at.asc"),
      optionalRows("profiles?select=role,created_at&order=created_at.asc"),
      optionalRows("releases?select=artist_name,created_at&order=created_at.asc"),
      optionalRows("beats?select=genre,is_public,created_at&order=created_at.asc"),
      optionalRows("creator_marketplace_listings?select=listing_type,status,created_at&order=created_at.asc"),
      optionalRows("newsletter_subscribers?is_active=eq.true&select=subscribed_at&order=subscribed_at.asc"),
    ]);

    const events = collector();
    // Staff try checkout while testing, sometimes as a guest with the same email. Those aren't customers.
    const staffIds = new Set(staff.rows.map((row) => String(row.user_id)));
    const staffEmails = new Set(orders.filter((order) => staffIds.has(String(order.customer_user_id))).map((order) => String(order.customer_email || "").toLowerCase()).filter(Boolean));
    const isStaffOrder = (order: Row) => staffIds.has(String(order.customer_user_id)) || staffEmails.has(String(order.customer_email || "").toLowerCase());
    orders.forEach((order) => addOrder(events, order, isStaffOrder(order)));
    const isStaffMember = (row: Row) => staffIds.has(String(row.user_id));
    const paying = memberships.rows.filter((row) => isPayingMembership(row, now) && !isStaffMember(row));
    const staffPaying = memberships.rows.filter((row) => isPayingMembership(row, now) && isStaffMember(row));
    memberships.rows.filter((row) => ["stripe", "paynow"].includes(String(row.provider || "").toLowerCase()) && !isStaffMember(row)).forEach((row) => events.add("memberships", row.starts_at || row.created_at, titleCase(row.plan_id, "Plan"), membershipMonthlyUsd(row)));
    const artistByTrack = new Map(tracks.rows.map((row) => [String(row.id), String(row.artist_name || "Unknown artist")]));
    streams.rows.forEach((row) => events.add("streams", row.qualified_at, artistByTrack.get(String(row.track_id)) || "Unknown artist"));
    profiles.rows.forEach((row) => events.add("signups", row.created_at, titleCase(row.role, "Listener")));
    releases.rows.forEach((row) => events.add("releases", row.created_at, String(row.artist_name || "Unknown artist")));
    beats.rows.forEach((row) => events.add("beat_uploads", row.created_at, titleCase(row.genre, "No genre")));
    listings.rows.forEach((row) => events.add("listings", row.created_at, titleCase(row.listing_type, "Listing")));
    newsletter.rows.forEach((row) => events.add("newsletter", row.subscribed_at, "Subscribed"));

    const snapshot: PulseSnapshot = {
      payingMemberships: paying.length,
      monthlyRecurring: round(paying.reduce((sum, row) => sum + membershipMonthlyUsd(row), 0)),
      nonPayingMemberships: memberships.rows.filter((row) => !["stripe", "paynow"].includes(String(row.provider || "").toLowerCase())).length,
      publicBeats: beats.rows.filter((row) => row.is_public === true).length,
      publishedListings: listings.rows.filter((row) => row.status === "published").length,
      staffPayingMemberships: staffPaying.length,
      staffMonthlyRecurring: round(staffPaying.reduce((sum, row) => sum + membershipMonthlyUsd(row), 0)),
      staffTestCheckouts: orders.filter((order) => order.status === "pending_payment" && isStaffOrder(order)).length,
    };

    const available: Record<string, boolean> = { memberships: memberships.available, streams: streams.available, signups: profiles.available, releases: releases.available, beat_uploads: beats.available, listings: listings.available, newsletter: newsletter.available };
    const ids = ["memberships", "premium_sales", "music", "beats", "products", "services", "unfinished", "paid_orders", "signups", "releases", "beat_uploads", "listings", "streams", "newsletter"];
    return NextResponse.json({
      generatedAt: now.toISOString(),
      today: now.toISOString().slice(0, 10),
      quarter: `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}`,
      snapshot,
      lines: Object.fromEntries(ids.map((id) => [id, { available: available[id] !== false, events: events.events(id) }])),
    });
  } catch (error) {
    console.error("Business pulse failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The business pulse could not load. Nothing has been changed." }, { status: 503 });
  }
}
