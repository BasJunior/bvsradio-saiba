"use client";

import DiscoverMoreActions from "@/components/DiscoverMoreActions";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppBeatPreviewPlayer from "@/components/app-vnext/AppBeatPreviewPlayer";
import AppDownloadButton from "@/components/app-vnext/AppDownloadButton";
import AppPlaylistPicker from "@/components/app-vnext/AppPlaylistPicker";
import { useStationPlayer } from "@/components/StationPlayer";
import { fairCreatorDailyOrder } from "@/lib/fair-discovery-order";
import { soundKey, discoveryCreatorKey } from "@/lib/discovery-experience";
import { trackEvent } from "@/lib/analytics";
import { hasLibraryItem, recordListening, toggleLibraryItem } from "@/lib/library";

type CatalogueTrack = { id: string; title: string; artist: string; src: string; genre?: string; artwork?: string; project?: string; playCount?: number };
type Artist = { id: string; username: string; name: string; role?: string; image?: string; genres?: string[] };
type Producer = { id: string; username: string; name: string; image?: string; genres?: string[]; beatCount?: number };
type Beat = { id: string; title: string; producer?: string; producer_username?: string; genre?: string; mood?: string; artworkUrl?: string; previewUrl?: string; bpm?: number; startingPrice?: number };
type ExploreKind = "all" | "music" | "artists" | "producers" | "beats";
type ExploreMode = "fresh" | "rotation" | "creators" | "beats";

const exploreModes: Array<{ value: ExploreMode; label: string; description: string }> = [
  { value: "fresh", label: "Discover", description: "A rotating selection of sounds and people to explore." },
  { value: "rotation", label: "Music", description: "Music available to play instantly in the app." },
  { value: "creators", label: "Creators", description: "Meet the artists and producers behind the sound." },
  { value: "beats", label: "BeatStore", description: "Find production you can build on, then open licensing when you’re ready." },
];

function safeImage(value?: string) {
  if (!value || value.includes("default-avatar")) return "";
  if (/^(https?:\/\/|\/)/.test(value)) return value;
  return `/api/media/${value.split("/").map(encodeURIComponent).join("/")}`;
}

function ExploreArtwork({ src, label, sizes = "(max-width: 640px) 45vw, 240px" }: { src?: string; label: string; sizes?: string }) {
  const image = safeImage(src);
  const [failedSrc, setFailedSrc] = useState("");
  return <div className="relative aspect-square overflow-hidden rounded-[1rem] bg-gradient-to-br from-brand/15 to-white/[.035]">
    {image && failedSrc !== image ? <Image src={image} alt="" fill sizes={sizes} unoptimized className="object-cover transition duration-500 group-hover:scale-[1.02]" onError={() => setFailedSrc(image)} /> : <span className="absolute inset-0 grid place-items-center text-xs font-semibold uppercase tracking-wider text-brand">{label}</span>}
  </div>;
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
  const [unavailable, setUnavailable] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [genre, setGenre] = useState("");
  const [round, setRound] = useState(0);
  const [limit, setLimit] = useState(24);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") || "");
      const nextKind = params.get("kind");
      setKind((["all", "music", "artists", "producers", "beats"] as string[]).includes(nextKind || "") ? nextKind as ExploreKind : "all");
      setGenre(soundKey(params.get("genre") || ""));
      const nextMode = params.get("mode") as ExploreMode | null;
      setMode(nextMode && exploreModes.some((item) => item.value === nextMode) ? nextMode : "fresh");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const sources: Array<{ url: string; apply: (data: Record<string, unknown>) => void }> = [
      { url:`/api/station/tracks?surface=${surface}`, apply:data => setTracks(((data.tracks || []) as CatalogueTrack[]).filter(track => Boolean(track.src))) },
      { url:"/api/artists", apply:data => setArtists((data.artists || []) as Artist[]) },
      { url:"/api/producers", apply:data => setProducers((data.producers || []) as Producer[]) },
      { url:"/api/beats", apply:data => setBeats((data.beats || []) as Beat[]) },
    ];
    void Promise.allSettled(sources.map(async source => {
      const response = await fetch(source.url, { cache:"no-store", signal:controller.signal });
      if (!response.ok) throw new Error("Discovery source unavailable");
      const data = await response.json();
      if (alive) source.apply(data);
    })).then(outcomes => {
      if (!alive) return;
      setUnavailable(outcomes.some(outcome => outcome.status === "rejected"));
      setLoading(false);
    });
    return () => { alive = false; controller.abort(); };
  }, [surface, loadAttempt]);

  useEffect(() => {
    const sync = () => setLiked(new Set(tracks.filter((track) => hasLibraryItem("favourites", track.id)).map((track) => track.id)));
    sync();
    window.addEventListener("bvs:library-change", sync);
    return () => window.removeEventListener("bvs:library-change", sync);
  }, [tracks]);

  const needle = query.trim().toLowerCase();
  const sounds = useMemo(() => {
    const counts = new Map<string, number>();
    const values = [...tracks.map(item => item.genre), ...beats.map(item => item.genre), ...artists.flatMap(item => item.genres || []), ...producers.flatMap(item => item.genres || [])];
    for (const value of values) for (const part of (value || "").split(/[,/|]/)) {
      const key = soundKey(part); if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([key]) => ({ key, label:key === "hip-hop" ? "Hip-Hop" : key === "r&b" ? "R&B" : key.replace(/\b\w/g, c => c.toUpperCase()) }));
  }, [tracks, beats, artists, producers]);
  const matched = useMemo(() => {
    const matches = (parts: Array<string | undefined | string[]>) => !needle || parts.flat().filter(Boolean).join(" ").toLowerCase().includes(needle);
    const matchesGenre = (genres: Array<string | undefined>) => !genre || genres.flatMap(value => (value || "").split(/[,/|]/)).some(value => soundKey(value) === genre);
    return {
      tracks:tracks.filter(i => matches([i.title, i.artist, i.genre, i.project]) && matchesGenre([i.genre])),
      artists:artists.filter(i => matches([i.name, i.role, i.genres]) && matchesGenre(i.genres || [])),
      producers:producers.filter(i => matches([i.name, i.genres]) && matchesGenre(i.genres || [])),
      beats:beats.filter(i => matches([i.title, i.producer, i.genre, i.mood]) && matchesGenre([i.genre])),
    };
  }, [artists, beats, genre, needle, producers, tracks]);
  const filtered = useMemo(() => {
    function picks<T extends { id:string }>(pool:T[], scope:string, creator:(item:T)=>string, size:number) {
      if (needle || kind !== "all") return pool.slice(0, limit);
      const ordered = fairCreatorDailyOrder(pool, `app-discover:${surface}:${scope}`, creator);
      if (!ordered.length) return [];
      const offset = (round * Math.min(size, Math.max(1, ordered.length - size))) % ordered.length;
      return [...ordered.slice(offset), ...ordered.slice(0, offset)].slice(0, size);
    }
    return {
      tracks:picks(matched.tracks, "music", item => discoveryCreatorKey(item.artist), 6),
      artists:picks(matched.artists, "artists", item => item.id, 8),
      producers:picks(matched.producers, "producers", item => item.id, 8),
      beats:picks(matched.beats, "beats", item => item.producer_username || discoveryCreatorKey(item.producer) || item.id, 8),
    };
  }, [matched, needle, kind, limit, round, surface]);

  const show = (value: ExploreKind) => {
    if (kind !== "all") return kind === value;
    if (needle || mode === "fresh") return true;
    if (mode === "rotation") return value === "music";
    if (mode === "creators") return value === "artists" || value === "producers";
    return value === "beats";
  };
  const discoveryHome = !needle && kind === "all" && mode === "fresh";
  const activeMode = exploreModes.find((item) => item.value === mode) || exploreModes[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (kind !== "all") params.set("kind", kind);
      if (genre) params.set("genre", genre);
      if (!query.trim() && mode !== "fresh") params.set("mode", mode);
      window.history.replaceState(window.history.state, "", `/app/${surface}/explore${params.size ? `?${params}` : ""}`);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [kind, mode, query, surface, genre]);

  const play = (item: CatalogueTrack) => {
    if (player.current?.id === item.id) { player.toggle(); return; }
    player.playNow(item, { from: "Discover", related: filtered.tracks.filter((track) => track.id !== item.id) });
    player.setQueueOpen(false);
    recordListening({ id: item.id, kind: "track", title: item.title, subtitle: item.artist, href: `/app/${surface}`, image: item.artwork });
  };

  const playAll = () => {
    if (!filtered.tracks.length) return;
    player.playAll(filtered.tracks, { from: query.trim() ? `Discover · ${query.trim()}` : "Discover" });
    player.setQueueOpen(false);
    const first = filtered.tracks[0];
    recordListening({ id: first.id, kind: "track", title: first.title, subtitle: first.artist, href: `/app/${surface}`, image: first.artwork });
  };

  const toggleLike = (item: CatalogueTrack) => {
    const saved = toggleLibraryItem("favourites", { id: item.id, kind: "track", title: item.title, subtitle: item.artist, href: `/app/${surface}`, image: item.artwork });
    setLiked((current) => {
      const next = new Set(current);
      if (saved) next.add(item.id); else next.delete(item.id);
      return next;
    });
  };

  return (
    <div className="bvs-square-discover mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Discover</p>
      <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">Find your next favourite.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">Press play on a new sound. Meet the artist. Follow what moves you.</p>

      <label className="relative mt-5 block">
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
              onClick={() => { setMode(item.value); setKind("all"); setLimit(24); }}
              aria-pressed={mode === item.value}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm transition ${mode === item.value ? "bg-white font-semibold text-black" : "border border-white/[.08] bg-white/[.025] text-white/48 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <details className="bvs-discover-filters mt-2"><summary className="min-h-11 cursor-pointer text-sm text-white/60">Filters{kind !== "all" ? ` · ${kind}` : ""}{genre ? ` · ${genre}` : ""}</summary>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-2" aria-label="Filter discovery results">
        {(["all", "music", "artists", "producers", "beats"] as ExploreKind[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => { setKind(value); setLimit(24); }}
            aria-pressed={kind === value}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm capitalize transition ${kind === value ? "bg-brand font-semibold text-black" : "text-white/42 hover:bg-white/[.035] hover:text-white/75"}`}
          >
            {value === "all" ? "Everything" : value}
          </button>
        ))}
      </div>

      {sounds.length ? <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Browse by sound">
        <button type="button" aria-pressed={!genre} onClick={() => { setGenre(""); setLimit(24); }} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs ${!genre ? "border-brand/50 text-brand" : "border-white/15 text-white/50"}`}>All sounds</button>
        {sounds.map(sound => <button key={sound.key} type="button" aria-pressed={genre === sound.key} onClick={() => { setGenre(sound.key); setRound(0); setLimit(24); }} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs ${genre === sound.key ? "border-brand/50 bg-brand/10 text-brand" : "border-white/15 text-white/50"}`}>{sound.label}</button>)}
      </div> : null}
      {genre && !sounds.some(sound => sound.key === genre) ? <button type="button" onClick={() => setGenre("")} className="mt-3 min-h-10 text-sm text-brand">Clear sound filter: {genre}</button> : null}
      </details>
      {unavailable ? <div role="status" className="mt-4 rounded-xl border border-white/15 p-3 text-sm text-white/50"><p>Some discoveries could not be loaded. You can still explore what is here.</p><button type="button" onClick={() => { setLoading(true); setUnavailable(false); setLoadAttempt(value => value + 1); }} className="mt-2 min-h-10 rounded-full border border-white/20 px-4 text-white">Retry loading</button></div> : null}
      {!query.trim() && kind === "all" ? <section className="mt-5 rounded-2xl border border-brand/20 bg-brand/[.035] p-4">
        <p className="font-semibold">{activeMode.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {show("music") && filtered.tracks.length ? <button type="button" onClick={playAll} className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-black">▶ Play discoveries</button> : null}
          <button type="button" onClick={() => { setRound(value => value + 1); trackEvent("explore_rail_open", { action:"next_selection", surface }); }} className="min-h-11 rounded-full border border-white/20 px-4 text-sm">Show me something new</button>
        </div><span role="status" className="sr-only">Discovery selection {round + 1}</span>
      </section> : null}

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
              <h2 className="mt-2 text-3xl font-semibold">A new sound for you.</h2>
              <p className="mt-2 text-xs text-white/38">A rotating selection across BVS artists. Save the ones that stay with you.</p>
            </div>
            <button type="button" onClick={playAll} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-brand">▶ Play {query.trim() ? "results" : "all"}</button>
          </div>

          <div className={`mt-5 grid gap-3 ${discoveryHome ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {filtered.tracks.map((item) => {
              const image = safeImage(item.artwork);
              const isLiked = liked.has(item.id);
              return (
                <article key={item.id} className={`group flex min-w-0 gap-3 rounded-[1.35rem] border border-white/[.07] bg-white/[.025] p-3 transition hover:border-white/15 hover:bg-white/[.04] ${discoveryHome ? "flex-col" : ""}`}>
                  <button type="button" onClick={() => play(item)} className={`relative shrink-0 overflow-hidden rounded-[1rem] bg-white/[.04] ${discoveryHome ? "aspect-square w-full" : "h-16 w-16"}`} aria-label={`${player.current?.id === item.id && player.isPlaying ? "Pause" : "Play"} ${item.title}`}>
                    {image ? <Image src={image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-brand">BVS</span>}
                    <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-black/20 text-lg text-white opacity-80 transition group-hover:opacity-100">{player.current?.id === item.id && player.isPlaying ? "Ⅱ" : "▶"}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => play(item)} className="block w-full text-left">
                      <h3 className="line-clamp-2 font-semibold">{item.title}</h3>
                      <p className="truncate text-sm text-white/48">{item.artist}</p>
                      <p className="mt-1 text-xs text-white/30">{item.genre || item.project || "BVS release"}</p>
                    </button>
                    <DiscoverMoreActions title={item.title}>
                      <button type="button" aria-pressed={isLiked} aria-label={`${isLiked ? "Unsave" : "Save"} ${item.title}`} onClick={() => toggleLike(item)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${isLiked ? "border-brand/35 bg-brand/10 text-brand" : "border-white/12 text-white/45"}`}>{isLiked ? "♥ Saved" : "♡ Save"}</button>
                      <AppPlaylistPicker trackId={item.id} compact />
                      <AppDownloadButton trackId={item.id} surface={surface} compact />
                    </DiscoverMoreActions>
                  </div>
                </article>
              );
            })}
          </div>
          {matched.tracks.length > filtered.tracks.length ? <button type="button" onClick={() => { setKind("music"); setLimit(value => kind === "music" ? value + 24 : 24); }} className="mt-4 min-h-11 rounded-full border border-white/20 px-5 text-sm text-brand">Show more music →</button> : null}
        </section>
      ) : null}

      {show("artists") && filtered.artists.length ? (
        <section className="bvs-discover-creators mt-11">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Artists</p>
          <h2 className="mt-2 text-3xl font-semibold">Names to know.</h2>
          <p className="mt-3 text-xs text-white/60">Scroll sideways → · Tap a portrait to explore</p>
          <div className="bvs-discover-rail mt-5" tabIndex={0} role="region" aria-label="Creator portraits — scroll horizontally">
            {filtered.artists.map((item) => {
              const image = safeImage(item.image);
              return (
                <Link key={item.id} href={`/app/${surface}/creator/${encodeURIComponent(item.id)}`} className="group rounded-[1.35rem] border border-white/[.07] bg-white/[.025] p-2.5 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[.04]">
                  {image ? <div className="relative aspect-square overflow-hidden rounded-[1rem]"><Image src={image} alt="" fill unoptimized className="object-cover transition duration-500 group-hover:scale-[1.02]" /></div> : <div className="grid aspect-square place-items-center rounded-[1rem] bg-white/[.035] text-[10px] font-semibold uppercase tracking-[.15em] text-brand">Artist</div>}
                  <h3 className="mt-3 truncate px-1 font-semibold">{item.name}</h3>
                  <p className="truncate px-1 pb-1 text-xs text-white/36">{item.role || "BVS artist"}</p>
                </Link>
              );
            })}
          </div>
          {matched.artists.length > filtered.artists.length ? <button type="button" onClick={() => { setKind("artists"); setLimit(value => kind === "artists" ? value + 24 : 24); }} className="mt-4 min-h-11 rounded-full border border-white/20 px-5 text-sm text-brand">Show more artists →</button> : null}
        </section>
      ) : null}

      {show("producers") && filtered.producers.length ? (
        <section className="mt-11">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Producers</p>
          <h2 className="mt-2 text-3xl font-semibold">Meet the people behind the sound.</h2>
          <p className="mt-3 text-xs text-white/60">Scroll sideways → · Tap a portrait to explore</p>
          <div className="bvs-discover-rail mt-5" tabIndex={0} role="region" aria-label="Creator portraits — scroll horizontally">
            {filtered.producers.map((item) => (
              <Link key={item.id} href={`/app/${surface}/creator/${encodeURIComponent(item.id)}?as=producer`} className="group min-w-0 rounded-[1.35rem] border border-white/[.07] bg-white/[.025] p-2.5 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[.04]">
                <ExploreArtwork src={item.image} label="Producer" />
                <h3 className="mt-3 truncate px-1 font-semibold">{item.name}</h3>
                <p className="mt-1 px-1 pb-1 text-xs text-white/36">{item.beatCount || 0} published beat{item.beatCount === 1 ? "" : "s"}</p>
              </Link>
            ))}
          </div>
          {matched.producers.length > filtered.producers.length ? <button type="button" onClick={() => { setKind("producers"); setLimit(value => kind === "producers" ? value + 24 : 24); }} className="mt-4 min-h-11 rounded-full border border-white/20 px-5 text-sm text-brand">Show more producers →</button> : null}
        </section>
      ) : null}

      {show("beats") && filtered.beats.length ? (
        <section className="mt-11">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">BeatStore</p>
          <h2 className="mt-2 text-3xl font-semibold">Find the start of your next record.</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {filtered.beats.map((item) => (
              <article key={item.id} className="group min-w-0 rounded-[1.35rem] border border-white/[.07] bg-white/[.025] p-3 transition hover:border-white/15">
                <div className="flex min-w-0 items-start gap-3">
                  <Link href={`/app/${surface}/beat/${encodeURIComponent(item.id)}`} aria-label={`View ${item.title}`} className="w-20 shrink-0 sm:w-24">
                    <ExploreArtwork src={item.artworkUrl} label="Beat" sizes="96px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/app/${surface}/beat/${encodeURIComponent(item.id)}`} className="hover:text-brand"><h3 className="break-words text-lg font-semibold">{item.title}</h3></Link>
                    <p className="truncate text-sm text-white/46">{item.producer || "BVS producer"}</p>
                    <p className="mt-1 text-xs text-white/32">{[item.genre, item.mood, item.bpm ? `${item.bpm} BPM` : ""].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                {item.previewUrl ? (
                  <AppBeatPreviewPlayer
                    title={item.title}
                    artist={item.producer || "BVS producer"}
                    preview={item.previewUrl}
                    artwork={item.artworkUrl}
                    genre={item.genre}
                    beatId={item.id}
                    surface={surface}
                    compact
                  />
                ) : null}

              </article>
            ))}
          </div>
          {matched.beats.length > filtered.beats.length ? <button type="button" onClick={() => { setKind("beats"); setLimit(value => kind === "beats" ? value + 24 : 24); }} className="mt-4 min-h-11 rounded-full border border-white/20 px-5 text-sm text-brand">Show more beats →</button> : null}
        </section>
      ) : null}

      {!loading && !(show("music") && filtered.tracks.length) && !(show("artists") && filtered.artists.length) && !(show("producers") && filtered.producers.length) && !(show("beats") && filtered.beats.length) ? (
        <div className="mt-10 rounded-[1.5rem] border border-dashed border-white/12 p-10 text-center">
          <h2 className="text-xl font-semibold">Nothing matched that yet.</h2>
          <p className="mt-2 text-sm text-white/38">Try another title, artist, producer, genre or mood.</p><button type="button" onClick={() => { setQuery(""); setGenre(""); setKind("all"); setMode("fresh"); setLimit(24); }} className="mt-4 min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">Start discovering</button>
        </div>
      ) : null}
    </div>
  );
}
