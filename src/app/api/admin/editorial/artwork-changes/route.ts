import { NextResponse } from "next/server";
import { audit, can, editorialIdentity, editorialUrl, serviceHeaders } from "@/lib/editorial-server";
import { applyApprovedArtwork, verifyProposedArtwork, type ArtworkTargetKind } from "@/lib/artwork-change-requests";
import { safeR2Key, signedR2DownloadUrl } from "@/lib/r2-storage";

export const runtime = "nodejs";

type RequestRow = {
  id: string;
  requester_user_id: string;
  target_kind: ArtworkTargetKind;
  target_id: string;
  request_type: string;
  message: string;
  proposed_artwork_path?: string | null;
  current_artwork_path?: string | null;
  apply_to_pack_members?: boolean;
  status: string;
  staff_notes?: string | null;
  created_at: string;
};

async function json(response: Response) {
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

async function titlesFor(requests: RequestRow[]) {
  const byKey = new Map<string, string>();
  const groups: Array<{ kind: ArtworkTargetKind; table: string; titleColumn: string }> = [
    { kind: "track", table: "tracks", titleColumn: "title" },
    { kind: "release", table: "releases", titleColumn: "title" },
    { kind: "beat", table: "beats", titleColumn: "title" },
    { kind: "beat_pack", table: "beat_packs", titleColumn: "title" },
  ];
  await Promise.all(groups.map(async ({ kind, table, titleColumn }) => {
    const ids = [...new Set(requests.filter((item) => item.target_kind === kind).map((item) => item.target_id))];
    if (!ids.length) return;
    const encoded = ids.map((id) => `"${id.replaceAll('"', '')}"`).join(",");
    const rows = await json(await fetch(editorialUrl(`${table}?id=in.(${encoded})&select=id,${titleColumn}`), {
      headers: serviceHeaders,
      cache: "no-store",
    }));
    for (const row of rows as Array<Record<string, unknown>>) {
      byKey.set(`${kind}:${String(row.id)}`, String(row[titleColumn] || kind.replaceAll("_", " ")));
    }
  }));
  return byKey;
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity || !can(identity, "approve_submissions")) {
    return NextResponse.json({ error: "Editorial approval access required." }, { status: identity ? 403 : 401 });
  }
  const rows = await json(await fetch(editorialUrl("artwork_change_requests?select=*&order=created_at.desc&limit=100"), {
    headers: serviceHeaders,
    cache: "no-store",
  })) as RequestRow[];
  const titles = await titlesFor(rows);
  const requests = await Promise.all(rows.map(async (row) => ({
    ...row,
    target_title: titles.get(`${row.target_kind}:${row.target_id}`) || row.target_kind.replaceAll("_", " "),
    proposed_artwork_url: row.proposed_artwork_path && safeR2Key(row.proposed_artwork_path)
      ? await signedR2DownloadUrl(row.proposed_artwork_path, 900)
      : null,
  })));
  return NextResponse.json({ requests });
}

export async function PATCH(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity || !can(identity, "approve_submissions")) {
    return NextResponse.json({ error: "Editorial approval access required." }, { status: identity ? 403 : 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { requestId?: string; status?: string; notes?: string };
  const requestId = String(body.requestId || "").trim();
  const status = String(body.status || "").trim();
  const notes = String(body.notes || "").trim().slice(0, 3000);
  if (!requestId || !["reviewing", "resolved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Choose a valid artwork request action." }, { status: 400 });
  }
  const rows = await json(await fetch(editorialUrl(`artwork_change_requests?id=eq.${encodeURIComponent(requestId)}&select=*&limit=1`), {
    headers: serviceHeaders,
    cache: "no-store",
  })) as RequestRow[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Artwork request not found." }, { status: 404 });

  if (status === "resolved" && row.request_type === "artwork_replacement") {
    const path = String(row.proposed_artwork_path || "");
    if (!path || !(await verifyProposedArtwork(path, row.requester_user_id))) {
      return NextResponse.json({ error: "The proposed artwork file is missing or no longer valid." }, { status: 409 });
    }
    await applyApprovedArtwork({
      kind: row.target_kind,
      targetId: row.target_id,
      path,
      applyToPackMembers: row.apply_to_pack_members === true,
    });
  }

  const reviewedAt = new Date().toISOString();
  const patch = await fetch(editorialUrl(`artwork_change_requests?id=eq.${encodeURIComponent(requestId)}`), {
    method: "PATCH",
    headers: { ...serviceHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      status,
      staff_notes: notes || null,
      reviewed_by: identity.user.id,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    }),
  });
  if (!patch.ok) return NextResponse.json({ error: "Could not update artwork request." }, { status: 503 });
  await audit(identity.user.id, `artwork_change_${status}`, row.target_kind, row.target_id, {
    request_id: row.id,
    request_type: row.request_type,
    apply_to_pack_members: row.apply_to_pack_members === true,
  });
  return NextResponse.json({ ok: true });
}
