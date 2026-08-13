"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import AppRail from "@/components/app/AppRail";
import AppSceneTrail from "@/components/app/AppSceneTrail";
import { beatToObject, creatorToObject, releaseToObject, stationTrackToObject, storyToObject, type BuildableBeat, type BuildableTrack } from "@/lib/bvs-object-builders";
import type { AppSurface } from "@/lib/app-surface";
import type { BvsObject } from "@/lib/bvs-object";
import { blogPosts } from "@/lib/blog";

type Filter = "all" | "track" | "creator" | "beat" | "release" | "story";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "track", label: "Music" },
  { id: "creator", label: "Artists" },
  { id: "beat", label: "Beats" },
  { id: "release", label: "Releases" },
  { id: "story", label: "Stories" },
];

export default function AppExploreView({
  surface,
  tracks,
  beats,
}: {
  surface: AppSurface;
  tracks: BuildableTrack[];
  beats: BuildableBeat[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const requestedFilter = searchParams.get("type") as Filter | null;
  const filter: Filter = requestedFilter && filters.some((item) => item.id === requestedFilter) ? requestedFilter : "all";
  const [artists, setArtists] = useState<BvsObject[]>([]);
  const [releases, setReleases] = useState<BvsObject[]>([]);

  function updateExplore(nextQuery: string, nextFilter: Filter) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextFilter !== "all") params.set("type", nextFilter);
    const next = `${pathname}${params.size ? `?${params}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      router.replace(next, { scroll: false });
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/artists", { cache: "no-store" }).then((response) => response.ok ? response.json() : { artists: [] }),
      fetch("/api/releases/public", { cache: "no-store" }).then((response) => response.ok ? response.json() : { releases: [] }),
    ]).then(([artistPayload, releasePayload]) => {
      if (!active) return;
      setArtists((artistPayload.artists || []).map((artist: { id: string; username: string; name: string; role?: string; image?: string; trackCount?: number }) => creatorToObject(artist)));
      setReleases((releasePayload.releases || []).map((release: { id: string; title: string; artist?: string; cover?: string; tracks?: unknown[] }) => releaseToObject({
        id: release.id,
        title: release.title,
        artist: release.artist,
        cover: release.cover,
        trackCount: Array.isArray(release.tracks) ? release.tracks.length : undefined,
      })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const trackObjects = useMemo(() => tracks.map((track) => stationTrackToObject(track, { surface, availabilityLabel: "Available in the BVS app" })), [surface, tracks]);
  const beatObjects = useMemo(() => beats.map((beat) => beatToObject(beat, { surface })), [beats, surface]);
  const stories = useMemo(() => blogPosts.slice(0, 6).map(storyToObject), []);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (object: BvsObject) => !needle || [object.title, object.subtitle, object.contextLabel, ...(object.metadata || [])].join(" ").toLowerCase().includes(needle);
    return [
      { id: "track" as const, title: "Music", objects: trackObjects.filter(match) },
      { id: "creator" as const, title: "Artists", objects: artists.filter(match) },
      { id: "beat" as const, title: "Beats", objects: beatObjects.filter(match) },
      { id: "release" as const, title: "Releases", objects: releases.filter(match) },
      { id: "story" as const, title: "Stories", objects: stories.filter(match) },
    ].filter((group) => (filter === "all" || group.id === filter) && group.objects.length);
  }, [artists, beatObjects, filter, query, releases, stories, trackObjects]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 pt-5 sm:px-6">
      <AppSceneTrail />
      <header className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Explore</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Find the next connection.</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">Search cleared music, artists, BeatStore and stories without leaving the listening flow.</p>
      </header>

      <label className="mt-5 block">
        <span className="sr-only">Search BVS</span>
        <input
          value={query}
          onChange={(event) => updateExplore(event.target.value, filter)}
          placeholder="Search a track, artist, beat or story"
          className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-base outline-none placeholder:text-text-secondary focus:border-brand"
        />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filter explore results">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => updateExplore(query, item.id)}
            aria-pressed={filter === item.id}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm ${filter === item.id ? "bg-brand text-black" : "bg-white/5 text-text-secondary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!query.trim() && filter === "all" ? (
        <div className="mt-8 space-y-10">
          <AppRail eyebrow="On this edition" title="Play next" objects={trackObjects.slice(0, 8)} scrollKey="explore-tracks" />
          <AppRail eyebrow="People" title="Artists to know" objects={artists.slice(0, 8)} scrollKey="explore-artists" />
          <AppRail eyebrow="BeatStore" title="Fresh instrumentals" href={`/app/${surface}/beats`} objects={beatObjects.slice(0, 8)} scrollKey="explore-beats" />
          <AppRail eyebrow="Behind the sound" title="Stories" objects={stories} variant="compact-row" scrollKey="explore-stories" />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((group) => (
            <section key={group.id}>
              <h2 className="text-xl font-semibold">{group.title}</h2>
              <div className="mt-3 grid gap-3">
                {group.objects.slice(0, filter === "all" ? 6 : 40).map((object) => (
                  <BvsObjectCard key={`${object.kind}:${object.id}`} object={object} variant="compact-row" />
                ))}
              </div>
            </section>
          ))}
          {!groups.length ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
              <h2 className="text-xl font-semibold">Nothing matches that yet</h2>
              <p className="mt-2 text-sm text-text-secondary">Try another spelling or clear the filter.</p>
              <button type="button" onClick={() => updateExplore("", "all")} className="mt-5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">
                Browse everything
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
