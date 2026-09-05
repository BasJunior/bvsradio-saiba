"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppDownloadButton from "@/components/app-vnext/AppDownloadButton";
import AppPlaylistPicker from "@/components/app-vnext/AppPlaylistPicker";
import { useStationPlayer } from "@/components/StationPlayer";
import { hasLibraryItem, recordListening, toggleLibraryItem } from "@/lib/library";

type CatalogueTrack = { id: string; title: string; artist: string; src: string; genre?: string; artwork?: string; project?: string; playCount?: number };
type Artist = { id: string; username: string; name: string; role?: string; image?: string; genres?: string[] };
type Producer = { id: string; username: string; name: string; image?: string; genres?: string[]; beatCount?: number };
type Beat = { id: string; title: string; producer?: string; producer_username?: string; genre?: string; mood?: string; artworkUrl?: string; previewUrl?: string; bpm?: number; startingPrice?: number };
type ExploreKind = "all" | "music" | "artists" | "producers" | "beats";
type ExploreMode = "fresh" | "rotation" | "creators" | "beats";

const exploreModes: Array<{ value: ExploreMode; label: string; description: string }> = [
  { value: "fresh", label: "New & notable", description: "Fresh music and creators moving through BVS right now." },
  { value: "rotation", label: "Playing now", description: "Music available to play instantly in the app." },
  { value: "creators", label: "Creators", description: "Meet the artists and producers behind the sound." },
  { value: "beats", label: "BeatStore", description: "Find production you can build on, then open licensing when you’re ready." },
];

function safeImage(value?: string) {
  if (!value || value.includes("default-avatar")) return "";
  if (/^(https?:\/\/|\/)/.test(value)) return value;
  return `/api/media/${value.split("/").map(encodeURIComponent).join("/")}`;
}

export default function AppExploreClient({
  surface,
  initialQuery = "",
  initialKind = "all",
}: {
  surface: AppSurface;
  initialQuery?: string;
  initialKind?: ExploreKind;
}) {
  const player = useStationPlayer();
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState<ExploreKind>(initialKind);
  const [mode, setMode] = useState<ExploreMode>("fresh");
  const [tracks, setTracks] = useState<CatalogueTrack[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const nextMode = params.get("mode") as ExploreMode | null;
      if (nextMode && exploreModes.some((item) => item.value === nextMode)) setMode(nextMode);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/station/tracks?surface=${surface}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : { tracks: [] }),
      fetch("/api/artists", { cache: "no-store" }).then((r) => r.ok ? r.json() : { artists: [] }),
      fetch("/api/producers", { cache: "no-store" }).then((r) => r.ok ? r.json() : { producers: [] }),
      fetch("/api/beats", { cache: "no-store" }).then((r) => r.ok ? r.json() : { beats: [] }),
    ]).then(([station, artistData, producerData, beatData]) => {
      if (!alive) return;
      setTracks(station.tracks || []);
      setArtists(artistData.artists || []);
      setProducers(producerData.producers || []);
      setBeats(beatData.beats || []);
      setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [surface]);

  useEffect(() => {
    const sync = () => setLiked(new Set(tracks.filter((track) => hasLibraryItem("favourites", track.id)).map((track) => track.id)));
    sync();
    window.addEventListener("bvs:library-change", sync);
    return () => window.removeEventListener("bvs:library-change", sync);
  }, [tracks]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const matches = (parts: Array<string | undefined | string[]>) => !needle || parts.flat().filter(Boolean).join(" ").toLowerCase().includes(needle);
    return {
      tracks: tracks.filter((i) => matches([i.title, i.artist, i.genre, i.project])).slice(0, needle ? 30 : 10),
      artists: artists.filter((i) => matches([i.name, i.role, i.genres])).slice(0, needle ? 24 : 8),
      producers: producers.filter((i) => matches([i.name, i.genres])).slice(0, needle ? 24 : 8),
      beats: beats.filter((i) => matches([i.title, i.producer, i.genre, i.mood])).slice(0, needle ? 24 : 8),
    };
  }, [artists, beats, needle, producers, tracks]);

  const show = (value: ExploreKind) => {
    if (kind !== "all") return kind === value;
    if (needle || mode === "fresh") return true;
    if (mode === "rotation") return value === "music";
    if (mode === "creators") return value === "artists" || value === "producers";
    return value === "beats";
  };
  const activeMode = exploreModes.find((item) => item.value === mode) || exploreModes[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (kind !== "all") params.set("kind", kind);
      if (!query.trim() && mode !== "fresh") params.set("mode", mode);
      window.history.replaceState(window.history.state, "", `/app/${surface}/explore${params.size ? `?${params}` : ""}`);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [kind, mode, query, surface]);

  const play = (item: CatalogueTrack) => {
    player.playNow(item, { from: "Discover", related: filtered.tracks.filter((track) => track.id !== item.id) });
    player.setQueueOpen(false);
    player.openNowPlaying();
    recordListening({ id: item.id, kind: "track", title: item.title, subtitle: item.artist, href: "/radio", image: item.artwork });
  };

  const playAll = () => {
    if (!filtered.tracks.length) return;
    player.playAll(filtered.tracks, { from: query.trim() ? `Discover · ${query.trim()}` : "Discover" });
    player.setQueueOpen(false);
    player.openNowPlaying();
    const first = filtered.tracks[0];
    recordListening({ id: first.id, kind: "track", title: first.title, subtitle: first.artist, href: "/radio", image: first.artwork });
  };

  const toggleLike = (item: CatalogueTrack) => {
    const saved = toggleLibraryItem("favourites", { id: item.id, kind: "track", title: item.title, subtitle: item.artist, href: "/radio", image: item.artwork });
    setLiked((current) => {
      const next = new Set(current);
      if (saved) next.add(item.id); else next.delete(item.id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Discover</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">Find your next favourite before everyone else does.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">Music, artists, producers and beats — connected by the people making them.</p>

      <label className="relative mt-7 block">
        <span className="sr-only">Search BVS</span>
        <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-lg text-white/35" aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search music, artists, producers, beats"
          className="min-h-14 w-full rounded-[1.25rem] border border-white/[.08] bg-white/[.035] pl-12 pr-5 text-base outline-none backdrop-blur-xl transition focus:border-brand/40 focus:bg-white/[.05]"
        />
      </label>

      {!query.trim() ? (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Discovery modes">
          {exploreModes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              aria-pressed={mode === item.value}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm transition ${mode === item.value ? "bg-white font-semibold text-black" : "border border-white/[.08] bg-white/[.025] text-white/48 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex gap-2 overflow-x-auto pb-2" aria-label="Filter discovery results">
        {(["all", "music", "artists", "producers", "beats"] as ExploreKind[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            aria-pressed={kind === value}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm capitalize transition ${kind === value ? "bg-brand font-semibold text-black" : "text-white/42 hover:bg-white/[.035] hover:text-white/75"}`}
          >
            {value === "all" ? "Everything" : value}
          </button>
        ))}
      </div>

      {!query.trim() && kind === "all" ? (
        <section className="mt-6 rounded-[1.55rem] border border-white/[.07] bg-gradient-to-br from-brand/[.075] to-white/[.018] p-5" aria-live="polite">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">{activeMode.label}</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold">{activeMode.description}</h2>
        </section>
      ) : null}

      {loading ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-[1.4rem] bg-white/[.035]" />
          <div className="h-28 animate-pulse rounded-[1.4rem] bg-white/[.035]" />
        </div>
      ) : null}

      {show("music") && filtered.tracks.length ? (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Music</p>
              <h2 className="mt-2 text-3xl font-semibold">Ready to play.</h2>
              <p className="mt-2 text-xs text-white/38">Availability follows BVS rights and platform permissions.</p>
            </div>
            <button type="button" onClick={playAll} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-brand">▶ Play {query.trim() ? "results" : "all"}</button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {filtered.tracks.map((item) => {
              const image = safeImage(item.artwork);
              const isLiked = liked.has(item.id);
              return (
                <article key={item.id} className="group flex min-w-0 gap-3 rounded-[1.35rem] border border-white/[.07] bg-white/[.025] p-3 transition hover:border-white/15 hover:bg-white/[.04]">
                  <button type="button" onClick={() => play(item)} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[1rem] bg-white/[.04]" aria-label={`Play ${item.title}`}>
                    {image ? <Image src={image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-brand">BVS</span>}
                    <span className="absolute inset-0 grid place-items-center bg-black/20 text-lg text-white opacity-80 transition group-hover:opacity-100">▶</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => play(item)} className="block w-full text-left">
                      <h3 className="truncate font-semibold">{item.title}</h3>
                      <p className="truncate text-sm text-white/48">{item.artist}</p>
                      <p className="mt-1 text-xs text-white/30">{item.genre || item.project || "BVS release"}</p>
                    </button>
                    <div className="mt-2 flex flex-wrap items-start gap-2">
                      <button type="button" onClick={() => play(item)} className="min-h-9 rounded-full bg-brand px-3 text-xs font-semibold text-black">Play</button>
                      <button type="button" onClick={() => toggleLike(item)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${isLiked ? "border-brand/35 bg-brand/10 text-brand" : "border-white/12 text-white/45"}`}>{isLiked ? "♥ Liked" : "♡ Like"}</button>
                      <AppPlaylistPicker trackId={item.id} compact />
                      <AppDownloadButton trackId={item.id} surface={surface} compact />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {show("artists") && filtered.artists.length ? (
        <section className="mt-11">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Artists</p>
          <h2 className="mt-2 text-3xl font-semibold">Names to know.</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {filtered.artists.map((item) => {
              const image = safeImage(item.image);
              return (
                <Link key={item.id} href={`/app/${surface}/creator/${item.username}`} className="group rounded-[1.35rem] border border-white/[.07] bg-white/[.025] p-2.5 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[.04]">
                  {image ? <div className="relative aspect-square overflow-hidden rounded-[1rem]"><Image src={image} alt="" fill unoptimized className="object-cover transition duration-500 group-hover:scale-[1.02]" /></div> : <div className="grid aspect-square place-items-center rounded-[1rem] bg-white/[.035] text-[10px] font-semibold uppercase tracking-[.15em] text-brand">Artist</div>}
                  <h3 className="mt-3 truncate px-1 font-semibold">{item.name}</h3>
                  <p className="truncate px-1 pb-1 text-xs text-white/36">{item.role || "BVS artist"}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {show("producers") && filtered.producers.length ? (
        <section className="mt-11">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Producers</p>
          <h2 className="mt-2 text-3xl font-semibold">Meet the people behind the sound.</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {filtered.producers.map((item) => (
              <Link key={item.id} href={`/app/${surface}/creator/${item.username}?as=producer`} className="rounded-[1.35rem] border border-white/[.07] bg-white/[.025] p-4 transition hover:border-white/15 hover:bg-white/[.04]">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">Producer</p>
                <h3 className="mt-3 truncate text-lg font-semibold">{item.name}</h3>
                <p className="mt-1 text-xs text-white/36">{item.beatCount || 0} published beat{item.beatCount === 1 ? "" : "s"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {show("beats") && filtered.beats.length ? (
        <section className="mt-11">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">BeatStore</p>
          <h2 className="mt-2 text-3xl font-semibold">Find the start of your next record.</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {filtered.beats.map((item) => (
              <article key={item.id} className="rounded-[1.35rem] border border-white/[.07] bg-white/[.025] p-4 transition hover:border-white/15">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-white/46">{item.producer || "BVS producer"}</p>
                <p className="mt-1 text-xs text-white/32">{[item.genre, item.mood, item.bpm ? `${item.bpm} BPM` : ""].filter(Boolean).join(" · ")}</p>
                {item.previewUrl ? <audio controls preload="none" src={item.previewUrl} className="mt-3 h-10 w-full" /> : null}
                <Link href={`/app/${surface}/beat/${item.id}`} className="mt-3 inline-flex min-h-10 items-center rounded-full border border-brand/30 px-4 text-sm font-semibold text-brand transition hover:bg-brand/10">Open beat</Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !filtered.tracks.length && !filtered.artists.length && !filtered.producers.length && !filtered.beats.length ? (
        <div className="mt-10 rounded-[1.5rem] border border-dashed border-white/12 p-10 text-center">
          <h2 className="text-xl font-semibold">Nothing here yet.</h2>
          <p className="mt-2 text-sm text-white/40">Try another artist, track, genre, producer or beat.</p>
        </div>
      ) : null}
    </div>
  );
}
