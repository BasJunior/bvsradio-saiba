import "server-only";
import { beatHeaders, beatUrl, listPublishedBeats, publicStorageUrl } from "@/lib/beatstore-server";
import { creatorPublicName } from "@/lib/public-name";
import type { BuildableBeat } from "@/lib/bvs-object-builders";

export async function getAppEditionBeats(limit = 12): Promise<BuildableBeat[]> {
  try {
    return await loadAppEditionBeats(limit);
  } catch (error) {
    console.error("getAppEditionBeats", error);
    return [];
  }
}

async function loadAppEditionBeats(limit: number): Promise<BuildableBeat[]> {
  const beats = await listPublishedBeats(limit);
  const producerIds = [...new Set(beats.map((beat) => beat.producer_user_id))];
  const response = producerIds.length
    ? await fetch(
        beatUrl(`profiles?id=in.(${producerIds.join(",")})&select=id,username,creator_public_name,creator_name_status`),
        { headers: beatHeaders, cache: "no-store" },
      )
    : null;
  const producers = response?.ok
    ? await response.json() as Array<{ id: string; username?: string; creator_public_name?: string; creator_name_status?: string }>
    : [];

  return beats.map((beat) => {
    const producer = producers.find((item) => item.id === beat.producer_user_id);
    const prices = (beat.beat_licence_options || [])
      .filter((licence) => licence.is_active !== false && !licence.is_sold_out)
      .map((licence) => Number(licence.price_usd))
      .filter((price) => Number.isFinite(price) && price > 0);
    return {
      id: beat.id,
      slug: beat.slug,
      title: beat.title,
      producer: creatorPublicName({
        publicName: producer?.creator_public_name,
        publicNameStatus: producer?.creator_name_status,
        username: producer?.username,
      }),
      producer_username: producer?.username,
      genre: beat.genre,
      mood: beat.mood,
      bpm: beat.bpm,
      musical_key: beat.musical_key,
      artworkUrl: publicStorageUrl(beat.artwork_path) || undefined,
      previewUrl: publicStorageUrl(beat.preview_path) || undefined,
      startingPrice: prices.length ? Math.min(...prices) : undefined,
    };
  });
}
