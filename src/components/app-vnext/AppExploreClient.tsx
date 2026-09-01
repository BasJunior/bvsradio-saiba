"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppPlaylistPicker from "@/components/app-vnext/AppPlaylistPicker";

type CatalogueTrack = { id: string; title: string; artist: string; genre?: string; artwork?: string; collection?: string; type?: string; source?: string };
type Artist = { id: string; username: string; name: string; role?: string; image?: string; genres?: string[] };
type Producer = { id: string; username: string; name: string; image?: string; genres?: string[]; beatCount?: number };
type Beat = { id: string; title: string; producer?: string; producer_username?: string; genre?: string; mood?: string; artworkUrl?: string; previewUrl?: string; bpm?: number; startingPrice?: number };

type ExploreKind = "all" | "music" | "artists" | "producers" | "beats";

function safeImage(value?: string) {
  if (!value || value.includes("default-avatar")) return "";
  if (/^(https?:\/\/|\/)/.test(value)) return value;
  return `/api/media/${value.split("/").map(encodeURIComponent).join("/")}`;
}

export default function AppExploreClient({ surface }: { surface: AppSurface }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ExploreKind>("all");
  const [tracks, setTracks] = useState<CatalogueTrack[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/catalogue/listings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { listings: [] })),
      fetch("/api/artists", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { artists: [] })),
      fetch("/api/producers", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { producers: [] })),
      fetch("/api/beats", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { beats: [] })),
    ]).then(([catalogue, artistData, producerData, beatData]) => {
      if (!alive) return;
      setTracks((catalogue.listings || []).filter((item: CatalogueTrack) => item.source === "track" && item.type !== "beat"));
      setArtists(artistData.artists || []);
      setProducers(producerData.producers || []);
      setBeats(beatData.beats || []);
      setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = (parts: Array<string | undefined | string[]>) => !needle || parts.flat().filter(Boolean).join(" ").toLowerCase().includes(needle);
  const filtered = useMemo(() => ({
    tracks: tracks.filter((item) => matches([item.title, item.artist, item.genre, item.collection])).slice(0, needle ? 30 : 10),
    artists: artists.filter((item) => matches([item.name, item.role, item.genres])).slice(0, needle ? 24 : 8),
    producers: producers.filter((item) => matches([item.name, item.genres])).slice(0, needle ? 24 : 8),
    beats: beats.filter((item) => matches([item.title, item.producer, item.genre, item.mood])).slice(0, needle ? 24 : 8),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [artists, beats, needle, producers, tracks]);

  const show = (value: ExploreKind) => kind === "all" || kind === value;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Explore BVS</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Find the sound, then find the people behind it.</h1>
      <label className="mt-6 block">
        <span className="sr-only">Search BVS</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tracks, artists, producers, beats…" className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/[.04] px-5 text-base outline-none focus:border-brand/50" />
      </label>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {(["all", "music", "artists", "producers", "beats"] as ExploreKind[]).map((value) => (
          <button key={value} type="button" onClick={() => setKind(value)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm capitalize ${kind === value ? "bg-brand font-semibold text-black" : "border border-white/10 text-text-secondary"}`}>{value}</button>
        ))}
      </div>

      {loading ? <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-2xl bg-white/[.04]" /><div className="h-28 animate-pulse rounded-2xl bg-white/[.04]" /></div> : null}

      {show("music") && filtered.tracks.length ? <section className="mt-9"><div className="flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Music</p><h2 className="mt-1 text-2xl font-semibold">Published on BVS</h2></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{filtered.tracks.map((item) => { const image = safeImage(item.artwork); return <article key={item.id} className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-3">{image ? <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl"><Image src={image} alt="" fill unoptimized className="object-cover" /></div> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-xs text-brand">BVS</div>}<div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{item.title}</h3><p className="truncate text-sm text-text-secondary">{item.artist}</p><p className="mt-1 text-xs text-text-secondary">{item.genre || item.collection || "Published music"}</p><div className="mt-2"><AppPlaylistPicker trackId={item.id} compact /></div></div></article>; })}</div></section> : null}

      {show("artists") && filtered.artists.length ? <section className="mt-9"><p className="text-xs uppercase tracking-[.18em] text-brand">Artists</p><h2 className="mt-1 text-2xl font-semibold">People to follow</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{filtered.artists.map((item) => { const image = safeImage(item.image); return <Link key={item.id} href={`/app/${surface}/creator/${item.username}`} className="rounded-2xl border border-white/10 bg-white/[.025] p-3 hover:border-brand/30">{image ? <div className="relative aspect-square overflow-hidden rounded-xl"><Image src={image} alt="" fill unoptimized className="object-cover" /></div> : <div className="grid aspect-square place-items-center rounded-xl bg-white/5 text-brand">ARTIST</div>}<h3 className="mt-3 truncate font-semibold">{item.name}</h3><p className="truncate text-xs text-text-secondary">{item.role || "BVS artist"}</p></Link>; })}</div></section> : null}

      {show("producers") && filtered.producers.length ? <section className="mt-9"><p className="text-xs uppercase tracking-[.18em] text-brand">Producers</p><h2 className="mt-1 text-2xl font-semibold">Follow the sound backwards.</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{filtered.producers.map((item) => <Link key={item.id} href={`/app/${surface}/creator/${item.username}?as=producer`} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 hover:border-brand/30"><p className="text-xs text-brand">Producer</p><h3 className="mt-2 truncate font-semibold">{item.name}</h3><p className="mt-1 text-xs text-text-secondary">{item.beatCount || 0} published beat{item.beatCount === 1 ? "" : "s"}</p></Link>)}</div></section> : null}

      {show("beats") && filtered.beats.length ? <section className="mt-9"><p className="text-xs uppercase tracking-[.18em] text-brand">BeatStore</p><h2 className="mt-1 text-2xl font-semibold">Beats you can build with.</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{filtered.beats.map((item) => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><h3 className="font-semibold">{item.title}</h3><p className="text-sm text-text-secondary">{item.producer || "BVS producer"}</p><p className="mt-1 text-xs text-text-secondary">{[item.genre, item.mood, item.bpm ? `${item.bpm} BPM` : ""].filter(Boolean).join(" · ")}</p>{item.previewUrl ? <audio controls preload="none" src={item.previewUrl} className="mt-3 h-10 w-full" /> : null}<Link href={`/app/${surface}/beat/${item.id}`} className="mt-3 inline-flex min-h-10 items-center rounded-full border border-brand/40 px-4 text-sm font-semibold text-brand">View beat</Link></article>)}</div></section> : null}

      {!loading && !filtered.tracks.length && !filtered.artists.length && !filtered.producers.length && !filtered.beats.length ? <div className="mt-10 rounded-2xl border border-dashed border-white/15 p-10 text-center"><h2 className="text-xl font-semibold">No BVS match yet</h2><p className="mt-2 text-sm text-text-secondary">Try a creator, genre, track or beat name.</p></div> : null}
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[.025] p-5 text-sm text-text-secondary">BVS Explore combines music, artists, producers and beats in one app-native search surface.</div>
    </div>
  );
}
