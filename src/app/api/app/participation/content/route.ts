import { NextResponse } from "next/server";
import type { AppSurface } from "@/lib/app-surface";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  ensureContentThread,
  participationEnabled,
  participationReady,
  participationRows,
  resolveParticipationTarget,
  visibleThreadForObject,
  type ParticipationObjectKind,
} from "@/lib/participation-server";

const kinds = new Set<ParticipationObjectKind>(["track", "release", "beat"]);

function parseSurface(value: unknown): AppSurface | null {
  return value === "ios" || value === "android" ? value : null;
}

async function rootMessageId(threadId: string) {
  const rows = await participationRows<{ id: string }>(
    `participation_messages?thread_id=eq.${encodeURIComponent(threadId)}&message_kind=eq.root&status=eq.published&select=id&limit=1`,
  );
  return rows[0]?.id || null;
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, threadId: null, rootMessageId: null });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as ParticipationObjectKind;
  const id = String(url.searchParams.get("id") || "").trim().slice(0, 240);
  if (!kinds.has(kind) || !id) return NextResponse.json({ error: "Invalid discussion target." }, { status: 400 });
  const threadId = await visibleThreadForObject(kind, id);
  return NextResponse.json({
    enabled: true,
    threadId,
    rootMessageId: threadId ? await rootMessageId(threadId) : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to join the discussion." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { kind?: ParticipationObjectKind; id?: string; surface?: AppSurface };
  const kind = body.kind as ParticipationObjectKind;
  const id = String(body.id || "").trim().slice(0, 240);
  if (!kinds.has(kind) || !id) return NextResponse.json({ error: "Invalid discussion target." }, { status: 400 });
  const target = await resolveParticipationTarget(kind, id, parseSurface(body.surface));
  if (!target) return NextResponse.json({ error: "That public BVS item is unavailable." }, { status: 404 });
  const threadId = await ensureContentThread(target);
  if (!threadId) return NextResponse.json({ error: "Could not open the discussion." }, { status: 503 });
  return NextResponse.json({ threadId, rootMessageId: await rootMessageId(threadId) });
}
