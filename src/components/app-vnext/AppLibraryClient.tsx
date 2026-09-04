"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { appDestination, type AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import AppOfflineDownloads from "@/components/app-vnext/AppOfflineDownloads";
import AppPlaylists from "@/components/app-vnext/AppPlaylists";
import { useStationPlayer } from "@/components/StationPlayer";
import { readLibrary, type LibrarySection } from "@/lib/library";
import type { DiscoveryItem } from "@/lib/discovery";

const tabs: Array<{ id: LibrarySection; label: string }> = [
  { id: "favourites", label: "Liked Songs" },
  { id: "follows", label: "Following" },
  { id: "history", label: "Recently Played" },
];

function nativeHref(surface: AppSurface, item: DiscoveryItem) {
  try {
    const translated = appDestination(surface, new URL(item.href || "/", "https://bvs.local"));
    if (translated) return translated;
  } catch {
    // Fall through to Explore when a legacy saved href is malformed.
  }
  if (item.href?.startsWith(`/app/${surface}`)) return item.href;
  return `/app/${surface}/explore?q=${encodeURIComponent(item.title)}`;
}

export default function AppLibraryClient({ surface }: { surface: AppSurface }) {
  const [active, setActive] = useState<LibrarySection>("favourites");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const { signedIn } = useAppSession();
  const player = useStationPlayer();

  useEffect(() => {
    const sync = () => setItems(readLibrary(active));
    sync();
    window.addEventListener("bvs:library-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bvs:library-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [active]);

  const clearedById = useMemo(() => new Map(player.tracks.filter((track) => track.id).map((track) => [track.id as string, track])), [player.tracks]);
  const playable = useMemo(() => items.map((item) => item.kind === "track" ? clearedById.get(item.id) : undefined).filter((track): track is NonNullable<typeof track> => Boolean(track)), [clearedById, items]);
  const sectionLabel = tabs.find((tab) => tab.id === active)?.label || "Library";

  const playAll = () => {
    if (!playable.length) return;
    player.playAll(playable, { from: sectionLabel });
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  const playItem = (item: DiscoveryItem) => {
    const track = item.kind === "track" ? clearedById.get(item.id) : undefined;
    if (!track) return;
    player.playNow(track, { from: sectionLabel, related: playable.filter((candidate) => candidate.id !== track.id) });
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Your BVS</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Keep your path through the scene.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">{signedIn ? "Liked music, people you follow, listening history, playlists and rights-cleared downloads in one place." : "Saved on this device for now. Join BVS to carry your library across devices."}</p></div>{(active === "favourites" || active === "history") && playable.length ? <button type="button" onClick={playAll} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">▶ Play all</button> : null}</div>
      {!signedIn ? <Link href={`/app/${surface}/join`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Join to sync</Link> : null}

      <div className="mt-7 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActive(tab.id)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm ${active === tab.id ? "bg-brand font-semibold text-black" : "text-text-secondary"}`}>{tab.label}</button>)}</div>

      <div className="mt-5 space-y-2">{items.map((item) => {
        const canPlay = item.kind === "track" && clearedById.has(item.id);
        return <article key={item.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.02] p-3">
          <button type="button" disabled={!canPlay} onClick={() => playItem(item)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/5 bg-white/[.03] disabled:cursor-default">
            {item.image ? <Image src={item.image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-brand">BVS</span>}
            {canPlay ? <span className="absolute inset-0 grid place-items-center bg-black/30 text-white">▶</span> : null}
          </button>
          <Link href={nativeHref(surface, item)} className="min-w-0 flex-1"><h2 className="truncate font-semibold">{item.title}</h2><p className="truncate text-sm text-text-secondary">{item.subtitle}</p>{item.kind === "track" && !canPlay ? <p className="mt-1 text-xs text-text-secondary">Saved item · playback appears when this recording is cleared for {surface.toUpperCase()}.</p> : null}</Link>
          {canPlay ? <button type="button" onClick={() => playItem(item)} aria-label={`Play ${item.title}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-black">▶</button> : <Link href={nativeHref(surface, item)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-brand">→</Link>}
        </article>;
      })}</div>

      {!items.length ? <div className="mt-7 rounded-[1.75rem] border border-dashed border-white/15 p-9 text-center"><h2 className="text-xl font-semibold">Your {sectionLabel.toLowerCase()} will live here.</h2><p className="mt-2 text-sm text-text-secondary">Explore BVS, save what matters and follow the people behind it.</p><Link href={`/app/${surface}/explore`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Explore BVS</Link></div> : null}

      <AppPlaylists surface={surface} />
      <AppOfflineDownloads surface={surface} />
    </div>
  );
}
