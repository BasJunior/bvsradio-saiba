import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import { withParticipationErrors } from "@/lib/participation-route";
import {
  blockedPair, checkParticipationRateLimit, participationEnabled,
  participationReady, participationRequestSurface, participationRows,
  participationRpc, participationVisibleThread,
} from "@/lib/participation-server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  return withParticipationErrors(async () => {
    if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const user = await requireAppUser(request);
    if (!user) return NextResponse.json({ error: "Sign in to like comments." }, { status: 401 });
    if (!user.emailConfirmedAt || (user.bannedUntil && Date.parse(user.bannedUntil) > Date.now())) {
      return NextResponse.json({ error: "A confirmed, active account is required." }, { status: 403 });
    }
    if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
    const { id: threadId, messageId } = await params;
    const body = await request.json().catch(() => ({})) as { active?: unknown };
    if (!uuid.test(threadId) || !uuid.test(messageId) || typeof body.active !== "boolean") {
      return NextResponse.json({ error: "Choose a valid comment and like state." }, { status: 400 });
    }
    const thread = await participationVisibleThread(threadId, user.id, participationRequestSurface(request));
    if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const message = (await participationRows<{ id: string; author_user_id: string | null }>(
      `participation_messages?id=eq.${messageId}&thread_id=eq.${threadId}&message_kind=in.(comment,reply)&status=eq.published&select=id,author_user_id&limit=1`,
    ))[0];
    if (!message || (message.author_user_id && await blockedPair(user.id, message.author_user_id))) {
      return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    }
    const rate = await checkParticipationRateLimit(request, user.id, "reaction");
    if (!rate.allowed) return NextResponse.json({ error: "You are doing that too quickly. Try again shortly." }, {
      status: 429, headers: { "Retry-After": String(rate.retryAfter) },
    });
    const result = await participationRpc<{ message_id: string; like_count: number | string; viewer_liked: boolean }[]>(
      "set_participation_message_like", { p_actor: user.id, p_thread: threadId, p_message: messageId, p_active: body.active },
    );
    const row = result?.[0];
    if (!row) return NextResponse.json({ error: "Comment is no longer available." }, { status: 404 });
    return NextResponse.json({ messageId: row.message_id, likes: Number(row.like_count) || 0, liked: Boolean(row.viewer_liked) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}
