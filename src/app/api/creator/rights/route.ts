import { NextResponse } from "next/server";
import { creatorHeaders, creatorIdentity, creatorUrl } from "@/lib/creator-server";
import { RIGHTS_GRANT_VERSION, cleanSocietyDeclaration, type RightsDeclarationRow } from "@/lib/rights-declarations";

export const runtime = "nodejs";

type Track = { id: string; title?: string; release_id?: string | null; in_rotation?: boolean };
type Kind = "release" | "track";
type Item = { kind: Kind; id: string; title: string; trackCount: number; inRotation: boolean; declarationId: string | null; societyStatus: string; societyName: string | null; grantAccepted: boolean };

const needsAnswer = (item: Item) => item.societyStatus === "not_declared" || !item.grantAccepted;

async function loadMusic(userId: string) {
  const trackResponse = await fetch(creatorUrl(`tracks?user_id=eq.${userId}&editorial_status=eq.approved&select=id,title,release_id,in_rotation&order=created_at.desc&limit=200`), { headers: creatorHeaders, cache: "no-store" });
  if (!trackResponse.ok) throw new Error("Music could not load");
  const tracks = (await trackResponse.json()) as Track[];
  const releaseIds = [...new Set(tracks.map((track) => track.release_id).filter(Boolean))] as string[];
  const singleIds = tracks.filter((track) => !track.release_id).map((track) => track.id);

  const titles = new Map<string, string>();
  if (releaseIds.length) {
    const response = await fetch(creatorUrl(`releases?id=in.(${releaseIds.join(",")})&select=id,title`), { headers: creatorHeaders, cache: "no-store" });
    if (response.ok) for (const row of (await response.json()) as Array<{ id: string; title?: string }>) titles.set(row.id, row.title || "Untitled release");
  }

  const filters = [releaseIds.length ? `release_id.in.(${releaseIds.join(",")})` : "", singleIds.length ? `track_id.in.(${singleIds.join(",")})` : ""].filter(Boolean);
  let available = true;
  // Staff spot checks and clearances stay internal: only the artist's own answer is returned.
  let declarations: RightsDeclarationRow[] = [];
  const declarationResponse = await fetch(creatorUrl(`music_rights_declarations?select=*&limit=500${filters.length ? `&or=(${filters.join(",")})` : "&id=is.null"}`), { headers: creatorHeaders, cache: "no-store" });
  if (declarationResponse.ok) declarations = (await declarationResponse.json()) as RightsDeclarationRow[];
  else available = false;

  const build = (kind: Kind, id: string, title: string, members: Track[]): Item => {
    const row = declarations.find((declaration) => (kind === "release" ? declaration.release_id === id : declaration.track_id === id));
    return {
      kind,
      id,
      title,
      trackCount: members.length,
      inRotation: members.some((track) => track.in_rotation),
      declarationId: row?.id || null,
      societyStatus: row?.society_status || "not_declared",
      societyName: row?.society_name || null,
      grantAccepted: Boolean(row?.grant_accepted_at),
    };
  };
  const items = [
    ...releaseIds.map((id) => build("release", id, titles.get(id) || "Untitled release", tracks.filter((track) => track.release_id === id))),
    ...tracks.filter((track) => !track.release_id).map((track) => build("track", track.id, track.title || "Untitled", [track])),
  ];
  return { available, items };
}

const publicItem = (item: Item) => {
  const { declarationId, ...rest } = item;
  void declarationId;
  return rest;
};

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "Sign in to see your music." }, { status: 401 });
  try {
    const { available, items } = await loadMusic(identity.user.id);
    return NextResponse.json({ available, items: items.map(publicItem), needsAnswer: items.filter(needsAnswer).length });
  } catch {
    return NextResponse.json({ error: "Your music could not load. Nothing has been changed." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity) return NextResponse.json({ error: "Sign in to confirm your music." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const declaration = cleanSocietyDeclaration(body);
  if (!declaration) return NextResponse.json({ error: "Tell us whether anyone who wrote this music is in a society." }, { status: 400 });
  if (!declaration.grantAccepted) return NextResponse.json({ error: "Confirm that you give BVS permission to stream this music." }, { status: 400 });
  const requested = Array.isArray(body.items) ? (body.items as Array<{ kind?: unknown; id?: unknown }>) : [];
  if (!requested.length || requested.length > 100) return NextResponse.json({ error: "Choose the music you want to confirm." }, { status: 400 });

  try {
    const { available, items } = await loadMusic(identity.user.id);
    if (!available) return NextResponse.json({ error: "Music confirmations aren’t open yet. Please try again soon." }, { status: 503 });
    const chosen = requested.map((entry) => items.find((item) => item.kind === entry.kind && item.id === entry.id));
    if (chosen.some((item) => !item)) return NextResponse.json({ error: "One of those items isn’t in your catalogue." }, { status: 404 });

    const now = new Date().toISOString();
    const answer = { owner_user_id: identity.user.id, society_status: declaration.societyStatus, society_name: declaration.societyName, grant_version: RIGHTS_GRANT_VERSION, grant_accepted_at: now, updated_at: now };
    const results = await Promise.all(
      (chosen as Item[]).map((item) =>
        fetch(creatorUrl(item.declarationId ? `music_rights_declarations?id=eq.${item.declarationId}` : "music_rights_declarations"), {
          method: item.declarationId ? "PATCH" : "POST",
          headers: { ...creatorHeaders, Prefer: "return=minimal" },
          body: JSON.stringify(item.declarationId ? answer : { ...answer, release_id: item.kind === "release" ? item.id : null, track_id: item.kind === "track" ? item.id : null }),
        }).then((response) => response.ok).catch(() => false),
      ),
    );
    const saved = results.filter(Boolean).length;
    if (saved !== results.length) return NextResponse.json({ error: `${saved} of ${results.length} saved. Please try the rest again.`, saved }, { status: 503 });
    return NextResponse.json({ ok: true, saved });
  } catch {
    return NextResponse.json({ error: "Your answer could not be saved. Please try again." }, { status: 503 });
  }
}
