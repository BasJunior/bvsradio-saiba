import { NextResponse } from "next/server";
import { creatorPublicName } from "@/lib/public-name";
import { mediaUrlForStoredValue } from "@/lib/media-url";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const supported = new Set(["creator", "track", "beat"]);

function norm(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

async function rows<T>(path: string): Promise<T[]> {
  if (!url || !key) return [];
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body) ? (body as T[]) : [];
  } catch {
    return [];
  }
}

type PublicProfile = {
  id: string;
  username: string;
  display_name?: string;
  creator_public_name?: string;
  creator_name_status?: string;
  avatar_url?: string;
  is_producer?: boolean;
};

function profileName(profile: PublicProfile) {
  return creatorPublicName({
    publicName: profile.creator_public_name,
    publicNameStatus: profile.creator_name_status,
    username: profile.username,
  });
}

async function findProfile(id: string) {
  const encoded = encodeURIComponent(id);
  const byId = await rows<PublicProfile>(`profiles?id=eq.${encoded}&is_published=eq.true&is_verified=eq.true&select=id,username,display_name,creator_public_name,creator_name_status,avatar_url,is_producer&limit=1`);
  if (byId[0]) return byId[0];
  const byUsername = await rows<PublicProfile>(`profiles?username=ilike.${encoded}&is_published=eq.true&is_verified=eq.true&select=id,username,display_name,creator_public_name,creator_name_status,avatar_url,is_producer&limit=1`);
  return byUsername[0] || null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!supported.has(kind)) return NextResponse.json({ error: "Unsupported graph node." }, { status: 404 });
  if (!url || !key) return NextResponse.json({ error: "Public graph unavailable." }, { status: 503 });

  if (kind === "creator") {
    const profile = await findProfile(id);
    if (!profile) return NextResponse.json({ error: "Creator not published." }, { status: 404 });
    const [tracks, beats] = await Promise.all([
      rows<{ id: string; title: string; genre?: string; artwork_url?: string }>(`tracks?user_id=eq.${profile.id}&is_public=eq.true&editorial_status=eq.approved&select=id,title,genre,artwork_url&order=created_at.desc&limit=30`),
      rows<{ id: string; title: string; genre?: string; artwork_path?: string }>(`beats?producer_user_id=eq.${profile.id}&is_public=eq.true&status=eq.published&select=id,title,genre,artwork_path&order=published_at.desc&limit=30`),
    ]);
    return NextResponse.json({
      node: {
        id: profile.id,
        kind: "creator",
        route: `/artist/${profile.username}`,
        title: profileName(profile),
        artwork: mediaUrlForStoredValue(profile.avatar_url) || undefined,
        verified: true,
      },
      edges: [
        ...tracks.map((track) => ({
          relationship: "performed_by",
          direction: "incoming",
          verified: true,
          node: { id: track.id, kind: "track", route: `/catalogue?q=${encodeURIComponent(track.title)}`, title: track.title, artwork: mediaUrlForStoredValue(track.artwork_url) || undefined, metadata: [track.genre].filter(Boolean) },
        })),
        ...beats.map((beat) => ({
          relationship: "offered_by",
          direction: "incoming",
          verified: true,
          node: { id: beat.id, kind: "beat", route: `/catalogue?type=beat&q=${encodeURIComponent(beat.title)}#beatstore`, title: beat.title, artwork: mediaUrlForStoredValue(beat.artwork_path) || undefined, metadata: [beat.genre].filter(Boolean) },
        })),
      ],
    });
  }

  if (kind === "beat") {
    const beats = await rows<{ id: string; title: string; genre?: string; artwork_path?: string; producer_user_id: string }>(`beats?id=eq.${encodeURIComponent(id)}&is_public=eq.true&status=eq.published&select=id,title,genre,artwork_path,producer_user_id&limit=1`);
    const beat = beats[0];
    if (!beat) return NextResponse.json({ error: "Beat not published." }, { status: 404 });
    const producer = await findProfile(beat.producer_user_id);
    return NextResponse.json({
      node: { id: beat.id, kind: "beat", route: `/catalogue?type=beat&q=${encodeURIComponent(beat.title)}#beatstore`, title: beat.title, artwork: mediaUrlForStoredValue(beat.artwork_path) || undefined, metadata: [beat.genre].filter(Boolean), verified: true },
      edges: producer ? [{ relationship: "offered_by", direction: "outgoing", verified: true, node: { id: producer.id, kind: "creator", route: `/artist/${producer.username}`, title: profileName(producer), artwork: mediaUrlForStoredValue(producer.avatar_url) || undefined } }] : [],
    });
  }

  const tracks = await rows<{ id: string; title: string; genre?: string; artwork_url?: string; user_id: string }>(`tracks?id=eq.${encodeURIComponent(id)}&is_public=eq.true&editorial_status=eq.approved&select=id,title,genre,artwork_url,user_id&limit=1`);
  const track = tracks[0];
  if (!track) return NextResponse.json({ error: "Track not published." }, { status: 404 });
  const [owner, credits, producers] = await Promise.all([
    findProfile(track.user_id),
    rows<{ person_name: string; credit_role: string }>(`track_credits?track_id=eq.${track.id}&is_verified=eq.true&select=person_name,credit_role`),
    rows<PublicProfile>("profiles?is_published=eq.true&is_verified=eq.true&is_producer=eq.true&select=id,username,display_name,creator_public_name,creator_name_status,avatar_url,is_producer&limit=200"),
  ]);
  const producerCredits = credits.filter((credit) => /producer|production/i.test(credit.credit_role));
  const matchedProducers = producerCredits.flatMap((credit) => {
    const needle = norm(credit.person_name);
    const profile = producers.find((candidate) => [profileName(candidate), candidate.display_name, candidate.username].some((name) => norm(name) === needle));
    return profile ? [{ credit, profile }] : [];
  });
  return NextResponse.json({
    node: { id: track.id, kind: "track", route: `/catalogue?q=${encodeURIComponent(track.title)}`, title: track.title, artwork: mediaUrlForStoredValue(track.artwork_url) || undefined, metadata: [track.genre].filter(Boolean), verified: true },
    edges: [
      ...(owner ? [{ relationship: "performed_by", direction: "outgoing", verified: true, node: { id: owner.id, kind: "creator", route: `/artist/${owner.username}`, title: profileName(owner), artwork: mediaUrlForStoredValue(owner.avatar_url) || undefined } }] : []),
      ...matchedProducers.map(({ credit, profile }) => ({ relationship: "produced_by", direction: "outgoing", verified: true, credit: credit.credit_role, node: { id: profile.id, kind: "creator", route: `/artist/${profile.username}`, title: profileName(profile), artwork: mediaUrlForStoredValue(profile.avatar_url) || undefined } })),
    ],
  });
}
