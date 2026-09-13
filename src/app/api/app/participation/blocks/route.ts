import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  participationDelete,
  participationEnabled,
  participationInsert,
  participationReady,
  participationRows,
} from "@/lib/participation-server";

export async function GET(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ blockedUserIds: [] });
  const rows = await participationRows<{ blocked_user_id: string }>(
    `participation_blocks?blocker_user_id=eq.${encodeURIComponent(user.id)}&select=blocked_user_id&order=created_at.desc&limit=500`,
  );
  return NextResponse.json({ blockedUserIds: rows.map((row) => row.blocked_user_id) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { blockedUserId?: string };
  const blockedUserId = String(body.blockedUserId || "").trim();
  if (!blockedUserId || blockedUserId === user.id) return NextResponse.json({ error: "Invalid account." }, { status: 400 });
  const profile = await participationRows<{ id: string }>(`profiles?id=eq.${encodeURIComponent(blockedUserId)}&select=id&limit=1`);
  if (!profile[0]) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const saved = await participationInsert<{ blocked_user_id: string }>(
    "participation_blocks?on_conflict=blocker_user_id,blocked_user_id",
    { blocker_user_id: user.id, blocked_user_id: blockedUserId, created_at: new Date().toISOString() },
    "resolution=ignore-duplicates,return=representation",
  );
  if (!saved[0]) {
    const existing = await participationRows<{ blocked_user_id: string }>(
      `participation_blocks?blocker_user_id=eq.${encodeURIComponent(user.id)}&blocked_user_id=eq.${encodeURIComponent(blockedUserId)}&select=blocked_user_id&limit=1`,
    );
    if (!existing[0]) return NextResponse.json({ error: "Could not block this account." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, blocked: true });
}

export async function DELETE(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const blockedUserId = String(new URL(request.url).searchParams.get("userId") || "").trim();
  if (!blockedUserId) return NextResponse.json({ error: "Missing account." }, { status: 400 });
  const ok = await participationDelete(
    `participation_blocks?blocker_user_id=eq.${encodeURIComponent(user.id)}&blocked_user_id=eq.${encodeURIComponent(blockedUserId)}`,
  );
  return ok ? NextResponse.json({ ok: true, blocked: false }) : NextResponse.json({ error: "Could not unblock this account." }, { status: 503 });
}
