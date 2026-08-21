import Link from "next/link";
import { notFound } from "next/navigation";
import AppListenHero from "@/components/app/AppListenHero";
import AppRail from "@/components/app/AppRail";
import AppSceneTrail from "@/components/app/AppSceneTrail";
import { getAppEditionBeats } from "@/lib/app-edition-data";
import { blogPosts } from "@/lib/blog";
import {
  beatToObject,
  creatorToObject,
  showToObject,
  stationTrackToObject,
  storyToObject,
  type BuildableCreator,
} from "@/lib/bvs-object-builders";
import { getPublicProgrammes } from "@/lib/station-content";
import { getStationTracks, type MobileSurface } from "@/lib/station-library";
import { appBeats, appExplore } from "@/lib/app-surface";
import { mobileCreatorSlug } from "@/lib/mobile-app";

export const dynamic = "force-dynamic";

export default async function MobileAppHomePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface: rawSurface } = await params;
  if (rawSurface !== "ios" && rawSurface !== "android") notFound();
  const surface = rawSurface as MobileSurface;
  const [tracks, beats, programmes] = await Promise.all([
    getStationTracks(surface),
    getAppEditionBeats(10),
    getPublicProgrammes(),
  ]);

  const trackObjects = tracks.map((track) => stationTrackToObject(track, {
    surface,
    availabilityLabel: "Available in the BVS app",
  }));
  const beatObjects = beats.map((beat) => beatToObject(beat, { surface }));

  const creatorMap = new Map<string, BuildableCreator>();
  for (const track of tracks) {
    const username = mobileCreatorSlug(track.artist);
    const current = creatorMap.get(username) || {
      id: `mobile-track-creator:${username}`,
      username,
      name: track.artist,
      role: "Artist",
      image: track.artwork,
      trackCount: 0,
      beatCount: 0,
    };
    current.trackCount = (current.trackCount || 0) + 1;
    if (!current.image && track.artwork) current.image = track.artwork;
    creatorMap.set(username, current);
  }
  for (const beat of beats) {
    const username = beat.producer_username || mobileCreatorSlug(beat.producer || "BVS producer");
    const current = creatorMap.get(username) || {
      id: `mobile-beat-creator:${username}`,
      username,
      name: beat.producer || "BVS producer",
      role: "Producer",
      image: beat.artworkUrl,
      trackCount: 0,
      beatCount: 0,
    };
    current.beatCount = (current.beatCount || 0) + 1;
    if (!current.image && beat.artworkUrl) current.image = beat.artworkUrl;
    creatorMap.set(username, current);
  }
  const artistObjects = [...creatorMap.values()].slice(0, 8).map((creator) => creatorToObject(creator, { surface }));
  const storyObjects = blogPosts.slice(0, 4).map(storyToObject);
  const showObjects = programmes.slice(0, 3).map(showToObject);
  const surfaceLabel = surface === "ios" ? "iPhone and iPad" : "Android";

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 pb-8 pt-5 sm:px-6">
      <AppSceneTrail />
      <AppListenHero surfaceLabel={surfaceLabel} trackCount={tracks.length} />

      {trackObjects.length ? (
        <AppRail
          eyebrow="Featured music"
          title="Cleared for this edition"
          description="Play from the card. Playback stays with you while you move."
          href={appExplore(surface, undefined)}
          hrefLabel="Explore music →"
          objects={trackObjects}
          scrollKey="app-home-tracks"
        />
      ) : (
        <section className="rounded-3xl border border-dashed border-white/15 px-6 py-10 text-center">
          <h2 className="text-2xl font-semibold">More music is on the way</h2>
          <p className="mt-2 text-sm text-text-secondary">The BVS team is preparing the next rights-cleared selection for this edition.</p>
        </section>
      )}

      <AppRail
        eyebrow="BeatStore"
        title="Beats from BVS producers"
        description="Preview here. Licence on the full BVS website listing."
        href={appBeats(surface)}
        hrefLabel="All beats →"
        objects={beatObjects}
        scrollKey="app-home-beats"
      />

      <AppRail
        eyebrow="People"
        title="Artists to know"
        href={`/app/${surface}/artists`}
        objects={artistObjects}
        scrollKey="app-home-artists"
      />

      <AppRail
        eyebrow="Programmes"
        title="Shows around the scene"
        href="/shows"
        objects={showObjects}
        variant="feature-card"
        scrollKey="app-home-shows"
      />

      <AppRail
        eyebrow="Behind the sound"
        title="Stories"
        href="/blog"
        objects={storyObjects}
        variant="compact-row"
        scrollKey="app-home-stories"
      />

      <section className="rounded-3xl border border-white/10 bg-white/[.03] px-5 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">BVS Radio</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          A focused listening edition of BVS. Accounts and library stay connected with the full site while the native listening catalogue remains rights-gated.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/app/${surface}/account`} className="rounded-full border border-white/15 px-4 py-2 text-sm">Account</Link>
          <Link href="/contact" className="rounded-full border border-white/15 px-4 py-2 text-sm">Support ↗</Link>
          <Link href="/privacy" className="rounded-full border border-white/15 px-4 py-2 text-sm">Privacy ↗</Link>
        </div>
      </section>
    </div>
  );
}
