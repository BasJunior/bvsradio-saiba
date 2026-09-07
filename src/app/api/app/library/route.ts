import { NextResponse } from "next/server";
import type { DiscoveryItem, DiscoveryKind } from "@/lib/discovery";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sections = new Set(["favourites", "follows", "history"]);
const kinds = new Set<DiscoveryKind>(["track", "artist", "show", "beat", "release"]);

type Section = "favourites" | "follows" | "history";
type SyncItem = { section?: unknown; item?: unknown; saved?: unknown };

function cleanText(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function cleanSection(value: unknown): Section | null {
  const section = cleanText(value, 20);
  return sections.has(section) ? section as Section : null;
}

function cleanItem(value: unknown): DiscoveryItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const id = cleanText(raw.id, 220);
  const kind = cleanText(raw.kind, 30) as DiscoveryKind;
  const title = cleanText(raw.title, 240);
  const subtitle = cleanText(raw.subtitle, 400);
  const href = cleanText(raw.href, 800);
  if (!id || !kinds.has(kind) || !title || !href.startsWith("/")) return null;
  const imageRaw = cleanText(raw.image, 1200);
  const image = imageRaw && (/^\//.test(imageRaw) || /^https?:\/\//i.test(imageRaw)) ? imageRaw : undefined;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => cleanText(tag, 80)).filter(Boolean).slice(0, 20)
    : undefined;
  return { id, kind, title, subtitle, href, ...(image ? { image } : {}), ...(tags?.length ? { tags } : {}) };
}

async function identity(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !url || !service) return null;
  return authUserId(url, service, token);
}

export async function GET(request: Request) {
  const user = await identity(request);
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const response = await fetch(
    `${url}/rest/v1/user_library_items?user_id=eq.${user.id}&select=section,item_id,item,updated_at&order=updated_at.desc&limit=300`,
    { headers: serviceHeaders(service), cache: "no-store" },
  );
  if (!response.ok) return NextResponse.json({ error: "Library sync is unavailable." }, { status: 503 });
  return NextResponse.json({ userId: user.id, items: await response.json() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await identity(request);
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { items?: SyncItem[] } & SyncItem;
  const incoming = Array.isArray(body.items) ? body.items.slice(0, 300) : [body];
  if (!incoming.length) return NextResponse.json({ error: "No library changes supplied." }, { status: 400 });

  const saves: Array<Record<string, unknown>> = [];
  const deletes: Array<{ section: Section; itemId: string }> = [];
  for (const entry of incoming) {
    const section = cleanSection(entry.section);
    const item = cleanItem(entry.item);
    if (!section || !item) return NextResponse.json({ error: "Invalid library item." }, { status: 400 });
    if (entry.saved === false) deletes.push({ section, itemId: item.id });
    else saves.push({ user_id: user.id, section, item_id: item.id, item, updated_at: new Date().toISOString() });
  }

  if (saves.length) {
    const response = await fetch(`${url}/rest/v1/user_library_items?on_conflict=user_id,section,item_id`, {
      method: "POST",
      headers: { ...serviceHeaders(service), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(saves),
    });
    if (!response.ok) return NextResponse.json({ error: "Could not sync saved library items." }, { status: 503 });
  }
  for (const item of deletes) {
    const response = await fetch(
      `${url}/rest/v1/user_library_items?user_id=eq.${user.id}&section=eq.${item.section}&item_id=eq.${encodeURIComponent(item.itemId)}`,
      { method: "DELETE", headers: serviceHeaders(service) },
    );
    if (!response.ok) return NextResponse.json({ error: "Could not sync a library removal." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
