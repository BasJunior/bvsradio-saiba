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
function safeImage(value?: string) { if (!value || value.includes("default-avatar")) return ""; if (/^(https?:\/\/|\/)/.test(value)) return value; return `/api/media/${value.split("/").map(encodeURIComponent).join("/")}`; }

export default function AppExploreClient({ surface, initialQuery = "", initialKind = "all" }: { surface: AppSurface; initialQuery?: string; initialKind?: ExploreKind }) {
  const player = useStationPlayer();
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState<ExploreKind>(initialKind);
  const [tracks, setTracks] = useState<CatalogueTrack[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => { setQuery(initialQuery); setKind(initialKind); }, [initialKind, initialQuery]);
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
  const matches = (parts: Array<string | undefined | string[]>) => !needle || parts.flat().filter(Boolean).join(" ").toLowerCase().includes(needle);
  const filtered = useMemo(() => ({
    tracks: tracks.filter((i) => matches([i.title, i.artist, i.genre, i.project])).slice(0, needle ? 30 : 10),
    artists: artists.filter((i) => matches([i.name, i.role, i.genres])).slice(0, needle ? 24 : 8),
    producers: producers.filter((i) => matches([i.name, i.genres])).slice(0, needle ? 24 : 8),
    beats: beats.filter((i) => matches([i.title, i.producer, i.genre, i.mood])).slice(0, needle ? 24 : 8),
  }), [artists, beats, needle, producers, tracks]);
  const show = (value: ExploreKind) => kind === "all" || kind === value;

  const play = (item: CatalogueTrack) => {
    player.playNow(item, { from: "Explore", related: filtered.tracks.filter((track) => track.id !== item.id) });
    player.setQueueOpen(false);
    player.openNowPlaying();
    recordListening({ id: item.id, kind: "track", title: item.title, subtitle: item.artist, href: "/radio", image: item.artwork });
  };
  const playAll = () => {
    if (!filtered.tracks.length) return;
    player.playAll(filtered.tracks, { from: query.trim() ? `Explore · ${query.trim()}` : "Explore" });
    player.setQueueOpen(false);
    player.openNowPlaying();
    const first = filtered.tracks[0];
    recordListening({ id: first.id, kind: "track", title: first.title, subtitle: first.artist, href: "/radio", image: first.artwork });
  };
  const toggleLike = (item: CatalogueTrack) => {
    const saved = toggleLibraryItem("favourites", { id: item.id, kind: "track", title: item.title, subtitle: item.artist, href: "/radio", image: item.artwork });
    setLiked((current) => { const next = new Set(current); if (saved) next.add(item.id); else next.delete(item.id); return next; });
  };

  return <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Explore BVS</p>
    <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Find the sound, then find the people behind it.</h1>
    <label className="mt-6 block"><span className="sr-only">Search BVS</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tracks, artists, producers, beats…" className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/[.04] px-5 text-base outline-none focus:border-brand/50" /></label>
    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{(["all","music","artists","producers","beats"] as ExploreKind[]).map((value) => <button key={value} type="button" onClick={() => setKind(value)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm capitalize ${kind === value ? "bg-brand font-semibold text-black" : "border border-white/10 text-text-secondary"}`}>{value}</button>)}</div>
    {loading ? <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-2xl bg-white/[.04]" /><div className="h-28 animate-pulse rounded-2xl bg-white/[.04]" /></div> : null}

    {show("music") && filtered.tracks.length ? <section className="mt-9">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Music</p><h2 className="mt-1 text-2xl font-semibold">Cleared for this app</h2><p className="mt-1 text-xs text-text-secondary">Only recordings with explicit {surface === "ios" ? "iOS" : "Android"} distribution clearance appear here.</p></div><button type="button" onClick={playAll} className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-black">▶ Play {query.trim() ? "results" : "all"}</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{filtered.tracks.map((item) => { const image=safeImage(item.artwork); const isLiked=liked.has(item.id); return <article key={item.id} className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-3">
        <button type="button" onClick={() => play(item)} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5" aria-label={`Play ${item.title}`}>{image ? <Image src={image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-brand">BVS</span>}<span className="absolute inset-0 grid place-items-center bg-black/25 text-lg text-white">▶</span></button>
        <div className="min-w-0 flex-1"><button type="button" onClick={() => play(item)} className="block w-full text-left"><h3 className="truncate font-semibold">{item.title}</h3><p className="truncate text-sm text-text-secondary">{item.artist}</p><p className="mt-1 text-xs text-text-secondary">{item.genre || item.project || "Published music"}</p></button><div className="mt-2 flex flex-wrap items-start gap-2"><button type="button" onClick={() => play(item)} className="min-h-9 rounded-full bg-brand px-3 text-xs font-semibold text-black">Play</button><button type="button" onClick={() => toggleLike(item)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${isLiked ? "border-brand/40 bg-brand/10 text-brand" : "border-white/15 text-text-secondary"}`}>{isLiked ? "♥ Liked" : "♡ Like"}</button><AppPlaylistPicker trackId={item.id} compact /><AppDownloadButton trackId={item.id} surface={surface} compact /></div></div>
      </article>; })}</div>
    </section> : null}

    {show("artists") && filtered.artists.length ? <section className="mt-9"><p className="text-xs uppercase tracking-[.18em] text-brand">Artists</p><h2 className="mt-1 text-2xl font-semibold">People to follow</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{filtered.artists.map((item) => { const image=safeImage(item.image); return <Link key={item.id} href={`/app/${surface}/creator/${item.username}`} className="rounded-2xl border border-white/10 bg-white/[.025] p-3 hover:border-brand/30">{image ? <div className="relative aspect-square overflow-hidden rounded-xl"><Image src={image} alt="" fill unoptimized className="object-cover" /></div> : <div className="grid aspect-square place-items-center rounded-xl bg-white/5 text-brand">ARTIST</div>}<h3 className="mt-3 truncate font-semibold">{item.name}</h3><p className="truncate text-xs text-text-secondary">{item.role || "BVS artist"}</p></Link>; })}</div></section> : null}
    {show("producers") && filtered.producers.length ? <section className="mt-9"><p className="text-xs uppercase tracking-[.18em] text-brand">Producers</p><h2 className="mt-1 text-2xl font-semibold">Follow the sound backwards.</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{filtered.producers.map((item) => <Link key={item.id} href={`/app/${surface}/creator/${item.username}?as=producer`} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 hover:border-brand/30"><p className="text-xs text-brand">Producer</p><h3 className="mt-2 truncate font-semibold">{item.name}</h3><p className="mt-1 text-xs text-text-secondary">{item.beatCount || 0} published beat{item.beatCount === 1 ? "" : "s"}</p></Link>)}</div></section> : null}
    {show("beats") && filtered.beats.length ? <section className="mt-9"><p className="text-xs uppercase tracking-[.18em] text-brand">BeatStore</p><h2 className="mt-1 text-2xl font-semibold">Beats you can build with.</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{filtered.beats.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><h3 className="font-semibold">{item.title}</h3><p className="text-sm text-text-secondary">{item.producer || "BVS producer"}</p><p className="mt-1 text-xs text-text-secondary">{[item.genre,item.mood,item.bpm ? `${item.bpm} BPM` : ""].filter(Boolean).join(" · ")}</p>{item.previewUrl ? <audio controls preload="none" src={item.previewUrl} className="mt-3 h-10 w-full" /> : null}<Link href={`/app/${surface}/beat/${item.id}`} className="mt-3 inline-flex min-h-10 items-center rounded-full border border-brand/40 px-4 text-sm font-semibold text-brand">View beat</Link></article>)}</div></section> : null}
    {!loading && !filtered.tracks.length && !filtered.artists.length && !filtered.producers.length && !filtered.beats.length ? <div className="mt-10 rounded-2xl border border-dashed border-white/15 p-10 text-center"><h2 className="text-xl font-semibold">No BVS match yet</h2><p className="mt-2 text-sm text-text-secondary">Try a creator, genre, track or beat name.</p></div> : null}
  </div>;
}
