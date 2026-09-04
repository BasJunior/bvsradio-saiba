"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { appDestination, type AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import AppOfflineDownloads from "@/components/app-vnext/AppOfflineDownloads";
import AppPlaylists from "@/components/app-vnext/AppPlaylists";
import { useStationPlayer } from "@/components/StationPlayer";
import { readLibrary, type LibrarySection } from "@/lib/library";
import type { DiscoveryItem } from "@/lib/discovery";

type ActiveSection = LibrarySection | "owned";
type OwnedBeat = {
  beatId: string;
  orderReference: string;
  title: string;
  producerName: string;
  licenceCode: string;
  licenceSummary: string;
  workspaceId?: string | null;
  songTitle?: string | null;
};

const tabs: Array<{ id: ActiveSection; label: string }> = [
  { id: "favourites", label: "Liked Songs" },
  { id: "follows", label: "Following" },
  { id: "history", label: "Recently Played" },
  { id: "owned", label: "Licensed Beats" },
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
  const router = useRouter();
  const [active, setActive] = useState<ActiveSection>("favourites");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [ownedBeats, setOwnedBeats] = useState<OwnedBeat[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [ownedError, setOwnedError] = useState("");
  const [openingBeat, setOpeningBeat] = useState("");
  const { signedIn, token } = useAppSession();
  const player = useStationPlayer();
  const selectedSection: ActiveSection = active === "owned" && !signedIn ? "favourites" : active;

  useEffect(() => {
    if (selectedSection === "owned") return;
    const sync = () => setItems(readLibrary(selectedSection));
    sync();
    window.addEventListener("bvs:library-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bvs:library-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [selectedSection]);

  useEffect(() => {
    if (selectedSection !== "owned" || !signedIn || !token) return;
    let cancelled = false;
    const loadOwnedBeats = async () => {
      setOwnedLoading(true);
      setOwnedError("");
      try {
        const response = await fetch("/api/library/owned", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load licensed beats.");
        if (!cancelled) setOwnedBeats(Array.isArray(payload.beats) ? payload.beats : []);
      } catch (caught) {
        if (!cancelled) setOwnedError(caught instanceof Error ? caught.message : "Could not load licensed beats.");
      } finally {
        if (!cancelled) setOwnedLoading(false);
      }
    };
    void loadOwnedBeats();
    return () => { cancelled = true; };
  }, [selectedSection, signedIn, token]);

  const clearedById = useMemo(() => new Map(player.tracks.filter((track) => track.id).map((track) => [track.id as string, track])), [player.tracks]);
  const playable = useMemo(() => items.map((item) => item.kind === "track" ? clearedById.get(item.id) : undefined).filter((track): track is NonNullable<typeof track> => Boolean(track)), [clearedById, items]);
  const sectionLabel = tabs.find((tab) => tab.id === selectedSection)?.label || "Library";

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

  const openLyricsPad = async (beat: OwnedBeat) => {
    if (beat.workspaceId) {
      router.push(`/app/${surface}/studio/songs/${beat.workspaceId}`);
      return;
    }
    if (!token) return;
    setOpeningBeat(beat.beatId);
    setOwnedError("");
    const response = await fetch("/api/creator/song-workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderReference: beat.orderReference, beatId: beat.beatId }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => ({}));
    if (!response?.ok || !payload?.workspace?.id) {
      setOwnedError(payload?.error || "Could not open Lyrics Pad.");
      setOpeningBeat("");
      return;
    }
    router.push(`/app/${surface}/studio/songs/${payload.workspace.id}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Your BVS</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Keep your path through the scene.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">{signedIn ? "Liked music, people you follow, listening history, playlists and rights-cleared downloads in one place." : "Saved on this device for now. Join BVS to carry your library across devices."}</p></div>{(selectedSection === "favourites" || selectedSection === "history") && playable.length ? <button type="button" onClick={playAll} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">▶ Play all</button> : null}</div>
      {!signedIn ? <Link href={`/app/${surface}/join`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Join to sync</Link> : null}

      <div className="mt-7 flex gap-2 overflow-x-auto border-b border-white/10 pb-4" aria-label="Library sections">{tabs.filter((tab) => tab.id !== "owned" || signedIn).map((tab) => <button key={tab.id} type="button" onClick={() => setActive(tab.id)} aria-pressed={selectedSection === tab.id} className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${selectedSection === tab.id ? "bg-brand font-semibold text-black" : "text-text-secondary"}`}>{tab.label}</button>)}</div>

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

      {selectedSection === "owned" ? <section className="mt-6" aria-labelledby="licensed-beats-heading">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Private writing</p><h2 id="licensed-beats-heading" className="mt-1 text-2xl font-semibold">Licensed beats</h2><p className="mt-2 text-sm text-text-secondary">Open an attached beat and keep lyrics and notes synced to your account. No purchasing takes place in this app.</p></div>
        {ownedError ? <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{ownedError}</p> : null}
        {ownedLoading ? <p className="mt-5 text-sm text-text-secondary" aria-live="polite">Loading licensed beats…</p> : null}
        <div className="mt-5 space-y-3">{ownedBeats.map((beat) => <article key={`${beat.orderReference}-${beat.beatId}`} className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
          <div className="flex flex-wrap items-center gap-4"><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{beat.title}</h3><p className="truncate text-sm text-text-secondary">{beat.producerName} · {beat.licenceCode.replaceAll("_", " ")}</p>{beat.songTitle ? <p className="mt-1 truncate text-xs text-brand">Writing: {beat.songTitle}</p> : null}</div><button type="button" onClick={() => void openLyricsPad(beat)} disabled={openingBeat === beat.beatId} className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-black disabled:opacity-50">{beat.workspaceId ? "Open Lyrics Pad" : openingBeat === beat.beatId ? "Opening…" : "Write lyrics"}</button></div>
        </article>)}</div>
        {!ownedLoading && !ownedError && !ownedBeats.length ? <div className="mt-7 rounded-[1.75rem] border border-dashed border-white/15 p-9 text-center"><h3 className="text-xl font-semibold">No licensed beats are attached yet.</h3><p className="mt-2 text-sm text-text-secondary">When an eligible beat licence is attached to this account, its private writing space appears here.</p></div> : null}
      </section> : null}

      {selectedSection !== "owned" && !items.length ? <div className="mt-7 rounded-[1.75rem] border border-dashed border-white/15 p-9 text-center"><h2 className="text-xl font-semibold">Your {sectionLabel.toLowerCase()} will live here.</h2><p className="mt-2 text-sm text-text-secondary">Explore BVS, save what matters and follow the people behind it.</p><Link href={`/app/${surface}/explore`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Explore BVS</Link></div> : null}

      <AppPlaylists surface={surface} />
      <AppOfflineDownloads surface={surface} />
    </div>
  );
}
