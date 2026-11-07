"use client";

import TrendingBadge from "@/components/TrendingBadge";
import TrendingBoard from "@/components/TrendingBoard";
import { useDiscoverySearch } from "@/lib/use-discovery-search";

import DiscoverMoreActions from "@/components/DiscoverMoreActions";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppBeatPreviewPlayer from "@/components/app-vnext/AppBeatPreviewPlayer";
import AppDownloadButton from "@/components/app-vnext/AppDownloadButton";
import AppPlaylistPicker from "@/components/app-vnext/AppPlaylistPicker";
import SongShareButton from "@/components/SongShareButton";
import { useStationPlayer } from "@/components/StationPlayer";
import { fairCreatorDailyOrder } from "@/lib/fair-discovery-order";
import { soundKey, discoveryCreatorKey } from "@/lib/discovery-experience";
import { trackEvent } from "@/lib/analytics";
import { CoverMosaic, LibIcon } from "@/components/app-vnext/LibraryVisuals";
import { HeartIcon } from "@/components/player/PlayerIcons";
import { hasLibraryItem, recordListening, toggleLibraryItem } from "@/lib/library";
import { appExploreStatePath, readAppExploreState, type AppExploreKind as ExploreKind, type AppExploreMode as ExploreMode, type AppExploreState } from "@/lib/discovery-continuity";

type CatalogueTrack = { id: string; title: string; artist: string; src: string; genre?: string; artwork?: string; project?: string; playCount?: number };
type Artist = { id: string; username: string; name: string; role?: string; image?: string; genres?: string[] };
type Producer = { id: string; username: string; name: string; image?: string; genres?: string[]; beatCount?: number };
type Beat = { id: string; title: string; producer?: string; producer_username?: string; genre?: string; mood?: string; artworkUrl?: string; previewUrl?: string; bpm?: number; startingPrice?: number };
const exploreModes: Array<{ value: ExploreMode; label: string; description: string }> = [
  { value: "fresh", label: "Discover", description: "A rotating selection of sounds and people to explore." },
  { value: "rotation", label: "Music", description: "Music available to play instantly in the app." },
  { value: "creators", label: "Creators", description: "Meet the artists and producers behind the sound." },
  { value: "beats", label: "BeatStore", description: "Find production you can build on, then open licensing when you’re ready." },
];

const countKeys = { music: "track", artists: "artist", producers: "producer", beats: "beat" } as const;

function safeImage(value?: string) {
  if (!value || value.includes("default-avatar")) return "";
  if (/^(https?:\/\/|\/)/.test(value)) return value;
  return `/api/media/${value.split("/").map(encodeURIComponent).join("/")}`;
}

function ExploreArtwork({ src, label, sizes = "(max-width: 640px) 45vw, 240px" }: { src?: string; label: string; sizes?: string }) {
  const image = safeImage(src);
  const [failedSrc, setFailedSrc] = useState("");
  return <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-white/[.09] to-white/[.02]">
    {image && failedSrc !== image ? <Image src={image} alt="" fill sizes={sizes} unoptimized className="object-cover transition duration-500 group-hover:scale-[1.03]" onError={() => setFailedSrc(image)} /> : <span className="absolute inset-0 grid place-items-center text-white/35"><LibIcon name={label === "Beat" ? "waveform" : label === "Producer" ? "sliders" : "mic"} size={28} /></span>}
  </div>;
}

export default function AppExploreClient({
  surface,
  initialState = { query: "", kind: "all", genre: "", mode: "fresh" },
}: {
  surface: AppSurface;
  initialState?: AppExploreState;
}) {
  const player = useStationPlayer();
  const [query, setQuery] = useState(initialState.query);
  const [kind, setKind] = useState<ExploreKind>(initialState.kind);
  const [mode, setMode] = useState<ExploreMode>(initialState.mode);
  const [genre, setGenre] = useState(soundKey(initialState.genre));
  const [round, setRound] = useState(0);
  const [limit, setLimit] = useState(24);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => {
      const state = readAppExploreState(new URLSearchParams(window.location.search));
      setQuery(state.query);
      setKind(state.kind);
      setGenre(soundKey(state.genre));
      setMode(state.mode);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const apiKind = { all: 'all', music: 'track', artists: 'artist', producers: 'producer', beats: 'beat' }[kind];
  const search = useDiscoverySearch({ q: query, type: apiKind, genre, surface, limit });
  const { loading } = search;
  const unavailable = search.unavailable.length > 0;
  const tracks = useMemo<CatalogueTrack[]>(() => search.items.filter(item => item.kind === 'track' && item.detail?.src).map(item => ({
    ...item.playback, id: item.detail!.id, title: item.title, artist: item.detail!.artist, src: item.detail!.src!, artwork: item.image, genre: item.detail!.genre, project: item.detail!.collection,
  })), [search.items]);
  const artists = useMemo<Artist[]>(() => search.items.filter(item => item.kind === 'artist').map(item => ({ id: item.id.replace(/^artist-/, ''), name: item.title, username: item.creatorUsername || '', image: item.image, role: item.subtitle, genres: item.genres || [] })), [search.items]);
  const producers = useMemo<Producer[]>(() => search.items.filter(item => item.kind === 'producer').map(item => ({ id: item.id.replace(/^producer-/, ''), name: item.title, username: item.creatorUsername || '', image: item.image, genres: item.genres || [], beatCount: item.beatCount })), [search.items]);
  const beats = useMemo<Beat[]>(() => search.items.filter(item => item.kind === 'beat').map(item => ({ id: item.detail!.id, title: item.title, producer: item.detail!.artist, producer_username: item.creatorUsername, genre: item.detail!.genre, mood: item.detail!.mood, artworkUrl: item.image, previewUrl: item.detail!.src, bpm: Number(item.detail!.bpm) || undefined, startingPrice: item.detail!.price ?? undefined })), [search.items]);

  useEffect(() => {
    const sync = () => setLiked(new Set(tracks.filter((track) => hasLibraryItem("favourites", track.id)).map((track) => track.id)));
    sync();
    window.addEventListener("bvs:library-change", sync);
    return () => window.removeEventListener("bvs:library-change", sync);
  }, [tracks]);

  const needle = query.trim().toLowerCase();
  const sounds = search.sounds;
  const matched = useMemo(() => ({ tracks, artists, producers, beats }), [tracks, artists, producers, beats]);
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
      const path = appExploreStatePath(surface, { query, kind, genre, mode }, new URLSearchParams(window.location.search));
      window.history.replaceState(window.history.state, "", path);
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
    if (saved) trackEvent("track_save", { track_id: item.id, source: "discover" });
    setLiked((current) => {
      const next = new Set(current);
      if (saved) next.add(item.id); else next.delete(item.id);
      return next;
    });
  };

  const isPlaying = (id: string) => player.current?.id === id && player.isPlaying;
  const heroArt = filtered.tracks.map((track) => safeImage(track.artwork)).filter(Boolean).slice(0, 4);
  const moreMusic = (search.counts.track || 0) > filtered.tracks.length;
  const nothing = !loading && !unavailable && !(show("music") && filtered.tracks.length) && !(show("artists") && filtered.artists.length) && !(show("producers") && filtered.producers.length) && !(show("beats") && filtered.beats.length);

  return (
    <div className="bvs-app-page mx-auto max-w-5xl px-4 pb-12 pt-5 sm:px-6" data-app-accent="discover">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="bvs-app-eyebrow">Find your next favourite</p>
          <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">Discover</h1>
        </div>
        <Link href={`/app/${surface}/trending`} aria-label="BVS Trending chart" className="bvs-app-icon-button border border-white/15"><LibIcon name="trending" /></Link>
      </header>

      <label className="bvs-app-search mt-4">
        <span className="sr-only">Search BVS</span>
        <LibIcon name="search" size={19} className="shrink-0 text-white/45" />
        <input
          value={query}
          maxLength={160}
          onChange={(e) => { setQuery(e.target.value); setLimit(24); }}
          placeholder="Artists, songs, producers, beats"
          enterKeyHint="search"
        />
        {query ? <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setLimit(24); }} className="grid h-8 w-8 place-items-center text-white/50"><LibIcon name="close" size={16} /></button> : null}
      </label>

      <div className="bvs-app-chipbar -mx-4 mt-3 px-4 py-2.5 sm:-mx-6 sm:px-6">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto" aria-label="Discovery modes">
          {!query.trim() ? exploreModes.map((item) => (
            <button key={item.value} type="button" onClick={() => { setMode(item.value); setKind("all"); setLimit(24); }} aria-pressed={mode === item.value && kind === "all"} className="bvs-app-chip">{item.label}</button>
          )) : (["all", "music", "artists", "producers", "beats"] as ExploreKind[]).map((value) => (
            <button key={value} type="button" onClick={() => { setKind(value); setLimit(24); }} aria-pressed={kind === value} className="bvs-app-chip capitalize">{value === "all" ? "Top results" : value}{value !== "all" ? <span className="opacity-60">{search.counts[countKeys[value as keyof typeof countKeys]] ?? ""}</span> : null}</button>
          ))}
        </nav>
      </div>

      {sounds.length ? <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6" aria-label="Browse by sound">
        {genre ? <button type="button" aria-label="All sounds" onClick={() => { setGenre(""); setLimit(24); }} className="bvs-app-chip border-white/15"><LibIcon name="close" size={14} /></button> : null}
        {sounds.map(sound => <button key={sound.key} type="button" aria-pressed={genre === sound.key} onClick={() => { setGenre(genre === sound.key ? "" : sound.key); setRound(0); setLimit(24); }} className="bvs-app-chip border-white/12 bg-white/[.04]">{sound.label}</button>)}
      </div> : null}

      {unavailable ? <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-amber-200/25 bg-amber-200/[.05] p-3 text-sm text-white/65"><p className="min-w-0 flex-1">Some results couldn’t load, so this list may be incomplete.</p><button type="button" onClick={() => { search.retry(); }} className="bvs-app-pill">Retry loading</button></div> : null}

      {!query.trim() && kind === "all" ? (
        <section className="mt-5 flex items-center gap-4" aria-labelledby="discover-picks-heading">
          <CoverMosaic images={heroArt} seed={`discover-${mode}-${round}`} className="w-28 shrink-0 sm:w-36" />
          <div className="min-w-0 flex-1">
            <p className="bvs-app-eyebrow">{activeMode.value === "fresh" ? "Today’s picks" : activeMode.label}</p>
            <h2 id="discover-picks-heading" className="mt-1 text-xl font-bold leading-tight sm:text-2xl">{activeMode.description}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {show("music") && filtered.tracks.length ? <button type="button" aria-label="Play discoveries" onClick={playAll} className="bvs-app-pill bvs-app-pill--primary"><LibIcon name="play" size={15} />Play</button> : null}
              <button type="button" aria-label="Show me something new" onClick={() => { setRound(value => value + 1); trackEvent("explore_rail_open", { action:"next_selection", surface }); }} className="bvs-app-pill"><LibIcon name="shuffle" size={16} />New picks</button>
            </div>
            <span role="status" className="sr-only">Discovery selection {round + 1}</span>
          </div>
        </section>
      ) : null}

      {loading && !search.items.length ? (
        <div className="bvs-app-rail mt-8" aria-hidden="true">
          {[0, 1, 2].map((key) => <div key={key} className="w-[9.5rem]"><div className="bvs-app-skeleton aspect-square" /><div className="bvs-app-skeleton mt-2 h-3.5 w-3/4" /><div className="bvs-app-skeleton mt-1.5 h-3 w-1/2" /></div>)}
        </div>
      ) : null}

      {show("music") && filtered.tracks.length ? (
        <section className="bvs-app-shelf" aria-labelledby="discover-music-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="discover-music-heading" className="bvs-app-shelf-title">{query.trim() ? "Songs" : discoveryHome ? "New for you" : "Music"}</h2>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label={`Play ${query.trim() ? "results" : "all"}`} onClick={playAll} className="bvs-app-pill min-h-9 px-3.5"><LibIcon name="play" size={14} />Play all</button>
              {moreMusic ? <button type="button" aria-label="Show more music" onClick={() => { setKind("music"); setLimit(value => kind === "music" ? value + 24 : 24); }} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 whitespace-nowrap px-2 text-[13px] font-semibold" style={{ color: "rgb(var(--bvs-app-accent))" }}>See all<LibIcon name="chevron" size={15} /></button> : null}
            </div>
          </div>

          <div className={discoveryHome ? "bvs-app-rail -mx-4 mt-3 px-4 sm:-mx-6 sm:px-6" : "mt-2"}>
            {filtered.tracks.map((item) => {
              const image = safeImage(item.artwork);
              const isLiked = liked.has(item.id);
              const saveButton = <button type="button" aria-pressed={isLiked} aria-label={`${isLiked ? "Unsave" : "Save"} ${item.title}`} onClick={() => toggleLike(item)} className="bvs-app-icon-button"><HeartIcon size={20} filled={isLiked} /></button>;
              const more = <DiscoverMoreActions title={item.title} sheet>
                {discoveryHome ? <button type="button" aria-pressed={isLiked} aria-label={`${isLiked ? "Unsave" : "Save"} ${item.title}`} onClick={() => toggleLike(item)} className={`bvs-app-pill justify-start ${isLiked ? "text-[#c1ff52]" : ""}`}><HeartIcon size={18} filled={isLiked} />{isLiked ? "Saved to Library" : "Save to Library"}</button> : null}
                <AppPlaylistPicker trackId={item.id} compact />
                <AppDownloadButton trackId={item.id} surface={surface} compact />
                <SongShareButton id={item.id} title={item.title} artist={item.artist} image={image} compact />
              </DiscoverMoreActions>;
              return discoveryHome ? (
                <article key={item.id} className="bvs-discover-music-card group w-[9.5rem] sm:w-44">
                  <button type="button" onClick={() => play(item)} className="bvs-app-cover relative block aspect-square w-full overflow-hidden bg-white/[.05]" aria-label={`${isPlaying(item.id) ? "Pause" : "Play"} ${item.title}`}>
                    {image ? <Image src={image} alt="" fill sizes="176px" unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-xs font-semibold tracking-[.2em] text-white/40">BVS</span>}
                    <span aria-hidden="true" className="bvs-app-cover-play"><LibIcon name={isPlaying(item.id) ? "waveform" : "play"} size={16} /></span>
                  </button>
                  <div className="bvs-discover-music-caption mt-2 flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                      <p className="truncate text-xs text-white/50">{item.artist}</p>
                    </div>
                    <div className="-mr-2.5 -mt-3 shrink-0">{more}</div>
                  </div>
                  <TrendingBadge trackId={item.id} surface={surface} />
                </article>
              ) : (
                <article key={item.id} className="bvs-discover-music-card bvs-app-row group flex min-w-0 items-center gap-3 py-2">
                  <button type="button" onClick={() => play(item)} className="bvs-app-cover relative h-14 w-14 shrink-0 overflow-hidden bg-white/[.05]" aria-label={`${isPlaying(item.id) ? "Pause" : "Play"} ${item.title}`}>
                    {image ? <Image src={image} alt="" fill sizes="56px" unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-[10px] text-white/40">BVS</span>}
                    {isPlaying(item.id) ? <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-black/45 text-[#c1ff52]"><LibIcon name="waveform" size={18} /></span> : null}
                  </button>
                  <button type="button" onClick={() => play(item)} className="bvs-discover-music-caption min-w-0 flex-1 text-left" aria-hidden="true" tabIndex={-1}>
                    <h3 className={`truncate text-[15px] font-semibold ${isPlaying(item.id) ? "text-[#c1ff52]" : ""}`}>{item.title}</h3>
                    <p className="truncate text-[13px] text-white/48">{[item.artist, item.genre || item.project].filter(Boolean).join(" · ")}</p>
                  </button>
                  {saveButton}{more}
                </article>
              );
            })}
          </div>
          {!discoveryHome && moreMusic ? <button type="button" onClick={() => { setKind("music"); setLimit(value => kind === "music" ? value + 24 : 24); }} className="bvs-app-pill mt-3 w-full">Show more music</button> : null}
        </section>
      ) : null}

      {discoveryHome ? <div className="bvs-app-trending"><TrendingBoard surface={surface} preview /></div> : null}

      {show("artists") && filtered.artists.length ? (
        <section className="bvs-app-shelf bvs-discover-creators" aria-labelledby="discover-artists-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="discover-artists-heading" className="bvs-app-shelf-title">Artists to know</h2>
            {(search.counts.artist || 0) > filtered.artists.length ? <button type="button" aria-label="Show more artists" onClick={() => { setKind("artists"); setLimit(value => kind === "artists" ? value + 24 : 24); }} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 whitespace-nowrap px-2 text-[13px] font-semibold" style={{ color: "rgb(var(--bvs-app-accent))" }}>See all<LibIcon name="chevron" size={15} /></button> : null}
          </div>
          <div className="bvs-app-rail -mx-4 mt-3 px-4 sm:-mx-6 sm:px-6" role="region" aria-label="Artists">
            {filtered.artists.map((item) => (
              <Link key={item.id} href={`/app/${surface}/creator/${encodeURIComponent(item.id)}`} className="group w-[7.5rem]">
                <ExploreArtwork src={item.image} label="Artist" sizes="120px" />
                <h3 className="mt-2 truncate text-sm font-semibold">{item.name}</h3>
                <p className="truncate text-xs text-white/45">{item.role || "BVS artist"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {show("producers") && filtered.producers.length ? (
        <section className="bvs-app-shelf bvs-discover-producers" aria-labelledby="discover-producers-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="discover-producers-heading" className="bvs-app-shelf-title">Producers behind the sound</h2>
            {(search.counts.producer || 0) > filtered.producers.length ? <button type="button" aria-label="Show more producers" onClick={() => { setKind("producers"); setLimit(value => kind === "producers" ? value + 24 : 24); }} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 whitespace-nowrap px-2 text-[13px] font-semibold" style={{ color: "rgb(var(--bvs-app-accent))" }}>See all<LibIcon name="chevron" size={15} /></button> : null}
          </div>
          <div className="bvs-app-rail -mx-4 mt-3 px-4 sm:-mx-6 sm:px-6" role="region" aria-label="Producers">
            {filtered.producers.map((item) => (
              <Link key={item.id} href={`/app/${surface}/creator/${encodeURIComponent(item.id)}?as=producer`} className="group w-[7.5rem]">
                <ExploreArtwork src={item.image} label="Producer" sizes="120px" />
                <h3 className="mt-2 truncate text-sm font-semibold">{item.name}</h3>
                <p className="truncate text-xs text-white/45">{item.beatCount || 0} beat{item.beatCount === 1 ? "" : "s"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {show("beats") && filtered.beats.length ? (
        <section className="bvs-app-shelf bvs-discover-beats" aria-labelledby="discover-beats-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="discover-beats-heading" className="bvs-app-shelf-title">Beats to build on</h2>
            {(search.counts.beat || 0) > filtered.beats.length ? <button type="button" aria-label="Show more beats" onClick={() => { setKind("beats"); setLimit(value => kind === "beats" ? value + 24 : 24); }} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 whitespace-nowrap px-2 text-[13px] font-semibold" style={{ color: "rgb(var(--bvs-app-accent))" }}>See all<LibIcon name="chevron" size={15} /></button> : null}
          </div>
          <div className="mt-2">
            {filtered.beats.map((item) => (
              <article key={item.id} className="bvs-app-row min-w-0 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Link href={`/app/${surface}/beat/${encodeURIComponent(item.id)}`} aria-label={`View ${item.title}`} className="w-16 shrink-0">
                    <ExploreArtwork src={item.artworkUrl} label="Beat" sizes="64px" />
                  </Link>
                  <Link href={`/app/${surface}/beat/${encodeURIComponent(item.id)}`} className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold">{item.title}</h3>
                    <p className="truncate text-[13px] text-white/48">{item.producer || "BVS producer"}</p>
                    <p className="mt-0.5 truncate text-[11px] text-white/35">{[item.genre, item.mood, item.bpm ? `${item.bpm} BPM` : ""].filter(Boolean).join(" · ")}</p>
                  </Link>
                  {typeof item.startingPrice === "number" && item.startingPrice > 0 ? <span className="shrink-0 text-xs font-semibold text-[#c1a7ff]">From ${item.startingPrice}</span> : null}
                </div>
                {item.previewUrl ? (
                  <div className="mt-2">
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
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {nothing ? (
        <div className="mt-10 flex flex-col items-center border border-dashed border-white/15 px-6 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center bg-white/[.06] text-white/60"><LibIcon name="search" size={26} /></span>
          <h2 className="mt-4 text-xl font-bold">Nothing matched that yet.</h2>
          <p className="mt-2 max-w-xs text-sm text-white/45">Try another title, artist, producer, genre or mood.</p>
          <button type="button" onClick={() => { setQuery(""); setGenre(""); setKind("all"); setMode("fresh"); setLimit(24); }} className="bvs-app-pill bvs-app-pill--primary mt-5">Start discovering</button>
        </div>
      ) : null}
    </div>
  );
}
