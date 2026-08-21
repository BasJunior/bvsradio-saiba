import "server-only";

import { beatHeaders, beatUrl, listPublishedBeats, publicStorageUrl, type BeatLicenceRow } from "@/lib/beatstore-server";
import { creatorPublicName } from "@/lib/public-name";
import { getStationTracks, type MobileSurface } from "@/lib/station-library";
import type { StationTrack } from "@/lib/station";

export type MobileAppBeat = {
  id: string;
  title: string;
  producer: string;
  producerSlug: string;
  description?: string;
  genre?: string;
  mood?: string;
  bpm?: number | null;
  musicalKey?: string | null;
  artworkUrl: string;
  previewUrl: string;
  startingPrice: number | null;
  licences: BeatLicenceRow[];
};

export function mobileCreatorSlug(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "bvs-creator";
}

/**
 * Mobile review surfaces only render media that resolves through this BVS origin.
 * Stored Supabase/R2 keys are converted to /api/media/* by publicStorageUrl.
 * Unknown absolute CDN URLs fail closed rather than becoming native playback.
 */
export function mobileFirstPartyMediaUrl(value?: string | null) {
  const resolved = publicStorageUrl(value);
  return resolved && resolved.startsWith("/") ? resolved : "";
}

export async function getMobileRadioTracks(surface: MobileSurface): Promise<StationTrack[]> {
  const tracks = await getStationTracks(surface);
  return tracks.filter((track) => Boolean(track.src) && track.src.startsWith("/"));
}

export async function getMobilePublishedBeats(surface: MobileSurface, limit = 48): Promise<MobileAppBeat[]> {
  // The current App Store release is iOS-only, but keep the helper surface-aware
  // so Android can adopt the same first-party boundary later.
  void surface;
  const beats = await listPublishedBeats(limit);
  const producerIds = [...new Set(beats.map((beat) => beat.producer_user_id).filter(Boolean))];
  const response = producerIds.length
    ? await fetch(
        beatUrl(`profiles?id=in.(${producerIds.join(",")})&select=id,username,creator_public_name,creator_name_status`),
        { headers: beatHeaders, cache: "no-store" },
      )
    : null;
  const producers = response?.ok
    ? await response.json() as Array<{
        id: string;
        username?: string;
        creator_public_name?: string;
        creator_name_status?: string;
      }>
    : [];

  return beats
    .map((beat) => {
      const producerRow = producers.find((item) => item.id === beat.producer_user_id);
      const producer = creatorPublicName({
        publicName: producerRow?.creator_public_name,
        publicNameStatus: producerRow?.creator_name_status,
        username: producerRow?.username,
      }) || "BVS producer";
      const licences = (beat.beat_licence_options || [])
        .filter((licence) => licence.is_active !== false && !licence.is_sold_out)
        .filter((licence) => Number.isFinite(Number(licence.price_usd)) && Number(licence.price_usd) > 0);
      const prices = licences.map((licence) => Number(licence.price_usd));

      return {
        id: beat.id,
        title: beat.title,
        producer,
        producerSlug: mobileCreatorSlug(producer),
        description: beat.description,
        genre: beat.genre,
        mood: beat.mood,
        bpm: beat.bpm,
        musicalKey: beat.musical_key,
        artworkUrl: mobileFirstPartyMediaUrl(beat.artwork_path),
        previewUrl: mobileFirstPartyMediaUrl(beat.preview_path),
        startingPrice: prices.length ? Math.min(...prices) : null,
        licences,
      } satisfies MobileAppBeat;
    })
    .filter((beat) => beat.licences.length > 0);
}
