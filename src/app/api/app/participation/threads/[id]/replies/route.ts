import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  blockedPair,
  checkParticipationRateLimit,
  cleanParticipationBody,
  hasParticipationRulesAgreement,
  participationBodyIssue,
  participationEnabled,
  participationReady,
  participationRows,
  participationRpc,
} from "@/lib/participation-server";

const RULES_VERSION = "participation-v1";

type ThreadRow = {
  id: string;
  thread_type: "post" | "content";
  author_user_id?: string | null;
  object_owner_user_id?: string | null;
  status: string;
};

type MessageRow = { id: string; thread_id: string; author_user_id?: string | null; status: string };
type ReplyResult = { message_id: string; event_id: string; created_at: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to reply.", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!user.emailConfirmedAt) return NextResponse.json({ error: "Confirm your email before replying.", code: "EMAIL_CONFIRMATION_REQUIRED" }, { status: 403 });
  if (user.bannedUntil && Date.parse(user.bannedUntil) > Date.now()) {
    return NextResponse.json({ error: "Replying is temporarily unavailable for this account.", code: "ACCOUNT_RESTRICTED" }, { status: 403 });
  }
  if (!await hasParticipationRulesAgreement(user.id, RULES_VERSION)) {
    return NextResponse.json({ error: "Agree to the BVS community rules before replying.", code: "RULES_REQUIRED", rulesVersion: RULES_VERSION }, { status: 409 });
  }
  const rate = await checkParticipationRateLimit(request, user.id, "reply");
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You have reached the reply limit for now.", retryAfter: rate.retryAfter },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const threadId = String((await params).id || "").trim();
  const payload = await request.json().catch(() => ({})) as {
    body?: string;
    replyToId?: string | null;
    clientKey?: string;
    mentionUserIds?: string[];
  };
  const text = cleanParticipationBody(payload.body, 500);
  const issue = participationBodyIssue(text, 500);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });
  const clientKey = String(payload.clientKey || "").trim().slice(0, 160);
  if (clientKey.length < 8) return NextResponse.json({ error: "Missing submission key. Retry from the reply box." }, { status: 400 });
  const replyToId = String(payload.replyToId || "").trim() || null;

  const threads = await participationRows<ThreadRow>(
    `participation_threads?id=eq.${encodeURIComponent(threadId)}&status=eq.published&select=id,thread_type,author_user_id,object_owner_user_id,status&limit=1`,
  );
  const thread = threads[0];
  if (!thread) return NextResponse.json({ error: "Conversation is no longer available." }, { status: 404 });
  if (thread.thread_type === "post" && !replyToId) return NextResponse.json({ error: "Choose the post or reply you are answering." }, { status: 400 });

  const parents = replyToId
    ? await participationRows<MessageRow>(
      `participation_messages?id=eq.${encodeURIComponent(replyToId)}&thread_id=eq.${encodeURIComponent(threadId)}&status=in.(published,deleted)&select=id,thread_id,author_user_id,status&limit=1`,
    )
    : [];
  const parent = parents[0] || null;
  if (replyToId && !parent) return NextResponse.json({ error: "Reply target is no longer available." }, { status: 404 });
  const owner = thread.thread_type === "post" ? thread.author_user_id : thread.object_owner_user_id;
  if ((owner && await blockedPair(user.id, owner)) || (parent?.author_user_id && await blockedPair(user.id, parent.author_user_id))) {
    return NextResponse.json({ error: "You cannot interact with this account." }, { status: 403 });
  }

  const requested = [...new Set((payload.mentionUserIds || []).map(String).filter(Boolean))].slice(0, 5);
  const mentionIds: string[] = [];
  if (requested.length) {
    const publicProfiles = await participationRows<{ id: string }>(
      `profiles?id=in.(${requested.map(encodeURIComponent).join(",")})&is_published=eq.true&select=id&limit=5`,
    );
    for (const profile of publicProfiles) {
      if (profile.id === user.id || await blockedPair(user.id, profile.id)) continue;
      mentionIds.push(profile.id);
    }
  }

  const result = await participationRpc<ReplyResult[]>("create_participation_reply", {
    p_actor: user.id,
    p_thread: threadId,
    p_reply_to: replyToId,
    p_body: text,
    p_client_key: clientKey,
    p_mention_user_ids: mentionIds,
  });
  const row = Array.isArray(result) ? result[0] : null;
  if (!row) return NextResponse.json({ error: "Could not send that reply. Your text is still saved." }, { status: 503 });
  return NextResponse.json({ ok: true, messageId: row.message_id, eventId: row.event_id, createdAt: row.created_at }, { status: 201 });
}
