import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import { participationEnabled, participationPatch, participationReady, participationRows } from "@/lib/participation-server";
import { processParticipationOutbox } from "@/lib/participation-notifications-server";
import { notificationEligible, notificationHref } from "@/lib/participation-delivery-policy";
import type { AppSurface } from "@/lib/app-surface";

type NotificationRow = {
  id: string;
  recipient_user_id: string;
  event_id?: string | null;
  category: "reply" | "mention" | "like" | "repost" | "follow" | "community" | "moderation";
  title: string;
  detail: string;
  target_href: string;
  thread_id?: string | null;
  message_id?: string | null;
  seen_at?: string | null;
  read_at?: string | null;
  created_at: string;
};

function parseSurface(value: string | null): AppSurface | null {
  return value === "ios" || value === "android" ? value : null;
}

function appHref(row: NotificationRow, surface: AppSurface | null) {
  return notificationHref(row.target_href, surface);
}

function safeCursor(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { createdAt?: string; id?: string };
    if (!parsed.createdAt || Number.isNaN(Date.parse(parsed.createdAt)) || !parsed.id) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function cursorFor(row?: NotificationRow) {
  if (!row) return null;
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id }), "utf8").toString("base64url");
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, events: [], unreadCount: 0, nextCursor: null });
  if (!participationReady()) return NextResponse.json({ error: "Participation inbox is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  await processParticipationOutbox(30).catch(() => null);

  const url = new URL(request.url);
  const surface = parseSurface(url.searchParams.get("surface"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50) || 50));
  const cursor = safeCursor(url.searchParams.get("cursor"));
  const cursorClause = cursor
    ? `&or=(created_at.lt.${encodeURIComponent(cursor.createdAt)},and(created_at.eq.${encodeURIComponent(cursor.createdAt)},id.lt.${encodeURIComponent(cursor.id)}))`
    : "";
  const rows = await participationRows<NotificationRow>(
    `participation_notifications?recipient_user_id=eq.${encodeURIComponent(user.id)}${cursorClause}&select=id,recipient_user_id,event_id,category,title,detail,target_href,thread_id,message_id,seen_at,read_at,created_at&order=created_at.desc,id.desc&limit=${limit + 1}`,
  );
  const rawPage = rows.slice(0, limit);
  const eligible = await Promise.all(rawPage.map(row => notificationEligible(row, surface)));
  const page = rawPage.filter((_, index) => eligible[index]);
  const unread = await participationRows<NotificationRow>(
    `participation_notifications?recipient_user_id=eq.${encodeURIComponent(user.id)}&read_at=is.null&select=id,recipient_user_id,event_id,thread_id,message_id&limit=500`,
  );
  const unreadEligible = await Promise.all(unread.map(row => notificationEligible(row, surface)));
  return NextResponse.json({
    cutoff: new Date().toISOString(),
    enabled: true,
    events: page.map((row) => ({
      id: `participation-${row.id}`,
      notificationId: row.id,
      title: row.title,
      detail: row.detail,
      created_at: row.created_at,
      href: appHref(row, surface),
      kind: row.category,
      seen_at: row.seen_at || null,
      read_at: row.read_at || null,
      threadId: row.thread_id || null,
      messageId: row.message_id || null,
    })),
    unreadCount: unreadEligible.filter(Boolean).length,
    unreadCountCapped: unread.length >= 500,
    nextCursor: rows.length > limit ? cursorFor(rawPage[rawPage.length - 1]) : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation inbox is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { ids?: string[]; all?: boolean; seen?: boolean; read?: boolean; cutoff?: string };
  const ids = [...new Set((body.ids || []).map((value) => String(value).replace(/^participation-/, "")).filter(Boolean))].slice(0, 100);
  if (!body.all && !ids.length) return NextResponse.json({ error: "Choose notifications to update." }, { status: 400 });
  if (body.seen !== true && body.read !== true) return NextResponse.json({ error: "Choose seen or read state." }, { status: 400 });
  const now = new Date().toISOString();
  const patch: Record<string, string> = {};
  if (body.seen) patch.seen_at = now;
  if (body.read) {
    patch.seen_at = now;
    patch.read_at = now;
  }
  if (body.all && (!body.cutoff || Number.isNaN(Date.parse(body.cutoff)) || Date.parse(body.cutoff) > Date.now())) return NextResponse.json({ error: "A valid inbox cutoff is required." }, { status: 400 });
  const filter = body.all ? `&created_at=lte.${encodeURIComponent(body.cutoff!)}` : `&id=in.(${ids.map(encodeURIComponent).join(",")})`;
  const updated = await participationPatch<NotificationRow>(
    `participation_notifications?recipient_user_id=eq.${encodeURIComponent(user.id)}${filter}`,
    patch,
  );
  return NextResponse.json({ ok: true, updated: updated.length });
}
