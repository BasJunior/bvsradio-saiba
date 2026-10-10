import { getPublishedArtists, getPublishedProducers } from "@/lib/artist-content";
import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import { fairDailyOrder } from "@/lib/fair-discovery-order";
import { getPublicProgrammes } from "@/lib/station-content";
import type { MobileSurface } from "@/lib/station-library";

const DISCOVERY_TIMEOUT_MS = 2200;

async function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    work.catch(() => fallback),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), DISCOVERY_TIMEOUT_MS);
    }),
  ]);
}

export default async function AppHomeDiscoverySections({ surface }: { surface: MobileSurface }) {
  const [artistRows, producerRows, shows] = await Promise.all([
    withTimeout(getPublishedArtists(), []),
    withTimeout(getPublishedProducers(), []),
    withTimeout(getPublicProgrammes(), []),
  ]);
  const artists = fairDailyOrder(artistRows, "artists");
  const producers = fairDailyOrder(producerRows, "producers");
  const base = `/app/${surface}`;

  return (
    <>
      <div data-home-accent="discover" className="bvs-app-creator-bands">
        <CreatorPortraitRail title="Artists" tone="charcoal" allHref={`${base}/explore?kind=artists`} items={artists.map(artist => ({ id: artist.id, name: artist.name, image: artist.image, href: `${base}/creator/${encodeURIComponent(artist.id)}`, detail: `${artist.trackCount} published ${artist.trackCount === 1 ? "track" : "tracks"}` }))} />
        <CreatorPortraitRail title="Producers" tone="ink" accent="purple" allHref={`${base}/explore?kind=producers`} items={producers.slice(0, 18).map(producer => ({ id: producer.id, name: producer.name, image: producer.image, href: `${base}/creator/${encodeURIComponent(producer.id)}`, detail: `${producer.beatCount} ${producer.beatCount === 1 ? "beat" : "beats"} · BeatStore` }))} />
      </div>

      <div className="bvs-app-creator-bands">
        <CreatorPortraitRail data-home-accent="shows" title="Shows" kicker="Conversations and replay moments" tone="ink" allHref={`${base}/rooms`} items={shows.map(show => ({
          id: show.slug, name: show.title, image: show.image, href: `${base}/show/${show.slug}`, detail: `${show.schedule} · ${show.tagline || show.description}`,
        }))} />
      </div>
    </>
  );
}
