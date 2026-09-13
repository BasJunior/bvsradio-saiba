import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  participationEnabled,
  participationVisibleThread,
  participationRequestSurface,
  participationInsert,
  participationReady,
  participationRows,
} from "@/lib/participation-server";

type SubscriptionRow = {
  user_id: string;
  thread_id: string;
  watch_all_replies: boolean;
  muted_at?: string | null;
  updated_at: string;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ watchAllReplies: false, muted: false });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ watchAllReplies: false, muted: false });
  const threadId = String((await params).id || "").trim();
  const rows = await participationRows<SubscriptionRow>(
    `participation_thread_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&thread_id=eq.${encodeURIComponent(threadId)}&select=user_id,thread_id,watch_all_replies,muted_at,updated_at&limit=1`,
  );
  return NextResponse.json({ watchAllReplies: Boolean(rows[0]?.watch_all_replies), muted: Boolean(rows[0]?.muted_at) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const threadId = String((await params).id || "").trim();
  if (!await participationVisibleThread(threadId, user.id, participationRequestSurface(request))) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const threads = await participationRows<{ id: string }>(
    `participation_threads?id=eq.${encodeURIComponent(threadId)}&status=in.(published,locked)&select=id&limit=1`,
  );
  if (!threads[0]) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { watchAllReplies?: boolean; muted?: boolean };
  const row = {
    user_id: user.id,
    thread_id: threadId,
    watch_all_replies: body.muted ? false : Boolean(body.watchAllReplies),
    muted_at: body.muted ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const saved = await participationInsert<SubscriptionRow>(
    "participation_thread_subscriptions?on_conflict=user_id,thread_id",
    row,
    "resolution=merge-duplicates,return=representation",
  );
  if (!saved[0]) return NextResponse.json({ error: "Could not update this conversation setting." }, { status: 503 });
  return NextResponse.json({ ok: true, watchAllReplies: saved[0].watch_all_replies, muted: Boolean(saved[0].muted_at) });
}
