/** Pure helpers for the staff Business Pulse. No secrets; safe in the browser and in tests. */

export type PulseEvent = [day: string, count: number, amount: number, label: string];
export type PulseUnit = "money" | "count";
export type PulseGroup = "money" | "creators" | "audience" | "hidden";
export type PulseStatus = "growing" | "steady" | "attention" | "quiet" | "thin" | "new" | "all_time";
export type PulsePeriod = 7 | 30 | 90 | "all";

export type PulseLine = {
  id: string;
  group: PulseGroup;
  label: string;
  unit: PulseUnit;
  minVolume: number;
  lowerIsBetter?: boolean;
  meaning: string;
  actHref: string;
  actLabel: string;
};

export const PULSE_LINES: PulseLine[] = [
  { id: "memberships", group: "money", label: "New paying memberships", unit: "count", minVolume: 5, meaning: "Customers who started paying through Stripe or Paynow. Staff accounts, benefits, prizes and seeded records are left out.", actHref: "/artist/premium", actLabel: "See the Premium offer" },
  { id: "premium_sales", group: "money", label: "Premium purchases", unit: "money", minVolume: 20, meaning: "One-off Premium payments made through checkout, before tax.", actHref: "/editorial/finance", actLabel: "Open Finance" },
  { id: "music", group: "money", label: "Music sales", unit: "money", minVolume: 20, meaning: "Singles, mixes and albums sold, before tax. BVS keeps only its commission.", actHref: "/editorial/catalogue", actLabel: "Open Catalogue" },
  { id: "beats", group: "money", label: "Beat licences", unit: "money", minVolume: 20, meaning: "Beat licences sold, before tax. BVS keeps only its commission.", actHref: "/editorial/marketplace", actLabel: "Open Marketplace" },
  { id: "products", group: "money", label: "Presets and products", unit: "money", minVolume: 20, meaning: "Digital products from creators, before tax. BVS keeps only its commission.", actHref: "/editorial/marketplace", actLabel: "Open Marketplace" },
  { id: "services", group: "money", label: "Studio and services", unit: "money", minVolume: 20, meaning: "Mix and master, studio and other services sold, before tax. BVS keeps only its commission.", actHref: "/editorial/marketplace", actLabel: "Open Marketplace" },
  { id: "unfinished", group: "money", label: "Unfinished checkouts", unit: "count", minVolume: 5, lowerIsBetter: true, meaning: "Customers who reached payment but never paid. Staff tests are left out. Older ones may be offline payments never marked as paid.", actHref: "/editorial/finance", actLabel: "Open Finance" },
  { id: "signups", group: "creators", label: "New accounts", unit: "count", minVolume: 10, meaning: "People who created a BVS account.", actHref: "/editorial", actLabel: "Open the Desk" },
  { id: "releases", group: "creators", label: "Releases submitted", unit: "count", minVolume: 5, meaning: "Releases sent in by artists. This is the supply that feeds Premium.", actHref: "/editorial", actLabel: "Open the review queue" },
  { id: "beat_uploads", group: "creators", label: "Beats uploaded", unit: "count", minVolume: 10, meaning: "New beats added to BeatStore.", actHref: "/editorial/catalogue", actLabel: "Open Catalogue" },
  { id: "listings", group: "creators", label: "Marketplace listings", unit: "count", minVolume: 5, meaning: "Services and products created by sellers, including drafts.", actHref: "/editorial/marketplace", actLabel: "Open Marketplace" },
  { id: "streams", group: "audience", label: "Qualified listens", unit: "count", minVolume: 50, meaning: "Plays of at least 30 seconds. These are measured only and earn nothing until an ad pot is funded.", actHref: "/editorial/catalogue", actLabel: "Open Catalogue" },
  { id: "newsletter", group: "audience", label: "Newsletter sign-ups", unit: "count", minVolume: 10, meaning: "People who opted in to the newsletter and are still subscribed.", actHref: "/editorial/newsletter", actLabel: "Open Newsletter" },
  { id: "paid_orders", group: "hidden", label: "Paid orders", unit: "count", minVolume: 5, meaning: "", actHref: "/editorial/finance", actLabel: "Open Finance" },
];

export const FINANCE_QUARTER_TARGETS = [
  { quarter: "Q3 2026", artists: null, gmv: null, newsletter: null, outcome: "Reconcile 100% of verified sales and establish the contribution baseline." },
  { quarter: "Q4 2026", artists: 25, gmv: 1000, newsletter: 150, outcome: "Three positive marketplace-contribution months." },
  { quarter: "Q1 2027", artists: 60, gmv: 2500, newsletter: 350, outcome: "Recurring contribution covers 60% of fixed OPEX." },
  { quarter: "Q2 2027", artists: 100, gmv: 5000, newsletter: 600, outcome: "Two positive free-cash-flow months." },
] as const;

type MembershipRow = { provider?: unknown; status?: unknown; ends_at?: unknown; plan_id?: unknown; billing_interval?: unknown };

/** Only real payment providers count. Seeded rows, staff benefits, prizes and lapsed terms don't. */
export function isPayingMembership(row: MembershipRow, now = new Date()) {
  if (!["stripe", "paynow"].includes(String(row.provider || "").toLowerCase())) return false;
  if (!["active", "trialing"].includes(String(row.status || "").toLowerCase())) return false;
  if (!row.ends_at) return true;
  return new Date(String(row.ends_at)).getTime() > now.getTime();
}

export function membershipMonthlyUsd(row: MembershipRow) {
  const plan = String(row.plan_id || "").toLowerCase();
  const annual = String(row.billing_interval || "").toLowerCase() === "year";
  const prices: Array<[string, number, number]> = [["founding", 9, 90], ["producer_plus", 5, 50], ["producer_pro", 10, 100], ["standard", 12, 120], ["artist", 12, 120]];
  const match = prices.find(([key]) => plan.includes(key));
  if (!match) return 0;
  return annual ? match[2] / 12 : match[1];
}

export function orderItemLine(productType: unknown) {
  const type = String(productType || "").toLowerCase();
  if (type.includes("premium")) return "premium_sales";
  if (type.includes("beat")) return "beats";
  if (["single", "mix", "album", "track"].includes(type)) return "music";
  if (type.includes("service") || type.includes("studio") || type.includes("booking")) return "services";
  return "products";
}

const DAY = 86400000;
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
export const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);
const eventValue = (event: PulseEvent, unit: PulseUnit) => (unit === "money" ? event[2] : event[1]);

export function classifyChange(current: number, previous: number | null, line: Pick<PulseLine, "minVolume" | "lowerIsBetter">): PulseStatus {
  if (previous === null) return "all_time";
  if (current === 0 && previous === 0) return "quiet";
  if (current + previous < line.minVolume) return "thin";
  if (previous === 0) return line.lowerIsBetter ? "attention" : "new";
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.15) return "steady";
  return change > 0 === Boolean(line.lowerIsBetter) ? "attention" : "growing";
}

export type PulseBucket = { key: string; label: string; value: number; count: number };

export function summariseLine(line: PulseLine, events: PulseEvent[], period: PulsePeriod, today: string) {
  const end = toTime(today);
  const start = period === "all" ? (events.length ? Math.min(...events.map((event) => toTime(event[0]))) : end) : end - (period - 1) * DAY;
  const inWindow = events.filter((event) => toTime(event[0]) >= start && toTime(event[0]) <= end);
  const current = inWindow.reduce((sum, event) => sum + eventValue(event, line.unit), 0);
  const count = inWindow.reduce((sum, event) => sum + event[1], 0);
  const amount = inWindow.reduce((sum, event) => sum + event[2], 0);
  let previous: number | null = null;
  if (period !== "all") {
    const before = start - period * DAY;
    previous = events.filter((event) => toTime(event[0]) >= before && toTime(event[0]) < start).reduce((sum, event) => sum + eventValue(event, line.unit), 0);
  }
  const labels = new Map<string, number>();
  for (const event of inWindow) labels.set(event[3], (labels.get(event[3]) || 0) + eventValue(event, line.unit));
  const top = [...labels.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  return { line, current, previous, count, amount, status: classifyChange(current, previous, line), changePct: previous ? Math.round(((current - previous) / previous) * 100) : null, top, buckets: buildBuckets(line, inWindow, start, end, period) };
}

export type PulseSummary = ReturnType<typeof summariseLine>;

function buildBuckets(line: PulseLine, events: PulseEvent[], start: number, end: number, period: PulsePeriod): PulseBucket[] {
  const buckets = new Map<string, PulseBucket>();
  const unit = period === "all" ? "month" : period === 90 ? "week" : "day";
  const keyFor = (time: number) => {
    if (unit === "month") return new Date(time).toISOString().slice(0, 7);
    if (unit === "day") return toDay(time);
    return toDay(end - Math.floor((end - time) / (7 * DAY)) * 7 * DAY);
  };
  const labelFor = (key: string) => new Date(unit === "month" ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`).toLocaleDateString("en-GB", unit === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
  for (let time = start; time <= end; time += DAY) {
    const key = keyFor(time);
    if (!buckets.has(key)) buckets.set(key, { key, label: unit === "week" ? `Week to ${labelFor(key)}` : labelFor(key), value: 0, count: 0 });
  }
  for (const event of events) {
    const bucket = buckets.get(keyFor(toTime(event[0])));
    if (!bucket) continue;
    bucket.value += eventValue(event, line.unit);
    bucket.count += event[1];
  }
  return [...buckets.values()];
}

export const formatPulseValue = (value: number, unit: PulseUnit) => (unit === "money" ? `$${value.toLocaleString("en-US", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : value.toLocaleString("en-US"));

export type PulseSnapshot = { payingMemberships: number; monthlyRecurring: number; nonPayingMemberships: number; publicBeats: number; publishedListings: number; staffTestCheckouts: number; staffPayingMemberships: number; staffMonthlyRecurring: number };
export type PulseNote = { lineId: string; text: string; weight: number };

/** Turns the numbers into a short ranked list staff can act on. */
export function buildPulseNotes(summaries: PulseSummary[], snapshot: PulseSnapshot, periodLabel: string) {
  const find = (id: string) => summaries.find((summary) => summary.line.id === id);
  const attention: PulseNote[] = [];
  const growing: PulseNote[] = [];
  const unfinished = find("unfinished");
  const paid = find("paid_orders");
  if (unfinished && unfinished.count > 0) {
    const started = unfinished.count + (paid?.count || 0);
    const worth = unfinished.amount ? `, worth ${formatPulseValue(unfinished.amount, "money")}` : "";
    if (started >= 3 && unfinished.count / started >= 0.5) attention.push({ lineId: "unfinished", weight: 100, text: `${unfinished.count} of ${started} checkouts were never paid${worth}, ${periodLabel}.` });
  }
  if (snapshot.payingMemberships === 0) attention.push({ lineId: "memberships", weight: 90, text: "No customers are on a paid plan yet." });
  else if (snapshot.payingMemberships < 5) attention.push({ lineId: "memberships", weight: 90, text: `Only ${snapshot.payingMemberships} paying ${snapshot.payingMemberships === 1 ? "customer" : "customers"} on a plan, worth ${formatPulseValue(snapshot.monthlyRecurring, "money")} a month.` });
  const beats = find("beats");
  if (beats && beats.current === 0 && snapshot.publicBeats > 0) attention.push({ lineId: "beats", weight: 80, text: `No beat licences sold ${periodLabel}, with ${snapshot.publicBeats} beats on sale.` });
  const products = find("products");
  const services = find("services");
  if (products && services && products.current + services.current === 0 && snapshot.publishedListings > 0) attention.push({ lineId: "services", weight: 70, text: `No marketplace products or services sold ${periodLabel}, with ${snapshot.publishedListings} listings live.` });
  for (const summary of summaries) {
    if (summary.line.group === "hidden" || summary.line.id === "unfinished") continue;
    const change = summary.changePct === null ? "" : ` (${summary.changePct > 0 ? "+" : ""}${summary.changePct}%)`;
    if (summary.status === "attention") attention.push({ lineId: summary.line.id, weight: 60, text: `${summary.line.label} fell to ${formatPulseValue(summary.current, summary.line.unit)}${change}.` });
    if (summary.status === "growing") growing.push({ lineId: summary.line.id, weight: summary.changePct || 0, text: `${summary.line.label} rose to ${formatPulseValue(summary.current, summary.line.unit)}${change}.` });
    if (summary.status === "new") growing.push({ lineId: summary.line.id, weight: 1, text: `${summary.line.label} started: ${formatPulseValue(summary.current, summary.line.unit)}.` });
  }
  return { attention: attention.sort((a, b) => b.weight - a.weight), growing: growing.sort((a, b) => b.weight - a.weight) };
}
