import { NextResponse } from "next/server";
import { serviceHeaders } from "@/lib/storage-upload";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import { publicStorageUrl } from "@/lib/beatstore-server";

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
type MembershipRow = { playlist_id: string; track_id?: string | null; beat_id?: string | null; position?: number | null; added_at?: string | null };
type TrackRow = { id: string; artwork_url?: string | null; is_public?: boolean };
type BeatRow = { id: string; artwork_path?: string | null; is_public?: boolean };

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
      `${url}/rest/v1/playlist_tracks?playlist_id=in.(${playlistIds})&select=playlist_id,track_id,beat_id,position,added_at&order=position.asc,added_at.asc`,
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

  const trackIds = Array.from(new Set(memberships.map((item) => item.track_id).filter((value): value is string => Boolean(value))));
  const beatIds = Array.from(new Set(memberships.map((item) => item.beat_id).filter((value): value is string => Boolean(value))));
  const [trackResponse, beatResponse] = await Promise.all([
    trackIds.length
      ? fetch(`${url}/rest/v1/tracks?id=in.(${trackIds.join(",")})&is_public=eq.true&select=id,artwork_url,is_public`, { headers: serviceHeaders(service), cache: "no-store" })
      : null,
    beatIds.length
      ? fetch(`${url}/rest/v1/beats?id=in.(${beatIds.join(",")})&is_public=eq.true&select=id,artwork_path,is_public`, { headers: serviceHeaders(service), cache: "no-store" })
      : null,
  ]);
  const tracks = trackResponse?.ok ? ((await trackResponse.json()) as TrackRow[]) : [];
  const beats = beatResponse?.ok ? ((await beatResponse.json()) as BeatRow[]) : [];
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const beatById = new Map(beats.map((beat) => [beat.id, beat]));

  const result = playlists.map((playlist) => {
    const publicMemberships = memberships.filter((item) => item.playlist_id === playlist.id && (
      Boolean(item.track_id && trackById.has(item.track_id)) || Boolean(item.beat_id && beatById.has(item.beat_id))
    ));
    const profile = profileById.get(playlist.user_id);
    const firstArtwork = publicMemberships.map((item) => {
      if (item.track_id) return mediaUrlForStoredValue(trackById.get(item.track_id)?.artwork_url);
      if (item.beat_id) return publicStorageUrl(beatById.get(item.beat_id)?.artwork_path);
      return null;
    }).find(Boolean) || null;
    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description || null,
      coverUrl: mediaUrlForStoredValue(playlist.cover_url) || firstArtwork,
      creator: profile?.display_name || profile?.username || "BVS listener",
      creatorUsername: profile?.username || null,
      creatorAvatar: mediaUrlForStoredValue(profile?.avatar_url),
      trackCount: publicMemberships.length,
      itemCount: publicMemberships.length,
      createdAt: playlist.created_at || null,
      updatedAt: playlist.updated_at || null,
    };
  });

  return NextResponse.json({ playlists: result });
}
