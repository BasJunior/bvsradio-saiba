import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  beatIdentity,
  beatHeaders,
  beatUrl,
  slugifyBeat,
} from "@/lib/beatstore-server";
import { r2ObjectExists } from "@/lib/r2-storage";
import { licenceOptionSeed } from "@/lib/beat-licences";
import {
  CRATE_CHALLENGE_ACTIVE,
  crateProgress,
  crateValidation,
  instagramHandle,
  validInstagram,
  type CrateDraft,
  type CratePayload,
} from "@/lib/beat-crate";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function db(path: string, init?: RequestInit) {
  const res = await fetch(beatUrl(path), {
    ...init,
    headers: {
      ...beatHeaders,
      Prefer: "return=representation",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(
      data?.code === "23505"
        ? "This audio is already in your BeatStore. Use the existing beat instead of submitting a duplicate."
        : "Could not save your beat crate. Please retry.",
    );
  return data;
}
async function access(req: Request) {
  const who = await beatIdentity(req);
  if (!who?.user.id)
    return {
      error: NextResponse.json(
        { error: "Sign in to open your beat crate." },
        { status: 401 },
      ),
    };
  return {
    userId: who.user.id,
    producer:
      who.profile?.is_producer === true || who.profile?.role === "admin",
  };
}
function ownedPaths(payload: CratePayload, userId: string) {
  const paths = [
    payload.artworkPath,
    ...payload.items.flatMap((i) => [
      i.previewPath,
      i.masterPath,
      i.artworkPath,
    ]),
  ].filter((p): p is string => Boolean(p));
  if (
    paths.some(
      (p) =>
        !p.startsWith(`beats/${userId}/`) ||
        p.includes("..") ||
        /[?#\\]/.test(p),
    )
  )
    throw new Error("Invalid beat upload path.");
  return [...new Set(paths)];
}
export async function GET(req: Request) {
  try {
    const a = await access(req);
    if ("error" in a) return a.error;
    const params = new URL(req.url).searchParams;
    const summary = params.get("summary") === "1";
    const selected = params.get("draft");
    if (selected && !uuid.test(selected))
      return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
    const [drafts, profiles, entries, beats] = await Promise.all([
      summary
        ? Promise.resolve([])
        : db(
            `beat_upload_drafts?user_id=eq.${a.userId}${selected ? `&id=eq.${selected}` : "&state=eq.draft"}&order=updated_at.desc&limit=20`,
          ),
      db(`profiles?id=eq.${a.userId}&select=avatar_url,is_producer&limit=1`),
      db(`beat_crate_entries?user_id=eq.${a.userId}&limit=1`),
      db(
        `beats?producer_user_id=eq.${a.userId}&select=status,preview_path,submitted_at,created_at&order=created_at.asc`,
      ),
    ]);
    // An interrupted PUT may have reached storage even if the browser never got its response.
    const verified = await Promise.all(
      (drafts as CrateDraft[]).map(async (d) => {
        if (!selected || d.state === "submitted") return { ...d, received: {} };
        const paths = ownedPaths(d.payload, a.userId);
        const received = await Promise.all(
          paths.map(async (p) => [p, await r2ObjectExists(p)] as const),
        );
        return { ...d, received: Object.fromEntries(received) };
      }),
    );
    return NextResponse.json(
      {
        drafts: verified,
        progress: crateProgress(
          beats,
          profiles[0] || {},
          entries[0]?.instagram_username || "",
        ),
        producer: a.producer,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    console.error("crate load", e);
    return NextResponse.json(
      {
        error:
          "Could not load your crate. Retry before starting another upload.",
      },
      { status: 503 },
    );
  }
}
export async function PUT(req: Request) {
  try {
    const a = await access(req);
    if ("error" in a) return a.error;
    if (!a.producer)
      return NextResponse.json(
        { error: "Enable your producer profile in Studio before uploading." },
        { status: 403 },
      );
    const raw = await req.text();
    if (raw.length > 150000)
      return NextResponse.json(
        { error: "Crate details are too large." },
        { status: 413 },
      );
    const body = JSON.parse(raw);
    if (body.instagram !== undefined) {
      if (!CRATE_CHALLENGE_ACTIVE)
        return NextResponse.json({ error: "This challenge is archived." }, { status: 410 });
      const handle = instagramHandle(String(body.instagram));
      if (!validInstagram(handle))
        return NextResponse.json(
          { error: "Enter your Instagram username, without a link." },
          { status: 400 },
        );
      await db("beat_crate_entries?on_conflict=user_id", {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          user_id: a.userId,
          instagram_username: handle,
          updated_at: new Date().toISOString(),
        }),
      });
      return NextResponse.json({ ok: true, instagram: handle });
    }
    if (!uuid.test(body.id || ""))
      return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
    const p = body.payload as CratePayload;
    if (
      !p ||
      !Array.isArray(p.items) ||
      p.items.length < 1 ||
      p.items.length > 25
    )
      return NextResponse.json(
        { error: "Choose 1–25 beats per submission." },
        { status: 400 },
      );
    const normalized: CratePayload = {
      title: String(p.title || "").slice(0, 160),
      description: String(p.description || "").slice(0, 4000),
      genre: String(p.genre || "").slice(0, 80),
      rights: p.rights === true,
      challenge: CRATE_CHALLENGE_ACTIVE && p.challenge === true,
      artworkPath: p.artworkPath ? String(p.artworkPath).slice(0, 500) : null,
      artworkName: String(p.artworkName || "").slice(0, 255),
      items: p.items.map((i) => ({
        id: String(i.id),
        title: String(i.title || "").slice(0, 160),
        mood: String(i.mood || "").slice(0, 120),
        bpm: String(i.bpm || "").slice(0, 4),
        musicalKey: String(i.musicalKey || "").slice(0, 20),
        price: String(i.price || "").slice(0, 12),
        previewPath: i.previewPath ? String(i.previewPath).slice(0, 500) : null,
        masterPath: i.masterPath ? String(i.masterPath).slice(0, 500) : null,
        artworkPath: i.artworkPath ? String(i.artworkPath).slice(0, 500) : null,
        previewName: String(i.previewName || "").slice(0, 255),
        masterName: String(i.masterName || "").slice(0, 255),
        artworkName: String(i.artworkName || "").slice(0, 255),
        audioHash: /^[a-f0-9]{64}$/.test(i.audioHash || "")
          ? i.audioHash
          : undefined,
      })),
    };
    const invalid = crateValidation(normalized, false);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    ownedPaths(normalized, a.userId);
    const existing = (await db(
      `beat_upload_drafts?id=eq.${body.id}&user_id=eq.${a.userId}&limit=1`,
    )) as CrateDraft[];
    if (existing[0]?.state === "submitted")
      return NextResponse.json(
        {
          error: "This crate was already submitted. Start a new upload.",
          result: existing[0].result,
        },
        { status: 409 },
      );
    if (existing[0] && body.updatedAt !== existing[0].updated_at)
      return NextResponse.json(
        {
          error:
            "This crate changed in another tab. Reload before continuing; completed uploads are kept.",
        },
        { status: 409 },
      );
    const data = { payload: normalized, updated_at: new Date().toISOString() };
    const rows = existing.length
      ? await db(
          `beat_upload_drafts?id=eq.${body.id}&user_id=eq.${a.userId}&state=eq.draft&updated_at=eq.${encodeURIComponent(body.updatedAt)}`,
          { method: "PATCH", body: JSON.stringify(data) },
        )
      : await db("beat_upload_drafts", {
          method: "POST",
          body: JSON.stringify({ ...data, id: body.id, user_id: a.userId }),
        });
    if (!rows?.[0])
      return NextResponse.json(
        { error: "Draft changed. Reload your crate." },
        { status: 409 },
      );
    return NextResponse.json({ draft: rows[0] });
  } catch (e) {
    console.error("crate save", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save draft." },
      { status: 400 },
    );
  }
}
export async function POST(req: Request) {
  try {
    const a = await access(req);
    if ("error" in a) return a.error;
    if (!a.producer)
      return NextResponse.json(
        { error: "Producer profile required." },
        { status: 403 },
      );
    const { id } = await req.json();
    if (!uuid.test(id || ""))
      return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
    const [d] = (await db(
      `beat_upload_drafts?id=eq.${id}&user_id=eq.${a.userId}&limit=1`,
    )) as CrateDraft[];
    if (!d)
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    if (d.state === "submitted")
      return NextResponse.json({ ok: true, result: d.result, recovered: true });
    const invalid = crateValidation(d.payload, true);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    if (CRATE_CHALLENGE_ACTIVE && d.payload.challenge) {
      const [p] = await db(
        `profiles?id=eq.${a.userId}&select=avatar_url&limit=1`,
      );
      const entries = await db(
        `beat_crate_entries?user_id=eq.${a.userId}&limit=1`,
      );
      if (
        !p?.avatar_url ||
        /default-avatar|placeholder/i.test(p.avatar_url) ||
        !entries.length
      )
        return NextResponse.json(
          {
            error:
              "Add a profile picture and save your Instagram username before submitting a challenge entry.",
          },
          { status: 400 },
        );
    }
    const paths = ownedPaths(d.payload, a.userId);
    const received = await Promise.all(paths.map((p) => r2ObjectExists(p)));
    if (received.some((v) => !v))
      return NextResponse.json(
        {
          error:
            "Some files have not arrived yet. Retry the missing files; your completed uploads are saved.",
        },
        { status: 400 },
      );
    const items = d.payload.items.map((i, index) => ({
      ...i,
      title: i.title.trim(),
      slug: `${slugifyBeat(i.title) || "beat"}-${randomUUID().slice(0, 8)}-${index + 1}`,
      bpm: i.bpm ? String(Math.round(Number(i.bpm))) : "",
      artworkPath: i.artworkPath || d.payload.artworkPath,
      licence: licenceOptionSeed("standard_lease", Number(i.price)),
    }));
    const result = await db("rpc/finalize_beat_upload", {
      method: "POST",
      body: JSON.stringify({
        p_user_id: a.userId,
        p_draft_id: id,
        p_updated_at: d.updated_at,
        p_items: items,
      }),
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("crate finalize", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not submit. Your draft is saved.",
      },
      { status: 503 },
    );
  }
}
