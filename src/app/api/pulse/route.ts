import { NextResponse } from "next/server";
import type { BvsActivityItem, BvsActivityKind } from "@/lib/activity";
import type { BvsObjectKind } from "@/lib/bvs-object";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = { apikey: service, Authorization: `Bearer ${service}` };

type ActivityRow = {
  id: string;
  kind: BvsActivityKind;
  subject_kind: BvsObjectKind;
  subject_id: string;
  creator_id?: string | null;
  title: string;
  subtitle?: string | null;
  route: string;
  artwork?: string | null;
  occurred_at: string;
};

function label(kind: BvsActivityKind) {
  switch (kind) {
    case "track_added_to_rotation": return "Recently added to rotation";
    case "beat_published": return "New beat";
    case "product_published": return "New creator product";
    case "service_published": return "New creator service";
    case "verified_credit_added": return "New verified credit";
    case "story_published": return "New BVS story";
    case "show_scheduled": return "Upcoming on BVS";
    case "show_live": return "Live on BVS";
    case "show_archive_published": return "New replay";
    default: return "New release";
  }
}

function normalizeFollowId(value: unknown) {
  return String(value || "").replace(/^(artist|producer|creator)-/, "");
}

function validUuid(value: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function showSlugFromRoute(route: string) {
  const match = route.match(/^\/shows\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function signedInUserId() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch {
    return null;
  }
}

async function followedCreatorIds(userId: string) {
  const response = await fetch(
    `${url}/rest/v1/user_library_items?user_id=eq.${userId}&section=eq.follows&select=item&limit=200`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) return new Set<string>();
  const rows = await response.json() as Array<{ item?: { id?: string } }>;
  return new Set(rows.map((row) => normalizeFollowId(row.item?.id)).filter(Boolean));
}

async function publicProgrammeSlugs() {
  const response = await fetch(
    `${url}/rest/v1/programmes?select=slug&limit=500`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) return new Set<string>();
  const rows = await response.json() as Array<{ slug?: string }>;
  return new Set(rows.map((row) => String(row.slug || "")).filter(Boolean));
}

export async function GET(request: Request) {
  if (process.env.NEXT_PUBLIC_BVS_PULSE !== "1") {
    return NextResponse.json({ items: [] });
  }
  if (!url || !service) {
    return NextResponse.json({ error: "Pulse is not ready." }, { status: 503 });
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/bvs_activity_events?visibility=eq.public&visible_at=lte.${encodeURIComponent(new Date().toISOString())}&select=id,kind,subject_kind,subject_id,creator_id,title,subtitle,route,artwork,occurred_at&order=visible_at.desc&limit=60`,
      { headers, cache: "no-store" },
    );
    if (!response.ok) return NextResponse.json({ error: "Pulse is not ready." }, { status: 503 });

    const rawRows = await response.json() as ActivityRow[];
    const programmeSlugs = rawRows.some((row) => row.subject_kind === "show")
      ? await publicProgrammeSlugs()
      : new Set<string>();

    // A Pulse item is only useful if its public destination exists. In
    // particular, show events can be created before their public programme
    // shell. Suppress those events instead of sending listeners to a 404.
    const rows = rawRows.filter((row) => {
      if (row.subject_kind !== "show") return true;
      const slug = showSlugFromRoute(row.route);
      return Boolean(slug && programmeSlugs.has(slug));
    });

    const params = new URL(request.url).searchParams;
    const scope = params.get("scope") === "following" ? "following" : "global";
    const requestedCreatorId = params.get("creator");
    const creatorId = validUuid(requestedCreatorId) ? requestedCreatorId : null;

    let selected = creatorId
      ? rows.filter((row) => row.creator_id === creatorId).slice(0, 12)
      : rows.slice(0, 10);
    let following = new Set<string>();

    if (!creatorId && scope === "following") {
      const userId = await signedInUserId();
      if (userId) following = await followedCreatorIds(userId);
      if (following.size) {
        const matched = rows.filter((row) => row.creator_id && following.has(row.creator_id)).slice(0, 8);
        const global = rows.filter((row) => !matched.some((item) => item.id === row.id)).slice(0, 2);
        selected = [...matched, ...global];
      }
    }

    const items: BvsActivityItem[] = selected.map((row) => ({
      id: row.id,
      kind: row.kind,
      occurredAt: row.occurred_at,
      creatorId: row.creator_id || undefined,
      subject: {
        id: row.subject_id,
        kind: row.subject_kind,
        route: row.route,
        title: row.title,
        subtitle: row.subtitle || undefined,
        artwork: mediaUrlForStoredValue(row.artwork) || undefined,
      },
      label: label(row.kind),
      reason: row.creator_id && following.has(row.creator_id)
        ? "following"
        : row.kind === "show_live"
          ? "live"
          : "fresh",
    }));

    return NextResponse.json({
      items,
      scope: creatorId ? "creator" : following.size ? "following" : "global",
      creatorId: creatorId || undefined,
    });
  } catch {
    return NextResponse.json({ error: "Pulse could not load." }, { status: 503 });
  }
}
