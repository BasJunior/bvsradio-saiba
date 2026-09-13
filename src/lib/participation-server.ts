import "server-only";

import type { BvsObjectKind } from "@/lib/bvs-object";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl } from "@/lib/app-api-auth";
import type { AppSurface } from "@/lib/app-surface";

export type ParticipationKind = "like" | "repost" | "comment" | "reply" | "follow" | "mention";

export type ParticipationTarget = {
  kind: BvsObjectKind;
  id: string;
  title: string;
  href: string;
  ownerUserId: string | null;
};

export function participationEnabled() {
  const value = String(process.env.BVS_PARTICIPATION_ENABLED || "").toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return process.env.VERCEL_ENV !== "production";
}

function safeId(value: string) {
  return encodeURIComponent(String(value || "").trim().slice(0, 240));
}

async function serviceRows<T>(path: string): Promise<T[]> {
  if (!appSupabaseUrl || !appSupabaseService) return [];
  const response = await fetch(`${appSupabaseUrl}/rest/v1/${path}`, {
    headers: appServiceHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response?.ok) return [];
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload as T[] : [];
}

function appHref(surface: AppSurface | null, path: string) {
  if (!surface) return path;
  if (path.startsWith("/app/")) return path;
  return path;
}

export async function resolveParticipationTarget(
  kind: BvsObjectKind,
  id: string,
  surface: AppSurface | null,
): Promise<ParticipationTarget | null> {
  const encoded = safeId(id);
  if (!encoded) return null;

  if (kind === "track") {
    const rows = await serviceRows<{ id: string; user_id?: string | null; title: string }>(
      `tracks?id=eq.${encoded}&is_public=eq.true&editorial_status=eq.approved&select=id,user_id,title&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      kind,
      id: row.id,
      title: row.title,
      ownerUserId: row.user_id || null,
      href: surface ? `/app/${surface}/track/${encodeURIComponent(row.id)}` : `/catalogue?q=${encodeURIComponent(row.title)}`,
    };
  }

  if (kind === "release") {
    const rows = await serviceRows<{ id: string; user_id?: string | null; title: string }>(
      `releases?id=eq.${encoded}&is_public=eq.true&editorial_status=eq.approved&select=id,user_id,title&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      kind,
      id: row.id,
      title: row.title,
      ownerUserId: row.user_id || null,
      href: surface
        ? `/app/${surface}/explore?q=${encodeURIComponent(row.title)}&kind=music`
        : `/album/${encodeURIComponent(row.id)}`,
    };
  }

  if (kind === "beat") {
    const rows = await serviceRows<{ id: string; producer_user_id?: string | null; title: string }>(
      `beats?id=eq.${encoded}&is_public=eq.true&status=eq.published&rights_confirmed=eq.true&select=id,producer_user_id,title&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      kind,
      id: row.id,
      title: row.title,
      ownerUserId: row.producer_user_id || null,
      href: surface ? `/app/${surface}/beat/${encodeURIComponent(row.id)}` : `/beat/${encodeURIComponent(row.id)}`,
    };
  }

  if (kind === "creator") {
    const rows = await serviceRows<{
      id: string;
      username?: string | null;
      display_name?: string | null;
      creator_public_name?: string | null;
    }>(
      `profiles?id=eq.${encoded}&is_published=eq.true&select=id,username,display_name,creator_public_name&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    const username = String(row.username || "").trim();
    const title = String(row.creator_public_name || row.display_name || username || "BVS creator").trim();
    return {
      kind,
      id: row.id,
      title,
      ownerUserId: row.id,
      href: surface && username
        ? `/app/${surface}/creator/${encodeURIComponent(username)}`
        : username
          ? `/artist/${encodeURIComponent(username)}`
          : "/search?type=artists",
    };
  }

  if (kind === "product" || kind === "service") {
    const rows = await serviceRows<{
      id: string;
      seller_user_id?: string | null;
      title: string;
      listing_type?: string | null;
    }>(
      `creator_marketplace_listings?id=eq.${encoded}&status=eq.published&select=id,seller_user_id,title,listing_type&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    const expected = kind === "service" ? "service" : "digital_product";
    if (row.listing_type && row.listing_type !== expected) return null;
    return {
      kind,
      id: row.id,
      title: row.title,
      ownerUserId: row.seller_user_id || null,
      href: surface ? `/app/${surface}/marketplace` : "/marketplace",
    };
  }

  if (kind === "show") {
    const rows = await serviceRows<{ id: string; title: string; programme_slug?: string | null }>(
      `show_events?id=eq.${encoded}&status=in.(scheduled,live)&select=id,title,programme_slug&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    const slug = String(row.programme_slug || "").trim();
    return {
      kind,
      id: row.id,
      title: row.title,
      ownerUserId: null,
      href: slug
        ? (surface ? `/app/${surface}/show/${encodeURIComponent(slug)}` : `/shows/${encodeURIComponent(slug)}`)
        : (surface ? `/app/${surface}/rooms` : "/shows"),
    };
  }

  if (kind === "story") {
    const rows = await serviceRows<{ id: string; slug?: string | null; title: string; user_id?: string | null }>(
      `studio_articles?or=(id.eq.${encoded},slug.eq.${encoded})&status=eq.published&select=id,slug,title,user_id&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    const slug = String(row.slug || row.id).trim();
    return {
      kind,
      id,
      title: row.title,
      ownerUserId: row.user_id || null,
      href: appHref(surface, `/blog/${encodeURIComponent(slug)}`),
    };
  }

  return null;
}

export function cleanParticipationBody(value: unknown) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1000);
}

export function participationBodyIssue(body: string) {
  if (!body) return "Write something before posting.";
  if (body.length > 1000) return "Keep comments under 1,000 characters.";
  const urls = body.match(/https?:\/\//gi)?.length || 0;
  if (urls > 3) return "Too many links in one comment.";
  if (/(.)\1{14,}/i.test(body)) return "That comment looks repetitive.";
  return null;
}

export function extractMentions(body: string) {
  const found = body.matchAll(/(^|[^\w])@([a-zA-Z0-9_.-]{2,40})/g);
  return [...new Set(Array.from(found, (match) => match[2].toLowerCase()))].slice(0, 8);
}

export async function participationRateLimited(userId: string, kind: ParticipationKind) {
  if (!appSupabaseUrl || !appSupabaseService) return true;
  const seconds = kind === "comment" || kind === "reply" ? 60 : 30;
  const max = kind === "comment" || kind === "reply" ? 5 : 14;
  const since = encodeURIComponent(new Date(Date.now() - seconds * 1000).toISOString());
  const response = await fetch(
    `${appSupabaseUrl}/rest/v1/participation_events?actor_user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${since}&deleted_at=is.null&select=id&limit=${max + 1}`,
    { headers: appServiceHeaders(), cache: "no-store" },
  ).catch(() => null);
  if (!response?.ok) return false;
  const rows = await response.json().catch(() => []) as Array<{ id: string }>;
  return rows.length >= max;
}

export async function loadMentionProfiles(usernames: string[]) {
  if (!usernames.length) return [] as Array<{ id: string; username: string }>;
  const values = usernames.map((value) => `"${value.replace(/["\\]/g, "")}"`).join(",");
  return serviceRows<{ id: string; username: string }>(
    `profiles?username=in.(${encodeURIComponent(values)})&is_published=eq.true&select=id,username&limit=8`,
  );
}
