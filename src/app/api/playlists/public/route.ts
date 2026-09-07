import { NextResponse } from "next/server";
import { serviceHeaders } from "@/lib/storage-upload";
import { mediaUrlForStoredValue } from "@/lib/media-url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type PlaylistRow = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ProfileRow = { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null };
type MembershipRow = { playlist_id: string; track_id: string; position?: number | null; added_at?: string | null };
type TrackRow = { id: string; artwork_url?: string | null; is_public?: boolean };

export async function GET() {
  if (!url || !service) return NextResponse.json({ playlists: [] });

  const playlistResponse = await fetch(
    `${url}/rest/v1/playlists?is_public=eq.true&select=id,user_id,title,description,cover_url,created_at,updated_at&order=updated_at.desc&limit=60`,
    { headers: serviceHeaders(service), cache: "no-store" },
  );
  if (!playlistResponse.ok) return NextResponse.json({ error: "Could not load public playlists." }, { status: 503 });
  const playlists = (await playlistResponse.json()) as PlaylistRow[];
  if (!playlists.length) return NextResponse.json({ playlists: [] });

  const playlistIds = playlists.map((item) => item.id).join(",");
  const userIds = Array.from(new Set(playlists.map((item) => item.user_id))).join(",");

  const [membershipResponse, profileResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/playlist_tracks?playlist_id=in.(${playlistIds})&select=playlist_id,track_id,position,added_at&order=position.asc,added_at.asc`,
      { headers: serviceHeaders(service), cache: "no-store" },
    ),
    fetch(
      `${url}/rest/v1/profiles?id=in.(${userIds})&select=id,username,display_name,avatar_url`,
      { headers: serviceHeaders(service), cache: "no-store" },
    ),
  ]);

  const memberships = membershipResponse.ok ? ((await membershipResponse.json()) as MembershipRow[]) : [];
  const profiles = profileResponse.ok ? ((await profileResponse.json()) as ProfileRow[]) : [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const trackIds = Array.from(new Set(memberships.map((item) => item.track_id)));
  let tracks: TrackRow[] = [];
  if (trackIds.length) {
    const trackResponse = await fetch(
      `${url}/rest/v1/tracks?id=in.(${trackIds.join(",")})&is_public=eq.true&select=id,artwork_url,is_public`,
      { headers: serviceHeaders(service), cache: "no-store" },
    );
    if (trackResponse.ok) tracks = (await trackResponse.json()) as TrackRow[];
  }
  const trackById = new Map(tracks.map((track) => [track.id, track]));

  const result = playlists.map((playlist) => {
    const publicMemberships = memberships.filter((item) => item.playlist_id === playlist.id && trackById.has(item.track_id));
    const profile = profileById.get(playlist.user_id);
    const firstArtwork = publicMemberships.map((item) => trackById.get(item.track_id)?.artwork_url).find(Boolean) || null;
    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description || null,
      coverUrl: mediaUrlForStoredValue(playlist.cover_url || firstArtwork),
      creator: profile?.display_name || profile?.username || "BVS listener",
      creatorUsername: profile?.username || null,
      creatorAvatar: mediaUrlForStoredValue(profile?.avatar_url),
      trackCount: publicMemberships.length,
      createdAt: playlist.created_at || null,
      updatedAt: playlist.updated_at || null,
    };
  });

  return NextResponse.json({ playlists: result });
}
