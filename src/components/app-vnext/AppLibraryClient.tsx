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
type SongWorkspace = {
  id: string;
  songTitle: string;
  workspaceKind: "blank" | "licensed";
  hasAttachedBeat: boolean;
  beatTitle?: string | null;
  updatedAt?: string | null;
};
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
  { id: "favourites", label: "Liked" },
  { id: "follows", label: "Following" },
  { id: "history", label: "Recent" },
  { id: "owned", label: "Lyrics" },
];

function nativeHref(surface: AppSurface, item: DiscoveryItem) {
  try {
    const translated = appDestination(surface, new URL(item.href || "/", "https://bvs.local"));
    if (translated) return translated;
  } catch {
    // Fall through to Discover when a legacy saved href is malformed.
  }
  if (item.href?.startsWith(`/app/${surface}`)) return item.href;
  return `/app/${surface}/explore?q=${encodeURIComponent(item.title)}`;
}

export default function AppLibraryClient({ surface }: { surface: AppSurface }) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveSection>("favourites");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [ownedBeats, setOwnedBeats] = useState<OwnedBeat[]>([]);
  const [songWorkspaces, setSongWorkspaces] = useState<SongWorkspace[]>([]);
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
    const loadLyrics = async () => {
      setOwnedLoading(true);
      setOwnedError("");
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [workspaceResponse, beatsResponse] = await Promise.all([
          fetch("/api/creator/song-workspaces", { headers, cache: "no-store" }),
          fetch("/api/library/owned", { headers, cache: "no-store" }),
        ]);
        const [workspacePayload, beatsPayload] = await Promise.all([
          workspaceResponse.json().catch(() => ({})),
          beatsResponse.json().catch(() => ({})),
        ]);
        if (!workspaceResponse.ok) throw new Error(workspacePayload.error || "Could not load Lyrics Pad.");
        if (!beatsResponse.ok) throw new Error(beatsPayload.error || "Could not load licensed beats.");
        if (!cancelled) {
          setSongWorkspaces(Array.isArray(workspacePayload.workspaces) ? workspacePayload.workspaces : []);
          setOwnedBeats(Array.isArray(beatsPayload.beats) ? beatsPayload.beats : []);
        }
      } catch (caught) {
        if (!cancelled) setOwnedError(caught instanceof Error ? caught.message : "Could not load Lyrics Pad.");
      } finally {
        if (!cancelled) setOwnedLoading(false);
      }
    };
    void loadLyrics();
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

  const newLyricsPad = async () => {
    if (!token) return;
    setOpeningBeat("new");
    setOwnedError("");
    const response = await fetch("/api/creator/song-workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    }).catch(() => null);
    const payload = await response?.json().catch(() => ({}));
    if (!response?.ok || !payload?.workspace?.id) {
      setOwnedError(payload?.error || "Could not create Lyrics Pad.");
      setOpeningBeat("");
      return;
    }
    router.push(`/app/${surface}/studio/songs/${payload.workspace.id}`);
  };

  const blankPads = songWorkspaces.filter((workspace) => workspace.workspaceKind === "blank");

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Library</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Everything you want to come back to.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
            {signedIn
              ? "Your likes, follows, listening history, playlists and available downloads stay connected to your BVS identity."
              : "Your activity is saved on this device. Create an account to keep your Library with you across devices."}
          </p>
        </div>
        {(selectedSection === "favourites" || selectedSection === "history") && playable.length ? (
          <button type="button" onClick={playAll} className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-brand">▶ Play all</button>
        ) : null}
      </div>

      {!signedIn ? (
        <Link href={`/app/${surface}/join`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Sync your Library</Link>
      ) : null}

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-white/[.07] pb-3" aria-label="Library sections">
        {tabs.filter((tab) => tab.id !== "owned" || signedIn).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            aria-pressed={selectedSection === tab.id}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm transition ${selectedSection === tab.id ? "bg-white font-semibold text-black" : "text-white/42 hover:bg-white/[.035] hover:text-white/72"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {selectedSection !== "owned" ? <div className="mt-5 space-y-2">
        {items.map((item) => {
          const canPlay = item.kind === "track" && clearedById.has(item.id);
          return (
            <article key={item.id} className="group flex min-w-0 items-center gap-3 rounded-[1.3rem] border border-white/[.07] bg-white/[.02] p-3 transition hover:border-white/15 hover:bg-white/[.035]">
              <button type="button" disabled={!canPlay} onClick={() => playItem(item)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[.95rem] border border-white/[.05] bg-white/[.03] disabled:cursor-default">
                {item.image ? <Image src={item.image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-brand">BVS</span>}
                {canPlay ? <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">▶</span> : null}
              </button>
              <Link href={nativeHref(surface, item)} className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">{item.title}</h2>
                <p className="truncate text-sm text-white/43">{item.subtitle}</p>
                {item.kind === "track" && !canPlay ? <p className="mt-1 text-xs text-white/30">Saved here. Playback will appear when this recording is available on your device.</p> : null}
              </Link>
              {canPlay ? (
                <button type="button" onClick={() => playItem(item)} aria-label={`Play ${item.title}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-black">▶</button>
              ) : (
                <Link href={nativeHref(surface, item)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[.08] text-white/55">→</Link>
              )}
            </article>
          );
        })}
      </div> : null}

      {selectedSection === "owned" ? <section className="mt-6" aria-labelledby="lyrics-pad-heading">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Private writing</p><h2 id="lyrics-pad-heading" className="mt-1 text-2xl font-semibold">Lyrics Pad</h2><p className="mt-2 max-w-2xl text-sm text-text-secondary">Start a private writing pad for free. If your account has a licensed BVS beat, you can also write with its preview attached.</p></div><button type="button" onClick={() => void newLyricsPad()} disabled={openingBeat === "new"} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-50">{openingBeat === "new" ? "Creating…" : "+ New Lyrics Pad"}</button></div>
        {ownedError ? <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{ownedError}</p> : null}
        {ownedLoading ? <p className="mt-5 text-sm text-text-secondary" aria-live="polite">Loading your writing…</p> : null}
        {blankPads.length ? <div className="mt-6 space-y-3"><h3 className="text-sm font-semibold uppercase tracking-[.14em] text-text-secondary">Your pads</h3>{blankPads.map((pad) => <article key={pad.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[.02] p-4"><div className="min-w-0 flex-1"><h4 className="truncate font-semibold">{pad.songTitle || "Untitled song"}</h4><p className="mt-1 text-sm text-text-secondary">Private Lyrics Pad · no beat attached</p></div><button type="button" onClick={() => router.push(`/app/${surface}/studio/songs/${pad.id}`)} className="min-h-11 rounded-full border border-brand/30 px-4 text-sm font-semibold text-brand">Open pad</button></article>)}</div> : null}
        {ownedBeats.length ? <div className="mt-7 space-y-3"><div><h3 className="text-sm font-semibold uppercase tracking-[.14em] text-text-secondary">Licensed beats</h3><p className="mt-2 text-sm text-text-secondary">Optional beat previews already licensed to this account. No purchasing takes place in this app.</p></div>{ownedBeats.map((beat) => <article key={`${beat.orderReference}-${beat.beatId}`} className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
          <div className="flex flex-wrap items-center gap-4"><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{beat.title}</h3><p className="truncate text-sm text-text-secondary">{beat.producerName} · {beat.licenceCode.replaceAll("_", " ")}</p>{beat.songTitle ? <p className="mt-1 truncate text-xs text-brand">Writing: {beat.songTitle}</p> : null}</div><button type="button" onClick={() => void openLyricsPad(beat)} disabled={openingBeat === beat.beatId} className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-black disabled:opacity-50">{beat.workspaceId ? "Open Lyrics Pad" : openingBeat === beat.beatId ? "Opening…" : "Write lyrics"}</button></div>
        </article>)}</div> : null}
        {!ownedLoading && !ownedError && !blankPads.length && !ownedBeats.length ? <div className="mt-7 rounded-[1.75rem] border border-dashed border-white/15 p-9 text-center"><h3 className="text-xl font-semibold">Start with a blank page.</h3><p className="mt-2 text-sm text-text-secondary">Lyrics Pad is included for every signed-in BVS member. A beat purchase is not required.</p></div> : null}
      </section> : null}

      {selectedSection !== "owned" && !items.length ? (
        <div className="mt-7 rounded-[1.5rem] border border-dashed border-white/12 p-9 text-center">
          <h2 className="text-xl font-semibold">This part of your Library is empty.</h2>
          <p className="mt-2 text-sm text-white/40">Discover something worth keeping and it will show up here.</p>
          <Link href={`/app/${surface}/explore`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-brand">Discover music</Link>
        </div>
      ) : null}

      <AppPlaylists surface={surface} />
      <AppOfflineDownloads surface={surface} />
    </div>
  );
}
