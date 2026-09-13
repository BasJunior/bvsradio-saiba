import "server-only";

import { createHash } from "node:crypto";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl } from "@/lib/app-api-auth";
import type { AppSurface } from "@/lib/app-surface";

export type ParticipationObjectKind = "track" | "release" | "beat";
export type ParticipationIntent = "update" | "question" | "collaboration";
export type ParticipationReaction = "like" | "repost";

export type ParticipationTarget = {
  kind: ParticipationObjectKind;
  id: string;
  title: string;
  href: string;
  ownerUserId: string | null;
  artwork?: string | null;
  subtitle?: string | null;
};

export type ParticipationProfile = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type ParticipationPost = {
  threadId: string;
  author: ParticipationProfile;
  intent: ParticipationIntent;
  body: string;
  createdAt: string;
  editedAt: string | null;
  replyCount: number;
  likeCount: number;
  repostCount: number;
  viewerLiked: boolean;
  viewerReposted: boolean;
  attachment: ParticipationTarget | null;
};

export type ParticipationThreadMessage = {
  id: string;
  threadId: string;
  author: ParticipationProfile;
  kind: "root" | "reply";
  replyToId: string | null;
  replyToAuthor: ParticipationProfile | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
};

export function participationEnabled() {
  const value = String(process.env.BVS_PARTICIPATION_ENABLED || "").toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return process.env.VERCEL_ENV !== "production";
}

export function participationReady() {
  return Boolean(appSupabaseUrl && appSupabaseService);
}

export function participationServiceUrl(path: string) {
  return `${appSupabaseUrl}/rest/v1/${path}`;
}

export class ParticipationUnavailableError extends Error {
  constructor(message = "Participation is unavailable.") {
    super(message);
    this.name = "ParticipationUnavailableError";
  }
}

async function participationResponse(path: string, init: RequestInit) {
  if (!participationReady()) throw new ParticipationUnavailableError();
  const response = await fetch(participationServiceUrl(path), {
    ...init,
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) throw new ParticipationUnavailableError();
  return response;
}

export async function participationRows<T>(path: string): Promise<T[]> {
  const response = await participationResponse(path, {
    headers: appServiceHeaders(),
    signal: AbortSignal.timeout(6000),
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : [];
  return Array.isArray(payload) ? payload as T[] : [];
}

export async function participationRpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const response = await participationResponse(`rpc/${name}`, {
    method: "POST",
    headers: appServiceHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(7000),
  });
  return await response.json() as T | null;
}

export async function participationInsert<T>(table: string, body: unknown, prefer = "return=representation"): Promise<T[]> {
  const response = await participationResponse(table, {
    method: "POST",
    headers: appServiceHeaders({ Prefer: prefer }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(7000),
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : [];
  return Array.isArray(payload) ? payload as T[] : [];
}

export async function participationPatch<T>(path: string, body: unknown): Promise<T[]> {
  const response = await participationResponse(path, {
    method: "PATCH",
    headers: appServiceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(7000),
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : [];
  return Array.isArray(payload) ? payload as T[] : [];
}

export async function participationDelete(path: string) {
  await participationResponse(path, {
    method: "DELETE",
    headers: appServiceHeaders({ Prefer: "return=minimal" }),
    signal: AbortSignal.timeout(7000),
  });
  return true;
}

function safeId(value: string) {
  return encodeURIComponent(String(value || "").trim().slice(0, 240));
}

export async function resolveParticipationTarget(
  kind: ParticipationObjectKind,
  id: string,
  surface: AppSurface | null,
): Promise<ParticipationTarget | null> {
  const encoded = safeId(id);
  if (!encoded) return null;

  if (kind === "track") {
    const rows = await participationRows<{
      id: string; user_id?: string | null; title: string; artist_name?: string | null; artwork_url?: string | null;
    }>(`tracks?id=eq.${encoded}&is_public=eq.true&editorial_status=eq.approved&select=id,user_id,title,artist_name,artwork_url&limit=1`);
    const row = rows[0];
    if (!row) return null;
    if (surface && !await participationMobileCleared(kind, row.id, surface)) return null;
    return {
      kind,
      id: row.id,
      title: row.title,
      subtitle: row.artist_name || null,
      artwork: row.artwork_url || null,
      ownerUserId: row.user_id || null,
      href: surface ? `/app/${surface}/explore?q=${encodeURIComponent(row.title)}&kind=music` : `/catalogue?q=${encodeURIComponent(row.title)}`,
    };
  }

  if (kind === "release") {
    const rows = await participationRows<{
      id: string; user_id?: string | null; title: string; artist_name?: string | null; cover_url?: string | null;
    }>(`releases?id=eq.${encoded}&is_public=eq.true&editorial_status=eq.approved&select=id,user_id,title,artist_name,cover_url&limit=1`);
    const row = rows[0];
    if (!row) return null;
    if (surface && !await participationMobileCleared(kind, row.id, surface)) return null;
    return {
      kind,
      id: row.id,
      title: row.title,
      subtitle: row.artist_name || null,
      artwork: row.cover_url || null,
      ownerUserId: row.user_id || null,
      href: surface ? `/app/${surface}/explore?q=${encodeURIComponent(row.title)}&kind=music` : `/album/${encodeURIComponent(row.id)}`,
    };
  }

  const rows = await participationRows<{
    id: string; producer_user_id?: string | null; title: string; genre?: string | null; artwork_path?: string | null;
  }>(`beats?id=eq.${encoded}&is_public=eq.true&status=eq.published&rights_confirmed=eq.true&select=id,producer_user_id,title,genre,artwork_path&limit=1`);
  const row = rows[0];
  if (!row) return null;
  return {
    kind: "beat",
    id: row.id,
    title: row.title,
    subtitle: row.genre || null,
    artwork: row.artwork_path || null,
    ownerUserId: row.producer_user_id || null,
    href: surface ? `/app/${surface}/beat/${encodeURIComponent(row.id)}` : `/beat/${encodeURIComponent(row.id)}`,
  };
}

export function cleanParticipationBody(value: unknown, max = 1000) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function participationBodyIssue(body: string, max = 1000) {
  if (!body) return "Write something before posting.";
  if (body.length > max) return `Keep this under ${max.toLocaleString()} characters.`;
  const urls = body.match(/https?:\/\//gi)?.length || 0;
  if (urls > 3) return "Too many links in one message.";
  if (/(.)\1{14,}/i.test(body)) return "That message looks repetitive.";
  return null;
}

export async function loadParticipationProfiles(ids: string[]): Promise<ParticipationProfile[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 150);
  if (!unique.length) return [];
  const rows = await participationRows<{
    id: string; username?: string | null; display_name?: string | null; creator_public_name?: string | null; avatar_url?: string | null;
  }>(`profiles?id=in.(${unique.map(encodeURIComponent).join(",")})&select=id,username,display_name,creator_public_name,avatar_url&limit=150`);
  return rows.map((row) => ({
    id: row.id,
    username: row.username || null,
    displayName: String(row.creator_public_name || row.display_name || row.username || "BVS member").trim(),
    avatarUrl: row.avatar_url || null,
  }));
}

export async function searchMentionProfiles(query: string): Promise<ParticipationProfile[]> {
  const needle = String(query || "").trim().replace(/[%*(),]/g, "").slice(0, 40);
  if (needle.length < 2) return [];
  const encoded = encodeURIComponent(`*${needle}*`);
  const rows = await participationRows<{
    id: string; username?: string | null; display_name?: string | null; creator_public_name?: string | null; avatar_url?: string | null;
  }>(`profiles?is_published=eq.true&or=(username.ilike.${encoded},display_name.ilike.${encoded},creator_public_name.ilike.${encoded})&select=id,username,display_name,creator_public_name,avatar_url&limit=8`);
  return rows.map((row) => ({
    id: row.id,
    username: row.username || null,
    displayName: String(row.creator_public_name || row.display_name || row.username || "BVS member").trim(),
    avatarUrl: row.avatar_url || null,
  }));
}

export async function hasParticipationRulesAgreement(userId: string, version = "participation-v1") {
  const rows = await participationRows<{ user_id: string }>(
    `participation_rule_agreements?user_id=eq.${encodeURIComponent(userId)}&rules_version=eq.${encodeURIComponent(version)}&select=user_id&limit=1`,
  );
  return Boolean(rows[0]);
}

export async function blockedPair(userA: string, userB: string) {
  if (!userA || !userB || userA === userB) return false;
  const rows = await participationRows<{ blocker_user_id: string }>(
    `participation_blocks?or=(and(blocker_user_id.eq.${encodeURIComponent(userA)},blocked_user_id.eq.${encodeURIComponent(userB)}),and(blocker_user_id.eq.${encodeURIComponent(userB)},blocked_user_id.eq.${encodeURIComponent(userA)}))&select=blocker_user_id&limit=1`,
  );
  return Boolean(rows[0]);
}

function requestIpHash(request: Request) {
  const forwarded = String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
  const salt = process.env.PARTICIPATION_RATE_LIMIT_SALT || appSupabaseUrl || "bvs";
  return createHash("sha256").update(`${salt}:${forwarded}`).digest("hex").slice(0, 32);
}

type RateResult = { allowed: boolean; used: number; retry_after_seconds: number };

async function consumeRate(subjectKey: string, bucket: string, seconds: number, limit: number) {
  const result = await participationRpc<RateResult[]>("consume_participation_rate_limit", {
    p_subject_key: subjectKey,
    p_bucket: bucket,
    p_window_seconds: seconds,
    p_limit: limit,
  });
  return Array.isArray(result) ? result[0] || null : null;
}

export async function checkParticipationRateLimit(
  request: Request,
  userId: string,
  bucket: "post" | "reply" | "reaction" | "report",
) {
  const config = bucket === "post"
    ? { seconds: 3600, userLimit: 5, ipLimit: 15 }
    : bucket === "reply"
      ? { seconds: 3600, userLimit: 30, ipLimit: 80 }
      : bucket === "report"
        ? { seconds: 3600, userLimit: 12, ipLimit: 30 }
        : { seconds: 60, userLimit: 60, ipLimit: 150 };
  const [userResult, ipResult] = await Promise.all([
    consumeRate(`user:${userId}`, bucket, config.seconds, config.userLimit),
    consumeRate(`ip:${requestIpHash(request)}`, bucket, config.seconds, config.ipLimit),
  ]);
  const denied = [userResult, ipResult].filter((row) => row && !row.allowed) as RateResult[];
  return {
    allowed: Boolean(userResult && ipResult) && denied.length === 0,
    retryAfter: denied.length ? Math.max(...denied.map((row) => Number(row.retry_after_seconds) || 1)) : 0,
  };
}

export async function ensureContentThread(target: ParticipationTarget) {
  const result = await participationRpc<string>("ensure_participation_content_thread", {
    p_object_kind: target.kind,
    p_object_id: target.id,
    p_object_title: target.title,
    p_object_href: target.href,
    p_object_owner: target.ownerUserId,
  });
  return typeof result === "string" ? result : null;
}

export async function visibleThreadForObject(kind: ParticipationObjectKind, id: string) {
  const rows = await participationRows<{ id: string }>(
    `participation_threads?thread_type=eq.content&object_kind=eq.${encodeURIComponent(kind)}&object_id=eq.${encodeURIComponent(id)}&status=in.(published,locked)&select=id&limit=1`,
  );
  return rows[0]?.id || null;
}

export async function userBlockSet(userId: string) {
  const rows = await participationRows<{ blocker_user_id: string; blocked_user_id: string }>(
    `participation_blocks?or=(blocker_user_id.eq.${encodeURIComponent(userId)},blocked_user_id.eq.${encodeURIComponent(userId)})&select=blocker_user_id,blocked_user_id&limit=500`,
  );
  const blocked = new Set<string>();
  for (const row of rows) blocked.add(row.blocker_user_id === userId ? row.blocked_user_id : row.blocker_user_id);
  return blocked;
}

// Keep these checks shared by API reads, writes, and notification delivery.
export function participationRequestSurface(request: Request, value?: unknown): AppSurface | null {
  const url = new URL(request.url);
  const project = process.env.VERCEL_PROJECT_NAME || "";
  if (project === "bvsradio-app-vnext-2026-09" || url.hostname.includes("bvsradio-app-vnext")) return "ios";
  const explicit = value || url.searchParams.get("surface");
  if (explicit === "ios" || explicit === "android") return explicit;
  const referer = request.headers.get("referer") || "";
  return /\/app\/ios(?:\/|[?#]|$)/.test(referer) ? "ios" : /\/app\/android(?:\/|[?#]|$)/.test(referer) ? "android" : null;
}

async function participationMobileCleared(kind: "track" | "release", id: string, surface: AppSurface) {
  const filter = kind === "track" ? `id=eq.${encodeURIComponent(id)}` : `release_id=eq.${encodeURIComponent(id)}`;
  return (await participationRows<{ id: string }>(`tracks?${filter}&is_public=eq.true&editorial_status=eq.approved&mobile_distribution_clearances!inner(surface,status)&mobile_distribution_clearances.surface=eq.${surface}&mobile_distribution_clearances.status=eq.cleared&select=id,mobile_distribution_clearances(surface,status)&limit=1`)).length > 0;
}

export type ParticipationEligibilityThread = {
  thread_type: "post" | "content"; status?: string; object_kind?: ParticipationObjectKind | null; object_id?: string | null;
  author_user_id?: string | null; object_owner_user_id?: string | null;
};
export async function participationThreadEligible(thread: ParticipationEligibilityThread, surface: AppSurface | null = null) {
  if (thread.status && !["published", "locked"].includes(thread.status)) return false;
  if (thread.thread_type === "post") return true;
  return Boolean(thread.object_kind && thread.object_id && await resolveParticipationTarget(thread.object_kind, thread.object_id, surface));
}

export async function participationVisibleThread(id: string, viewer: string | null, surface: AppSurface | null = null) {
  const thread = (await participationRows<ParticipationEligibilityThread & { id: string }>(`participation_threads?id=eq.${encodeURIComponent(id)}&status=in.(published,locked)&select=id,thread_type,status,author_user_id,object_owner_user_id,object_kind,object_id&limit=1`))[0];
  if (!thread || !await participationThreadEligible(thread, surface)) return null;
  const owner = thread.thread_type === "post" ? thread.author_user_id : thread.object_owner_user_id;
  if (viewer && owner && await blockedPair(viewer, owner)) return null;
  return thread;
}
