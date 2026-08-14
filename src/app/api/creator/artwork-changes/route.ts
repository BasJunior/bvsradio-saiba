import { NextResponse } from "next/server";
import { creatorHeaders, creatorIdentity, creatorJson, creatorUrl } from "@/lib/creator-server";
import {
  assertOwnsArtworkTarget,
  isArtworkRequestType,
  listOwnedArtworkTargets,
  verifyProposedArtwork,
  type ArtworkTargetKind,
} from "@/lib/artwork-change-requests";

export const runtime = "nodejs";

const clean = (value: unknown, max = 3000) => String(value || "").trim().slice(0, max);

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id || !identity.profile) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (identity.profile.role === "listener" && !identity.profile.is_producer) {
    return NextResponse.json({ error: "Creator access required." }, { status: 403 });
  }
  const scopeParam = new URL(request.url).searchParams.get("scope") || "all";
  const scope = scopeParam === "releases" || scopeParam === "beats" ? scopeParam : "all";
  const [targets, requests] = await Promise.all([
    listOwnedArtworkTargets(identity.user.id, scope),
    creatorJson(
      await fetch(
        creatorUrl(
          `artwork_change_requests?requester_user_id=eq.${identity.user.id}&select=*&order=created_at.desc&limit=40`,
        ),
        { headers: creatorHeaders, cache: "no-store" },
      ),
    ).catch(() => []),
  ]);
  return NextResponse.json({ targets, requests });
}

export async function POST(request: Request) {
  try {
    const identity = await creatorIdentity(request);
    if (!identity?.user?.id || !identity.profile) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    if (identity.profile.role === "listener" && !identity.profile.is_producer) {
      return NextResponse.json({ error: "Creator access required." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const targetId = clean(body.targetId, 80);
    const targetKind = clean(body.targetKind, 20) as ArtworkTargetKind;
    const requestType = clean(body.requestType, 40);
    const message = clean(body.message, 3000);
    const proposedArtworkPath = clean(body.proposedArtworkPath, 500);
    const applyToPackMembers = body.applyToPackMembers === true;
    if (!targetId || !["track", "release", "beat", "beat_pack"].includes(targetKind)) {
      return NextResponse.json({ error: "Select one of your releases, beats or packs." }, { status: 400 });
    }
    if (!isArtworkRequestType(requestType)) {
      return NextResponse.json({ error: "Choose a valid change request." }, { status: 400 });
    }
    if (message.length < 8) {
      return NextResponse.json({ error: "Add a short note for editorial." }, { status: 400 });
    }
    const owned = await assertOwnsArtworkTarget(identity.user.id, targetKind, targetId);
    if (!owned) {
      return NextResponse.json({ error: "You can request changes only for your own uploads." }, { status: 403 });
    }
    if (requestType === "artwork_replacement") {
      if (!proposedArtworkPath || !(await verifyProposedArtwork(proposedArtworkPath, identity.user.id))) {
        return NextResponse.json({ error: "Upload the new cover image first." }, { status: 400 });
      }
    }
    const data = await creatorJson(
      await fetch(creatorUrl("artwork_change_requests"), {
        method: "POST",
        headers: { ...creatorHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          requester_user_id: identity.user.id,
          target_kind: targetKind,
          target_id: targetId,
          request_type: requestType,
          message,
          proposed_artwork_path: proposedArtworkPath || null,
          current_artwork_path: owned.currentArtwork,
          apply_to_pack_members: targetKind === "beat_pack" && applyToPackMembers,
          status: "open",
        }),
      }),
    );
    if (!data[0]) {
      return NextResponse.json({ error: "Could not save the change request." }, { status: 503 });
    }
    return NextResponse.json({ item: data[0] });
  } catch (error) {
    console.error("artwork change create", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the change request." },
      { status: 500 },
    );
  }
}
