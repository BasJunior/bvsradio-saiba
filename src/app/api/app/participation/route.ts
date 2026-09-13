import { NextResponse } from "next/server";
import type { BvsObjectKind } from "@/lib/bvs-object";
import type { AppSurface } from "@/lib/app-surface";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl, requireAppUser } from "@/lib/app-api-auth";
import {
  cleanParticipationBody,
  extractMentions,
  loadMentionProfiles,
  participationBodyIssue,
  participationEnabled,
  participationRateLimited,
  resolveParticipationTarget,
  type ParticipationKind,
} from "@/lib/participation-server";

const objectKinds = new Set<BvsObjectKind>(["track", "release", "creator", "beat", "story", "show", "product", "service"]);
const interactiveKinds = new Set<ParticipationKind>(["like", "repost", "comment", "reply"]);

type ParticipationEvent = {
  id: string;
  actor_user_id: string;
  kind: ParticipationKind;
  target_kind: BvsObjectKind;
  target_id: string;
  target_owner_user_id?: string | null;
  target_title: string;
  target_href?: string | null;
  parent_event_id?: string | null;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  deleted_at?: string | null;
};

type SummaryRow = {
  target_key: string;
  like_count: number | string;
  repost_count: number | string;
  comment_count: number | string;
  viewer_liked: boolean;
  viewer_reposted: boolean;
};

function unavailable() {
  return !appSupabaseUrl || !appSupabaseService;
}

function serviceUrl(path: string) {
  return `${appSupabaseUrl}/rest/v1/${path}`;
}

function parseSurface(value: unknown): AppSurface | null {
  return value === "ios" || value === "android" ? value : null;
}

function parseTargetKey(value: string) {
  const separator = value.indexOf(":");
  if (separator < 1) return null;
  const kind = value.slice(0, separator) as BvsObjectKind;
  const id = value.slice(separator + 1).trim();
  if (!objectKinds.has(kind) || !id || id.length > 240) return null;
  return { kind, id, key: `${kind}:${id}` };
}

async function rows<T>(path: string): Promise<T[]> {
  const response = await fetch(serviceUrl(path), { headers: appServiceHeaders(), cache: "no-store" }).catch(() => null);
  if (!response?.ok) return [];
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload as T[] : [];
}

async function postRows<T>(path: string, payload: unknown): Promise<T[]> {
  const response = await fetch(serviceUrl(path), {
    method: "POST",
    headers: appServiceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(payload),
  }).catch(() => null);
  if (!response?.ok) return [];
  const result = await response.json().catch(() => []);
  return Array.isArray(result) ? result as T[] : [];
}

async function patchRows<T>(path: string, payload: unknown): Promise<T[]> {
  const response = await fetch(serviceUrl(path), {
    method: "PATCH",
    headers: appServiceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(payload),
  }).catch(() => null);
  if (!response?.ok) return [];
  const result = await response.json().catch(() => []);
  return Array.isArray(result) ? result as T[] : [];
}

async function summaries(keys: string[], viewer: string | null) {
  if (!keys.length) return {} as Record<string, {
    likes: number;
    reposts: number;
    comments: number;
    liked: boolean;
    reposted: boolean;
  }>;
  const response = await fetch(serviceUrl("rpc/participation_summaries"), {
    method: "POST",
    headers: appServiceHeaders(),
    body: JSON.stringify({ target_keys: keys, viewer }),
    cache: "no-store",
  }).catch(() => null);
  const rows = response?.ok ? await response.json().catch(() => []) as SummaryRow[] : [];
  const output: Record<string, { likes: number; reposts: number; comments: number; liked: boolean; reposted: boolean }> = {};
  for (const key of keys) output[key] = { likes: 0, reposts: 0, comments: 0, liked: false, reposted: false };
  for (const row of rows) {
    output[row.target_key] = {
      likes: Number(row.like_count) || 0,
      reposts: Number(row.repost_count) || 0,
      comments: Number(row.comment_count) || 0,
      liked: Boolean(row.viewer_liked),
      reposted: Boolean(row.viewer_reposted),
    };
  }
  return output;
}

async function commentsFor(target: { kind: BvsObjectKind; id: string }) {
  const events = await rows<ParticipationEvent>(
    `participation_events?target_kind=eq.${encodeURIComponent(target.kind)}&target_id=eq.${encodeURIComponent(target.id)}&kind=in.(comment,reply)&deleted_at=is.null&select=id,actor_user_id,kind,target_kind,target_id,parent_event_id,body,created_at&order=created_at.asc&limit=120`,
  );
  const actorIds = [...new Set(events.map((event) => event.actor_user_id).filter(Boolean))];
  const profiles = actorIds.length
    ? await rows<{ id: string; username?: string | null; display_name?: string | null; creator_public_name?: string | null; avatar_url?: string | null }>(
      `profiles?id=in.(${actorIds.join(",")})&select=id,username,display_name,creator_public_name,avatar_url&limit=120`,
    )
    : [];
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return events.map((event) => {
    const profile = byId.get(event.actor_user_id);
    return {
      id: event.id,
      kind: event.kind,
      parentEventId: event.parent_event_id || null,
      body: event.body || "",
      createdAt: event.created_at,
      actor: {
        id: event.actor_user_id,
        username: profile?.username || null,
        displayName: profile?.creator_public_name || profile?.display_name || profile?.username || "BVS member",
        avatarUrl: profile?.avatar_url || null,
      },
    };
  });
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, summaries: {}, comments: [], myActivity: [] });
  if (unavailable()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  const url = new URL(request.url);
  const keys = [...new Set(String(url.searchParams.get("keys") || "")
    .split(",")
    .map((value) => parseTargetKey(value.trim()))
    .filter(Boolean)
    .map((value) => value!.key))].slice(0, 120);
  const commentsTarget = parseTargetKey(String(url.searchParams.get("commentsFor") || ""));
  const [summaryMap, comments, activityRows] = await Promise.all([
    summaries(keys, user?.id || null),
    commentsTarget ? commentsFor(commentsTarget) : Promise.resolve([]),
    user
      ? rows<Pick<ParticipationEvent, "target_kind" | "target_id" | "kind" | "created_at">>(
        `participation_events?actor_user_id=eq.${encodeURIComponent(user.id)}&kind=in.(like,repost,comment,reply)&deleted_at=is.null&select=target_kind,target_id,kind,created_at&order=created_at.desc&limit=250`,
      )
      : Promise.resolve([]),
  ]);
  const myActivity = [...new Set(activityRows.map((row) => `${row.target_kind}:${row.target_id}`))];
  return NextResponse.json({ enabled: true, summaries: summaryMap, comments, myActivity });
}

export async function POST(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Participation is not enabled on this release." }, { status: 404 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to participate." }, { status: 401 });
  if (unavailable()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });

  const body = await request.json().catch(() => ({})) as {
    kind?: ParticipationKind;
    targetKind?: BvsObjectKind;
    targetId?: string;
    parentEventId?: string;
    body?: string;
    surface?: AppSurface;
  };
  const kind = body.kind as ParticipationKind;
  const targetKind = body.targetKind as BvsObjectKind;
  const targetId = String(body.targetId || "").trim().slice(0, 240);
  if (!interactiveKinds.has(kind) || !objectKinds.has(targetKind) || !targetId) {
    return NextResponse.json({ error: "Invalid participation request." }, { status: 400 });
  }
  if (await participationRateLimited(user.id, kind)) {
    return NextResponse.json({ error: "You are doing that too quickly. Try again shortly." }, { status: 429 });
  }
  const target = await resolveParticipationTarget(targetKind, targetId, parseSurface(body.surface));
  if (!target) return NextResponse.json({ error: "That public BVS item is not available." }, { status: 404 });

  if (kind === "like" || kind === "repost") {
    const dedupeKey = `${kind}:${user.id}:${target.kind}:${target.id}`;
    const existing = await rows<ParticipationEvent>(
      `participation_events?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&deleted_at=is.null&select=id,created_at&limit=1`,
    );
    if (existing[0]) {
      const removed = await patchRows<ParticipationEvent>(
        `participation_events?id=eq.${encodeURIComponent(existing[0].id)}&actor_user_id=eq.${encodeURIComponent(user.id)}&deleted_at=is.null`,
        { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      );
      return NextResponse.json({ ok: true, active: false, event: removed[0] || null });
    }
    const created = await postRows<ParticipationEvent>("participation_events", {
      actor_user_id: user.id,
      kind,
      target_kind: target.kind,
      target_id: target.id,
      target_owner_user_id: target.ownerUserId === user.id ? null : target.ownerUserId,
      target_title: target.title,
      target_href: target.href,
      dedupe_key: dedupeKey,
      metadata: {},
    });
    if (!created[0]) return NextResponse.json({ error: "Could not save that reaction." }, { status: 503 });
    return NextResponse.json({ ok: true, active: true, event: created[0] });
  }

  const cleanBody = cleanParticipationBody(body.body);
  const issue = participationBodyIssue(cleanBody);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });

  let parent: ParticipationEvent | null = null;
  if (kind === "reply") {
    const parentId = String(body.parentEventId || "").trim();
    if (!parentId) return NextResponse.json({ error: "Choose a comment to reply to." }, { status: 400 });
    const parentRows = await rows<ParticipationEvent>(
      `participation_events?id=eq.${encodeURIComponent(parentId)}&target_kind=eq.${encodeURIComponent(target.kind)}&target_id=eq.${encodeURIComponent(target.id)}&kind=in.(comment,reply)&deleted_at=is.null&select=id,actor_user_id,kind,target_kind,target_id&limit=1`,
    );
    parent = parentRows[0] || null;
    if (!parent) return NextResponse.json({ error: "That comment is no longer available." }, { status: 404 });
  }

  const created = await postRows<ParticipationEvent>("participation_events", {
    actor_user_id: user.id,
    kind,
    target_kind: target.kind,
    target_id: target.id,
    target_owner_user_id: target.ownerUserId === user.id ? null : target.ownerUserId,
    target_title: target.title,
    target_href: target.href,
    parent_event_id: parent?.id || null,
    body: cleanBody,
    metadata: {},
  });
  const event = created[0];
  if (!event) return NextResponse.json({ error: "Could not post that comment." }, { status: 503 });

  const notificationEvents: Array<Record<string, unknown>> = [];
  if (parent?.actor_user_id && parent.actor_user_id !== user.id && parent.actor_user_id !== target.ownerUserId) {
    notificationEvents.push({
      actor_user_id: user.id,
      kind: "mention",
      target_kind: target.kind,
      target_id: target.id,
      target_owner_user_id: parent.actor_user_id,
      target_title: target.title,
      target_href: target.href,
      parent_event_id: event.id,
      body: cleanBody,
      dedupe_key: `reply-notification:${event.id}:${parent.actor_user_id}`,
      metadata: { notification_kind: "reply", source_event_id: event.id },
    });
  }

  const mentions = extractMentions(cleanBody);
  const mentionedProfiles = await loadMentionProfiles(mentions);
  for (const profile of mentionedProfiles) {
    if (profile.id === user.id || profile.id === target.ownerUserId || profile.id === parent?.actor_user_id) continue;
    notificationEvents.push({
      actor_user_id: user.id,
      kind: "mention",
      target_kind: target.kind,
      target_id: target.id,
      target_owner_user_id: profile.id,
      target_title: target.title,
      target_href: target.href,
      parent_event_id: event.id,
      body: cleanBody,
      dedupe_key: `mention:${event.id}:${profile.id}`,
      metadata: { notification_kind: "mention", source_event_id: event.id, username: profile.username },
    });
  }
  if (notificationEvents.length) await postRows<ParticipationEvent>("participation_events", notificationEvents);

  return NextResponse.json({ ok: true, event });
}

export async function DELETE(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Participation is not enabled on this release." }, { status: 404 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (unavailable()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const eventId = String(new URL(request.url).searchParams.get("eventId") || "").trim();
  if (!eventId) return NextResponse.json({ error: "Missing comment id." }, { status: 400 });
  const removed = await patchRows<ParticipationEvent>(
    `participation_events?id=eq.${encodeURIComponent(eventId)}&actor_user_id=eq.${encodeURIComponent(user.id)}&kind=in.(comment,reply)&deleted_at=is.null`,
    { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  );
  if (!removed[0]) return NextResponse.json({ error: "Comment not found or not owned by you." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
