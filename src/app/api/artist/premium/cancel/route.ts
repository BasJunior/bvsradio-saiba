import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import {
  cancelArtistPremium,
  listArtistDistributionJobs,
  premiumCancelConsequences,
} from "@/lib/premium-billing";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Cancel Artist Premium.
 * Body: { confirm: true, mode: 'period_end' | 'immediate' }
 * Without confirm:true, returns requireConfirm + consequences (no mutation).
 */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    confirm?: boolean;
  };
  const mode = body.mode === "immediate" ? "immediate" : "period_end";

  if (body.confirm !== true) {
    const jobs = await listArtistDistributionJobs(user.id);
    const consequences = premiumCancelConsequences(jobs);
    return NextResponse.json({
      requireConfirm: true,
      mode,
      consequences: {
        ...consequences,
        summary:
          mode === "immediate"
            ? consequences.immediate
            : consequences.period_end,
        modes: {
          period_end: consequences.period_end,
          immediate: consequences.immediate,
        },
      },
      message:
        "Confirm cancellation with { confirm: true, mode: 'period_end' | 'immediate' }. Review distribution consequences first.",
    });
  }

  const result = await cancelArtistPremium(user.id, mode);

  if (!result.ok) {
    return NextResponse.json(
      { error: "Could not cancel Premium. Try again or contact BVS." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    endsAt: result.endsAt,
    distribution: "distribution" in result ? result.distribution : undefined,
    consequences: result.consequences,
    message:
      mode === "immediate"
        ? "Artist Premium disabled immediately. Non-live distribution jobs were cancelled; live_on_dsp jobs were noted for partner policy."
        : `Cancellation recorded. Access continues until ${result.endsAt ? new Date(result.endsAt).toLocaleDateString() : "period end"}. Auto-renew is not active yet — you will not be charged again automatically. Distribution jobs are unchanged until the period ends.`,
  });
}
