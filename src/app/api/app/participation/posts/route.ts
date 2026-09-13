import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import type { AppSurface } from "@/lib/app-surface";
import {
  checkParticipationRateLimit,
  participationRequestSurface,
  cleanParticipationBody,
  hasParticipationRulesAgreement,
  loadParticipationProfiles,
  participationBodyIssue,
  participationEnabled,
  participationReady,
  participationRows,
  participationRpc,
  resolveParticipationTarget,
  userBlockSet,
  type ParticipationIntent,
  type ParticipationObjectKind,
  type ParticipationPost,
  type ParticipationTarget,
} from "@/lib/participation-server";
import { withParticipationErrors } from "@/lib/participation-route";

const intents = new Set<ParticipationIntent>(["update", "question", "collaboration"]);
const attachmentKinds = new Set<ParticipationObjectKind>(["track", "release", "beat"]);
const RULES_VERSION = "participation-v1";

type ThreadRow = {
  id: string;
  author_user_id: string;
  intent: ParticipationIntent;
  attachment_kind?: ParticipationObjectKind | null;
  attachment_id?: string | null;
  attachment_title?: string | null;
  attachment_href?: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
};

type SummaryRow = {
  thread_id: string;
  like_count: number | string;
  repost_count: number | string;
  reply_count: number | string;
  viewer_liked: boolean;
  viewer_reposted: boolean;
};

type CreatePostResult = { thread_id: string; message_id: string; event_id: string; created_at: string };

function parseSurface(value: unknown): AppSurface | null {
  return value === "ios" || value === "android" ? value : null;
}

function safeCursor(raw: string | null) {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
    if (!value.createdAt || Number.isNaN(Date.parse(value.createdAt)) || !value.id) return null;
    return { createdAt: value.createdAt, id: value.id };
  } catch {
    return null;
  }
}

function encodeCursor(row?: ThreadRow) {
  if (!row) return null;
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id }), "utf8").toString("base64url");
}

async function hydratePosts(threads: ThreadRow[], viewerId: string | null, surface: AppSurface | null): Promise<ParticipationPost[]> {
  if (!threads.length) return [];
  const threadIds = threads.map((thread) => thread.id);
  const messages = await participationRows<MessageRow>(
    `participation_messages?thread_id=in.(${threadIds.map(encodeURIComponent).join(",")})&message_kind=eq.root&status=in.(published,deleted)&select=id,thread_id,author_user_id,body,created_at,edited_at&limit=${threads.length + 10}`,
  );
  const summaries = await participationRpc<SummaryRow[]>("participation_thread_summary", {
    p_thread_ids: threadIds,
    p_viewer: viewerId,
  });
  const profiles = await loadParticipationProfiles(threads.map((thread) => thread.author_user_id));
  const messageByThread = new Map(messages.map((message) => [message.thread_id, message]));
  const summaryByThread = new Map((Array.isArray(summaries) ? summaries : []).map((row) => [row.thread_id, row]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const targets = new Map(await Promise.all(threads.map(async (thread) => [thread.id, thread.attachment_kind && thread.attachment_id ? await resolveParticipationTarget(thread.attachment_kind, thread.attachment_id, surface) : null] as const)));
  return threads.flatMap((thread) => {
    const message = messageByThread.get(thread.id);
    if (!message) return [];
    const summary = summaryByThread.get(thread.id);
    const author = profileById.get(thread.author_user_id) || {
      id: thread.author_user_id,
      username: null,
      displayName: "BVS member",
      avatarUrl: null,
    };
    const attachment = targets.get(thread.id) || null;
    return [{
      threadId: thread.id,
      author,
      intent: thread.intent,
      body: message.body,
      createdAt: message.created_at,
      editedAt: message.edited_at || null,
      replyCount: Number(summary?.reply_count) || 0,
      likeCount: Number(summary?.like_count) || 0,
      repostCount: Number(summary?.repost_count) || 0,
      viewerLiked: Boolean(summary?.viewer_liked),
      viewerReposted: Boolean(summary?.viewer_reposted),
      attachment,
    } satisfies ParticipationPost];
  });
}

export async function GET(request: Request) {
  return withParticipationErrors(async () => {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, posts: [], nextCursor: null });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20) || 20));
  const cursor = safeCursor(url.searchParams.get("cursor"));
  const blocked = user ? await userBlockSet(user.id) : new Set<string>();
  const cursorClause = cursor
    ? `&or=(created_at.lt.${encodeURIComponent(cursor.createdAt)},and(created_at.eq.${encodeURIComponent(cursor.createdAt)},id.lt.${encodeURIComponent(cursor.id)}))`
    : "";
  const lane = url.searchParams.get("lane") || "focus";
  let laneClause = "";
  if (lane === "following" || lane === "activity") {
    if (!user) return NextResponse.json({ enabled: true, posts: [], nextCursor: null });
    if (lane === "following") {
      const follows = await participationRows<{ item_id: string }>(`user_library_items?user_id=eq.${encodeURIComponent(user.id)}&section=eq.follows&select=item_id&limit=1000`);
      const ids = follows.map(row => row.item_id).filter(id => /^[0-9a-f-]{36}$/i.test(id));
      if (!ids.length) return NextResponse.json({ enabled: true, posts: [], nextCursor: null });
      laneClause = `&author_user_id=in.(${ids.map(encodeURIComponent).join(",")})`;
    } else {
      const [reactions, replies] = await Promise.all([
        participationRows<{ thread_id: string }>(`participation_reactions?user_id=eq.${encodeURIComponent(user.id)}&select=thread_id&limit=1000`),
        participationRows<{ thread_id: string }>(`participation_messages?author_user_id=eq.${encodeURIComponent(user.id)}&status=eq.published&select=thread_id&limit=1000`),
      ]);
      const ids = [...new Set([...reactions, ...replies].map(row => row.thread_id))];
      laneClause = ids.length ? `&or=(author_user_id.eq.${encodeURIComponent(user.id)},id.in.(${ids.map(encodeURIComponent).join(",")}))` : `&author_user_id=eq.${encodeURIComponent(user.id)}`;
    }
  }
  const blockedClause = blocked.size ? `&author_user_id=not.in.(${[...blocked].map(encodeURIComponent).join(",")})` : "";
  const rows = await participationRows<ThreadRow>(
    `participation_threads?thread_type=eq.post&status=eq.published${cursorClause}${laneClause}${blockedClause}&select=id,author_user_id,intent,attachment_kind,attachment_id,attachment_title,attachment_href,created_at,updated_at&order=created_at.desc,id.desc&limit=${limit + 1}`,
  );
  const visible = rows.filter((row) => !blocked.has(row.author_user_id)).slice(0, limit);
  return NextResponse.json({
    enabled: true,
    posts: await hydratePosts(visible, user?.id || null, participationRequestSurface(request)),
    nextCursor: rows.length > limit ? encodeCursor(visible[visible.length - 1]) : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

export async function POST(request: Request) {
  return withParticipationErrors(async () => {
  if (!participationEnabled()) return NextResponse.json({ error: "Participation is not enabled on this release." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to post.", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!user.emailConfirmedAt) return NextResponse.json({ error: "Confirm your email before posting.", code: "EMAIL_CONFIRMATION_REQUIRED" }, { status: 403 });
  if (user.bannedUntil && Date.parse(user.bannedUntil) > Date.now()) {
    return NextResponse.json({ error: "Posting is temporarily unavailable for this account.", code: "ACCOUNT_RESTRICTED" }, { status: 403 });
  }
  if (!await hasParticipationRulesAgreement(user.id, RULES_VERSION)) {
    return NextResponse.json({ error: "Agree to the BVS community rules before posting.", code: "RULES_REQUIRED", rulesVersion: RULES_VERSION }, { status: 409 });
  }
  const rate = await checkParticipationRateLimit(request, user.id, "post");
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You have reached the posting limit for now.", retryAfter: rate.retryAfter },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => ({})) as {
    intent?: ParticipationIntent;
    body?: string;
    clientKey?: string;
    surface?: AppSurface;
    attachment?: { kind?: ParticipationObjectKind; id?: string } | null;
    mentionUserIds?: string[];
  };
  const intent = body.intent as ParticipationIntent;
  if (!intents.has(intent)) return NextResponse.json({ error: "Choose Update, Question or Looking for collaboration." }, { status: 400 });
  const text = cleanParticipationBody(body.body, 1000);
  const issue = participationBodyIssue(text, 1000);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });
  const clientKey = String(body.clientKey || "").trim().slice(0, 160);
  if (clientKey.length < 8) return NextResponse.json({ error: "Missing submission key. Retry from the composer." }, { status: 400 });

  let attachment: ParticipationTarget | null = null;
  if (body.attachment?.kind || body.attachment?.id) {
    const kind = body.attachment?.kind as ParticipationObjectKind;
    const id = String(body.attachment?.id || "").trim();
    if (!attachmentKinds.has(kind) || !id) return NextResponse.json({ error: "Choose a valid public BVS attachment." }, { status: 400 });
    attachment = await resolveParticipationTarget(kind, id, participationRequestSurface(request, body.surface));
    if (!attachment) return NextResponse.json({ error: "That attachment is not public or is no longer eligible." }, { status: 404 });
  }

  const requestedMentionIds = [...new Set((Array.isArray(body.mentionUserIds) ? body.mentionUserIds : []).map(String).filter(Boolean))].slice(0, 5);
  const eligibleMentions = requestedMentionIds.length ? await participationRows<{ id: string }>(`profiles?id=in.(${requestedMentionIds.map(encodeURIComponent).join(",")})&is_published=eq.true&select=id&limit=5`) : [];
  const mentionIds: string[] = [];
  for (const profile of eligibleMentions) {
    if (profile.id === user.id) continue;
    const blocked = await userBlockSet(user.id);
    if (!blocked.has(profile.id)) mentionIds.push(profile.id);
  }

  const result = await participationRpc<CreatePostResult[]>("create_participation_post", {
    p_actor: user.id,
    p_intent: intent,
    p_body: text,
    p_client_key: clientKey,
    p_attachment_kind: attachment?.kind || null,
    p_attachment_id: attachment?.id || null,
    p_attachment_title: attachment?.title || null,
    p_attachment_href: attachment?.href || null,
    p_mention_user_ids: mentionIds,
  });
  const created = Array.isArray(result) ? result[0] : null;
  if (!created) return NextResponse.json({ error: "Could not publish that post. Your draft is still saved." }, { status: 503 });

  const threadRows = await participationRows<ThreadRow>(
    `participation_threads?id=eq.${encodeURIComponent(created.thread_id)}&select=id,author_user_id,intent,attachment_kind,attachment_id,attachment_title,attachment_href,created_at,updated_at&limit=1`,
  );
  const posts = await hydratePosts(threadRows, user.id, participationRequestSurface(request, body.surface));
  return NextResponse.json({ ok: true, post: posts[0] || null, eventId: created.event_id }, { status: 201 });
  });
}
