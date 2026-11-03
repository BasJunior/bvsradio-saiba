"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StationTrack } from "@/lib/station";
import { useStationPlayer } from "@/components/StationPlayer";

type Beat = { id: string; title: string; producer_user_id: string; producer?: string; artworkUrl?: string; previewUrl?: string; connected?: boolean };

type Artist = {
  username: string;
  name: string;
  role: string;
  bio: string;
  image: string;
};

// Shuffle a fresh copy once per catalogue load, never during rendering.
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default function HomeArtistNote() {
  const player = useStationPlayer();
  const [artists, setArtists] = useState<Artist[]>([]);
  const currentArtist = player.current?.artist || "";
  const currentId = player.current?.id;
  const [catalogue, setCatalogue] = useState<{ key: string; tracks: StationTrack[]; beats: Beat[]; failed: boolean } | null>(null);
  const catalogueKey = `${currentId || ""}:${currentArtist}`;

  // Resolve the recording's verified creators, then load their public, approved catalogue.
  // Key results to the recording so a slow request cannot show the previous artist's songs.
  useEffect(() => {
    if (!currentId) return;
    let active = true;
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 10000);
    const load = async () => {
      try {
        const graphResponse = await fetch(`/api/graph/track/${encodeURIComponent(currentId)}`, { signal: controller.signal });
        if (!graphResponse.ok) throw new Error("Catalogue unavailable");
        const graph = await graphResponse.json() as { edges?: { verified?: boolean; relationship: string; node: { id: string; kind: string } }[] };
        const edges = (graph.edges || []).filter(edge => edge.verified && edge.node.kind === "creator");
        const creators = [...new Set(edges.filter(edge => edge.relationship === "performed_by").map(edge => edge.node.id))];
        const producers = [...new Set(edges.filter(edge => edge.relationship === "produced_by").map(edge => edge.node.id))];
        const fetchJson = async (url: string) => {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error("Catalogue unavailable");
          return response.json();
        };
        // One unavailable catalogue must not hide the other creators' recommendations.
        const [songs, producerBeats] = await Promise.all([
          Promise.allSettled(creators.map(id => fetchJson(`/api/app/creator/${encodeURIComponent(id)}/tracks`))),
          Promise.allSettled(producers.map(id => fetchJson(`/api/beats?producer_user_id=${encodeURIComponent(id)}&limit=6`))),
        ]);
        const tracks = [...new Map(songs.flatMap(result => result.status === "fulfilled" ? (result.value.tracks || []) as StationTrack[] : [])
          .filter(track => track.id !== currentId && track.src).map(track => [track.id || track.src, track])).values()];
        let beats = [...new Map(producerBeats.flatMap((result, index) => result.status === "fulfilled"
          ? ((result.value.beats || []) as Beat[]).filter(beat => beat.producer_user_id === producers[index]) : []).map(beat => [beat.id, beat])).values()];
        beats = beats.map(beat => ({ ...beat, connected: true }));
        // Fill remaining places with discoveries without implying a song credit.
        if (tracks.length + beats.length < 6) {
          const discovery = await fetchJson("/api/beats?limit=120").catch(() => null);
          const existing = new Set(beats.map(beat => beat.id));
          beats = [...beats, ...shuffled(((discovery?.beats || []) as Beat[]).filter(beat => !existing.has(beat.id)))];
        }
        if (active) setCatalogue({ key: catalogueKey, tracks, beats, failed: [...songs, ...producerBeats].some(result => result.status === "rejected") });
      } catch {
        if (active) setCatalogue({ key: catalogueKey, tracks: [], beats: [], failed: true });
      } finally { window.clearTimeout(deadline); }
    };
    void load();
    return () => { active = false; controller.abort(); window.clearTimeout(deadline); };
  }, [currentId, catalogueKey]);

  const catalogueReady = catalogue?.key === catalogueKey;
  // Reserve one place for a connected producer, then fill all six places.
  const moreTracks = catalogueReady ? catalogue.tracks.slice(0, catalogue.beats.some(beat => beat.connected) ? 5 : 6) : [];
  const moreBeats = catalogueReady ? catalogue.beats.slice(0, 6 - moreTracks.length) : [];

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 10000);
    fetch("/api/artists?limit=24", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ artists?: Artist[] }> : Promise.reject())
      .then((payload) => {
        if (active) setArtists(Array.isArray(payload?.artists) ? payload.artists.filter(item => item && typeof item.name === "string" && typeof item.username === "string") : []);
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(deadline));
    return () => { active = false; window.clearTimeout(deadline); controller.abort(); };
  }, []);

  const artist = useMemo(() => {
    const target = normalize(currentArtist.split(/\s*(?:,|feat\.?|ft\.?|&)\s*/i)[0] || currentArtist);
    if (!target) return null;
    return artists.find((item) => {
      const name = normalize(item.name);
      return Boolean(name) && name === target;
    }) || null;
  }, [artists, currentArtist]);

  if (!player.current) return null;

  return (
    <section className="mt-4 flex min-h-[232px] flex-col rounded-2xl border border-white/10 bg-black/10 p-4 sm:p-5" aria-labelledby="home-artist-note-title">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- live artist portrait */}
        {artist?.image ? <img src={artist.image} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-2xl object-cover" /> : null}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Behind the sound</p>
          <h2 id="home-artist-note-title" className="mt-1 truncate text-base font-semibold">{artist?.name || player.current.artist}</h2>
          <p className="text-xs text-text-secondary">{artist?.role || "Independent sound on BVS"}</p>
        </div>
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-white/55">More to explore</p>
      <div className="mt-2 grid flex-1 auto-rows-fr gap-1" aria-live="polite">
        {moreTracks.map(track => (
          <button key={track.id || track.src} type="button" onClick={() => player.playNow(track, { from: `${currentArtist} catalogue`, related: catalogue?.tracks.filter(item => item.src !== track.src) })}
            aria-label={`Play ${track.title} by ${track.artist}`}
            className="group flex min-h-14 items-center gap-3 border-b border-white/10 py-2 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand">
            <span aria-hidden="true" className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden bg-white/5 text-xs text-brand">
              {/* eslint-disable-next-line @next/next/no-img-element -- catalogue artwork */}
              {track.artwork ? <img src={track.artwork} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}
              <span className="relative bg-black/65 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">▶</span>
            </span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold group-hover:text-brand">{track.title}</span><span className="block truncate text-xs text-text-secondary">{track.artist}</span></span>
          </button>
        ))}
        {moreBeats.map(beat => (
          <div key={beat.id} className="flex items-center gap-3 border-b border-white/10 py-2">
            <button type="button" disabled={!beat.previewUrl} aria-label={`Preview ${beat.title} by ${beat.producer || "BVS producer"}`}
              onClick={() => { if (beat.previewUrl) player.playNow({ id: beat.id, title: beat.title, artist: beat.producer || "BVS producer", src: beat.previewUrl, artwork: beat.artworkUrl, kind: "beat", project: "BVS BeatStore" }, { from: "Behind the sound · BeatStore" }); }}
              className="group relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden bg-white/5 text-xs text-brand disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand">
              {/* eslint-disable-next-line @next/next/no-img-element -- catalogue artwork */}
              {beat.artworkUrl ? <img src={beat.artworkUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}
              {beat.previewUrl ? <span aria-hidden="true" className="relative bg-black/65 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">▶</span> : null}
            </button>
            <Link href={`/catalogue?type=beat&q=${encodeURIComponent(beat.title)}#beatstore`} className="min-w-0 flex-1 py-1 hover:text-brand">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-brand">{beat.connected ? "From this song’s producer · Beat" : "Discover BeatStore · Beat"}</span>
              <span className="block truncate text-sm font-semibold">{beat.title}</span>
              <span className="block truncate text-xs text-text-secondary">{beat.producer || "BVS producer"}</span>
            </Link>
          </div>
        ))}
        {!moreTracks.length && !moreBeats.length ? <p className="py-3 text-sm text-white/60">{!currentId ? "Artist catalogue is unavailable for this recording." : !catalogueReady ? "Loading artist catalogue…" : catalogue.failed ? "Artist catalogue is temporarily unavailable." : "No other published songs from this artist yet."}</p> : null}
      </div>
      {artist ? (
        <Link href={`/artist/${encodeURIComponent(artist.username)}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">
          View artist profile →
        </Link>
      ) : null}
    </section>
  );
}
