import { NextResponse } from "next/server";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Premium monthly price (USD). Override via env when business sets the fee. */
function premiumMonthlyUsd() {
  const n = Number(process.env.BVS_PREMIUM_MONTHLY_USD || "");
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=premium_active,premium_until,distribution_enabled,role,display_name,username`,
    { headers: serviceHeaders(SERVICE), cache: "no-store" },
  );
  const rows = res.ok ? await res.json() : [];
  const profile = rows[0] || {};

  return NextResponse.json({
    premiumActive: Boolean(profile.premium_active),
    premiumUntil: profile.premium_until || null,
    distributionEnabled: Boolean(profile.distribution_enabled),
    monthlyUsd: premiumMonthlyUsd(),
    priceNote:
      premiumMonthlyUsd() == null
        ? "Monthly price will be published when licence and distribution partner costs are confirmed."
        : `$${premiumMonthlyUsd()}/month (configurable).`,
    copy: {
      title: "BVS Premium Artist",
      summary:
        "Monthly subscription for multi-platform distribution when a BVS distribution partner is configured. BVS continuous rotation after editorial publish does not require premium.",
      includes: [
        "Eligibility for multi-platform distribution queue (partner TBD)",
        "Priority support for release packaging",
        "BVS catalogue + rotation still available on free artist path after approval",
      ],
    },
  });
}

/**
 * Toggle premium shell (manual / admin-style for now).
 * Real Stripe subscription can replace this when price is set.
 * Body: { enable: boolean, distributionEnabled?: boolean }
 */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const body = (await req.json()) as { enable?: boolean; distributionEnabled?: boolean };
  const enable = Boolean(body.enable);
  const distributionEnabled =
    body.distributionEnabled === undefined ? enable : Boolean(body.distributionEnabled);

  const premiumUntil = enable
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(SERVICE), Prefer: "return=representation" },
    body: JSON.stringify({
      premium_active: enable,
      premium_until: premiumUntil,
      distribution_enabled: enable && distributionEnabled,
      role: "artist",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("premium patch", res.status, text);
    return NextResponse.json(
      {
        error:
          text.includes("premium_active") || res.status === 400
            ? "Premium columns missing. Run supabase-releases-pipeline.sql in Supabase."
            : "Could not update premium status.",
      },
      { status: 500 },
    );
  }

  const rows = await res.json();
  return NextResponse.json({
    ok: true,
    profile: rows[0] || null,
    message: enable
      ? "Premium artist flag enabled (shell). Billing provider + price TBD."
      : "Premium artist flag disabled.",
  });
}
