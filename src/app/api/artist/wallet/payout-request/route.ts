import { NextResponse } from "next/server";
import { payoutErrorMessage } from "@/lib/artist-payouts";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function currentUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !url || !anon) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<{ id: string }>;
}

export async function POST(request: Request) {
  // Financial writes are opt-in even in beta. This keeps Flow v2 UI work from
  // accidentally enabling a payout programme merely because the endpoint was
  // merged. Enable only in an explicitly approved staging/production lane.
  if (process.env.BVS_ARTIST_PAYOUT_REQUESTS_ENABLED !== "1") {
    return NextResponse.json({ error: "Artist payout requests are not enabled." }, { status: 503 });
  }

  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to request a payout." }, { status: 401 });
  if (!service) return NextResponse.json({ error: "Payout requests are not configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const requested = body.amount == null || body.amount === "" ? null : Number(body.amount);
  if (requested != null && (!Number.isFinite(requested) || requested <= 0)) {
    return NextResponse.json({ error: "Enter a valid payout amount." }, { status: 400 });
  }
  const methodId = typeof body.payoutMethodId === "string" && /^[0-9a-f-]{36}$/i.test(body.payoutMethodId)
    ? body.payoutMethodId
    : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const response = await fetch(`${url}/rest/v1/rpc/request_artist_payout`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_artist_user_id: user.id,
      p_requested_amount: requested,
      p_payout_method_id: methodId,
      p_artist_note: note,
    }),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    console.error("payout request failed", response.status, text.slice(0, 300));
    return NextResponse.json({ error: payoutErrorMessage(text) }, { status: response.status === 404 ? 503 : 409 });
  }
  const payoutRequest = text ? JSON.parse(text) : null;
  return NextResponse.json({ ok: true, payoutRequest }, { status: 201 });
}
