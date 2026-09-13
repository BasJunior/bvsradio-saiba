import { NextResponse } from "next/server";
import type { AppSurface } from "@/lib/app-surface";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  blockedPair,
  participationThreadEligible,
  participationRequestSurface,
  participationVisibleThread,
  checkParticipationRateLimit,
  ensureContentThread,
  participationEnabled,
  participationReady,
  participationRows,
  participationRpc,
  resolveParticipationTarget,
  visibleThreadForObject,
  type ParticipationObjectKind,
  type ParticipationReaction,
} from "@/lib/participation-server";

const objectKinds = new Set<ParticipationObjectKind>(["track", "release", "beat"]);

type ThreadRow = {
  id: string;
  thread_type: "post" | "content";
  author_user_id?: string | null;
  object_kind?: ParticipationObjectKind | null;
  object_id?: string | null;
  object_owner_user_id?: string | null;
};

type SummaryRow = {
  thread_id: string;
  like_count: number | string;
  repost_count: number | string;
  reply_count: number | string;
  viewer_liked: boolean;
  viewer_reposted: boolean;
};

type ReactionResult = { active: boolean; event_id?: string | null; changed: boolean };

function parseSurface(value: unknown): AppSurface | null {
  return value === "ios" || value === "android" ? value : null;
}

function parseObjectKey(value: string) {
  const separator = value.indexOf(":");
  if (separator < 1) return null;
  const kind = value.slice(0, separator) as ParticipationObjectKind;
  const id = value.slice(separator + 1).trim();
  if (!objectKinds.has(kind) || !id || id.length > 240) return null;
  return { kind, id, key: `${kind}:${id}` };
}

async function threadSummaries(threadIds: string[], viewer: string | null) {
  if (!threadIds.length) return new Map<string, SummaryRow>();
  const rows = await participationRpc<SummaryRow[]>("participation_thread_summary", {
    p_thread_ids: threadIds,
    p_viewer: viewer,
  });
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.thread_id, row]));
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, summaries: {}, myActivity: [] });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  const url = new URL(request.url);
  const parsedKeys = [...new Map(
    String(url.searchParams.get("keys") || "")
      .split(",")
      .map((value) => parseObjectKey(value.trim()))
      .filter(Boolean)
      .slice(0, 120)
      .map((value) => [value!.key, value!]),
  ).values()];

  const summaries: Record<string, { threadId: string | null; likes: number; reposts: number; comments: number; liked: boolean; reposted: boolean }> = {};
  for (const target of parsedKeys) {
    summaries[target.key] = { threadId: null, likes: 0, reposts: 0, comments: 0, liked: false, reposted: false };
  }

  let contentThreads: ThreadRow[] = [];
  if (parsedKeys.length) {
    const ids = [...new Set(parsedKeys.map((target) => target.id))];
    contentThreads = await participationRows<ThreadRow>(
      `participation_threads?thread_type=eq.content&status=in.(published,locked)&object_id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,thread_type,object_kind,object_id,object_owner_user_id&limit=150`,
    );
  }
  contentThreads = (await Promise.all(contentThreads.map(async thread => await participationThreadEligible(thread, participationRequestSurface(request)) ? thread : null))).filter((thread): thread is ThreadRow => thread !== null);
  const byKey = new Map(contentThreads.map((thread) => [`${thread.object_kind}:${thread.object_id}`, thread]));
  const summaryRows = await threadSummaries(contentThreads.map((thread) => thread.id), user?.id || null);
  for (const target of parsedKeys) {
    const thread = byKey.get(target.key);
    if (!thread) continue;
    const row = summaryRows.get(thread.id);
    summaries[target.key] = {
      threadId: thread.id,
      likes: Number(row?.like_count) || 0,
      reposts: Number(row?.repost_count) || 0,
      comments: Number(row?.reply_count) || 0,
      liked: Boolean(row?.viewer_liked),
      reposted: Boolean(row?.viewer_reposted),
    };
  }

  let myActivity: string[] = [];
  if (user) {
    const [reactionRows, messageRows] = await Promise.all([
      participationRows<{ thread_id: string }>(
        `participation_reactions?user_id=eq.${encodeURIComponent(user.id)}&select=thread_id&limit=250`,
      ),
      participationRows<{ thread_id: string }>(
        `participation_messages?author_user_id=eq.${encodeURIComponent(user.id)}&status=eq.published&select=thread_id&limit=250`,
      ),
    ]);
    const threadIds = [...new Set([...reactionRows, ...messageRows].map((row) => row.thread_id))];
    const activityThreads = threadIds.length
      ? await participationRows<ThreadRow>(
        `participation_threads?id=in.(${threadIds.map(encodeURIComponent).join(",")})&status=in.(published,locked)&select=id,thread_type,object_kind,object_id&limit=300`,
      )
      : [];
    myActivity = [...new Set(activityThreads.map((thread) => thread.thread_type === "content" && thread.object_kind && thread.object_id
      ? `${thread.object_kind}:${thread.object_id}`
      : `post:${thread.id}`))];
  }

  return NextResponse.json({ enabled: true, summaries, myActivity }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Participation is not enabled on this release." }, { status: 404 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to participate." }, { status: 401 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });

  const body = await request.json().catch(() => ({})) as {
    reaction?: ParticipationReaction;
    active?: boolean;
    threadId?: string;
    targetKind?: ParticipationObjectKind;
    targetId?: string;
    surface?: AppSurface;
  };
  const reaction = body.reaction;
  if (reaction !== "like" && reaction !== "repost") {
    return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  }
  const rate = await checkParticipationRateLimit(request, user.id, "reaction");
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "You are doing that too quickly. Try again shortly.", retryAfter: rate.retryAfter },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  let threadId = String(body.threadId || "").trim();
  let thread: ThreadRow | null = null;
  if (threadId) {
    thread = await participationVisibleThread(threadId, user.id, participationRequestSurface(request, body.surface));
  } else {
    const targetKind = body.targetKind;
    const targetId = String(body.targetId || "").trim().slice(0, 240);
    if (!targetKind || !objectKinds.has(targetKind) || !targetId) {
      return NextResponse.json({ error: "Missing conversation target." }, { status: 400 });
    }
    const target = await resolveParticipationTarget(targetKind, targetId, participationRequestSurface(request, body.surface));
    if (!target) return NextResponse.json({ error: "That public BVS item is not available." }, { status: 404 });
    threadId = await visibleThreadForObject(target.kind, target.id) || await ensureContentThread(target) || "";
    if (threadId) {
      thread = { id: threadId, thread_type: "content", object_owner_user_id: target.ownerUserId };
    }
  }
  if (!threadId || !thread) return NextResponse.json({ error: "Conversation is unavailable." }, { status: 404 });
  if (thread.thread_type === "post" && thread.author_user_id && await blockedPair(user.id, thread.author_user_id)) {
    return NextResponse.json({ error: "You cannot interact with this account." }, { status: 403 });
  }
  if (thread.thread_type === "content" && thread.object_owner_user_id && await blockedPair(user.id, thread.object_owner_user_id)) {
    return NextResponse.json({ error: "You cannot interact with this account." }, { status: 403 });
  }

  const desired = body.active !== false;
  const result = await participationRpc<ReactionResult[]>("set_participation_reaction", {
    p_actor: user.id,
    p_thread: threadId,
    p_reaction: reaction,
    p_active: desired,
  });
  const row = Array.isArray(result) ? result[0] : null;
  if (!row) return NextResponse.json({ error: "Could not save that reaction." }, { status: 503 });
  const summary = await threadSummaries([threadId], user.id);
  const current = summary.get(threadId);
  return NextResponse.json({
    ok: true,
    active: Boolean(row.active),
    changed: Boolean(row.changed),
    eventId: row.event_id || null,
    summary: {
      threadId,
      likes: Number(current?.like_count) || 0,
      reposts: Number(current?.repost_count) || 0,
      comments: Number(current?.reply_count) || 0,
      liked: Boolean(current?.viewer_liked),
      reposted: Boolean(current?.viewer_reposted),
    },
  });
}
