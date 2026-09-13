import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import type { AppSurface } from "@/lib/app-surface";
import {
  ensureContentThread,
  participationEnabled,
  participationReady,
  participationRpc,
  resolveParticipationTarget,
  visibleThreadForObject,
  type ParticipationObjectKind,
} from "@/lib/participation-server";

const kinds = new Set<ParticipationObjectKind>(["track", "release", "beat"]);
type SummaryRow = { thread_id: string; like_count: number | string; repost_count: number | string; reply_count: number | string; viewer_liked: boolean; viewer_reposted: boolean };

function surfaceFrom(request: Request): AppSurface | null {
  const value = new URL(request.url).searchParams.get("surface");
  return value === "ios" || value === "android" ? value : null;
}

async function resolve(request: Request, rawKind: string, id: string, create: boolean) {
  const kind = rawKind as ParticipationObjectKind;
  if (!kinds.has(kind) || !id) return null;
  const target = await resolveParticipationTarget(kind, id, surfaceFrom(request));
  if (!target) return null;
  const threadId = await visibleThreadForObject(kind, target.id) || (create ? await ensureContentThread(target) : null);
  return { target, threadId };
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, threadId: null, comments: 0 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  const { kind, id } = await params;
  const resolved = await resolve(request, kind, id, false);
  if (!resolved) return NextResponse.json({ error: "Content not found." }, { status: 404 });
  if (!resolved.threadId) return NextResponse.json({ enabled: true, target: resolved.target, threadId: null, summary: { likes: 0, reposts: 0, comments: 0, liked: false, reposted: false } });
  const rows = await participationRpc<SummaryRow[]>("participation_thread_summary", { p_thread_ids: [resolved.threadId], p_viewer: user?.id || null });
  const row = Array.isArray(rows) ? rows[0] : null;
  return NextResponse.json({
    enabled: true,
    target: resolved.target,
    threadId: resolved.threadId,
    summary: {
      likes: Number(row?.like_count) || 0,
      reposts: Number(row?.repost_count) || 0,
      comments: Number(row?.reply_count) || 0,
      liked: Boolean(row?.viewer_liked),
      reposted: Boolean(row?.viewer_reposted),
    },
  }, { headers: { "Cache-Control": user ? "private, no-store" : "public, max-age=30, stale-while-revalidate=60" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to join this discussion." }, { status: 401 });
  const { kind, id } = await params;
  const resolved = await resolve(request, kind, id, true);
  if (!resolved?.threadId) return NextResponse.json({ error: "This content is not eligible for public discussion." }, { status: 404 });
  return NextResponse.json({ ok: true, threadId: resolved.threadId, target: resolved.target });
}
