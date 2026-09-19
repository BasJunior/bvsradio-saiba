import { NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type GrowthMember = {
  role: string;
  utm_source?: string | null;
  utm_campaign?: string | null;
  joined_at: string;
  activated_at?: string | null;
  first_return_at?: string | null;
  first_listen_at?: string | null;
  first_save_at?: string | null;
  first_follow_at?: string | null;
  first_post_at?: string | null;
  first_submission_at?: string | null;
  first_purchase_at?: string | null;
  last_active_at?: string | null;
};

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

async function staffUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !url || !anon || !service) return null;
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!userResponse?.ok) return null;
  const user = await userResponse.json().catch(() => ({})) as { id?: string; email?: string };
  if (!user.id) return null;

  const headers = { apikey: service, Authorization: `Bearer ${service}` };
  const [profileResponse, staffResponse] = await Promise.all([
    fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/editorial_staff?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=role&limit=1`, { headers, cache: "no-store" }),
  ]);
  const profile = profileResponse.ok ? (await profileResponse.json().catch(() => []))[0] : null;
  const staff = staffResponse.ok ? (await staffResponse.json().catch(() => []))[0] : null;
  const ownerEmail = String(process.env.BVS_PRIMARY_OWNER_EMAIL || "").trim().toLowerCase();
  const allowed = ["admin", "editor", "moderator"].includes(String(profile?.role || "").toLowerCase())
    || Boolean(staff?.role)
    || Boolean(ownerEmail && String(user.email || "").toLowerCase() === ownerEmail);
  return allowed ? user : null;
}

export async function GET(request: Request) {
  const staff = await staffUser(request);
  if (!staff) return NextResponse.json({ error: "Editorial or admin access required." }, { status: 403 });

  const requestUrl = new URL(request.url);
  const days = Math.min(180, Math.max(1, Number(requestUrl.searchParams.get("days") || 30) || 30));
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const headers = { apikey: service, Authorization: `Bearer ${service}` };
  const response = await fetch(
    `${url}/rest/v1/growth_members?joined_at=gte.${encodeURIComponent(cutoff)}&select=role,utm_source,utm_campaign,joined_at,activated_at,first_return_at,first_listen_at,first_save_at,first_follow_at,first_post_at,first_submission_at,first_purchase_at,last_active_at&order=joined_at.desc&limit=5000`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) return NextResponse.json({ error: "Growth cohort storage is not ready." }, { status: 503 });
  const members = await response.json().catch(() => []) as GrowthMember[];

  const totals = {
    signups: members.length,
    activated: members.filter((row) => row.activated_at).length,
    returned: members.filter((row) => row.first_return_at).length,
    listened: members.filter((row) => row.first_listen_at).length,
    saved: members.filter((row) => row.first_save_at).length,
    followed: members.filter((row) => row.first_follow_at).length,
    posted: members.filter((row) => row.first_post_at).length,
    submitted: members.filter((row) => row.first_submission_at).length,
    purchased: members.filter((row) => row.first_purchase_at).length,
  };

  const cohorts = new Map<string, {
    source: string;
    campaign: string;
    signups: number;
    activated: number;
    returned: number;
    submitted: number;
    purchased: number;
    roles: Record<string, number>;
  }>();

  for (const member of members) {
    const source = member.utm_source || "(direct/unknown)";
    const campaign = member.utm_campaign || "(none)";
    const key = `${source}::${campaign}`;
    const row = cohorts.get(key) || { source, campaign, signups: 0, activated: 0, returned: 0, submitted: 0, purchased: 0, roles: {} };
    row.signups += 1;
    if (member.activated_at) row.activated += 1;
    if (member.first_return_at) row.returned += 1;
    if (member.first_submission_at) row.submitted += 1;
    if (member.first_purchase_at) row.purchased += 1;
    row.roles[member.role || "listener"] = (row.roles[member.role || "listener"] || 0) + 1;
    cohorts.set(key, row);
  }

  const cohortRows = [...cohorts.values()]
    .map((row) => ({
      ...row,
      activationRate: percentage(row.activated, row.signups),
      returnRate: percentage(row.returned, row.signups),
      submissionRate: percentage(row.submitted, row.signups),
      purchaseRate: percentage(row.purchased, row.signups),
    }))
    .sort((a, b) => b.signups - a.signups || b.activated - a.activated);

  return NextResponse.json({
    days,
    generatedAt: new Date().toISOString(),
    totals: {
      ...totals,
      activationRate: percentage(totals.activated, totals.signups),
      returnRate: percentage(totals.returned, totals.signups),
      submissionRate: percentage(totals.submitted, totals.signups),
      purchaseRate: percentage(totals.purchased, totals.signups),
    },
    cohorts: cohortRows,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
