"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppPlaylist } from "@/components/app-vnext/AppPlaylists";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import { CoverMosaic, LibIcon, formatTotalDuration, formatTrackDuration } from "@/components/app-vnext/LibraryVisuals";
import { useStationPlayer } from "@/components/StationPlayer";
import { recordListening } from "@/lib/library";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import { playlistItemKey } from "@/lib/playlist-item";
import type { StationTrack } from "@/lib/station";

type PlaylistItem = {
  id: string;
  kind?: "track" | "beat";
  item_id?: string;
  item_key?: string;
  track_id?: string | null;
  beat_id?: string | null;
  position: number;
  title?: string;
  artist_name?: string;
  genre?: string;
  artwork_url?: string;
  file_url?: string;
  duration_sec?: number;
};

function keyFor(item: PlaylistItem) {
  if (item.item_key) return item.item_key;
  if (item.beat_id) return playlistItemKey("beat", item.beat_id);
  return playlistItemKey("track", item.track_id || item.id);
}

export default function AppPlaylistDetailClient({ surface, playlistId }: { surface: AppSurface; playlistId: string }) {
  const router = useRouter();
  const player = useStationPlayer();
  const { token, signedIn, loading } = useAppSession();
  const [playlist, setPlaylist] = useState<AppPlaylist | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [listResponse, itemsResponse] = await Promise.all([
      fetch("/api/app/playlists", { headers, cache: "no-store" }).catch(() => null),
      fetch(`/api/app/playlists/${playlistId}/tracks`, { headers, cache: "no-store" }).catch(() => null),
    ]);
    if (!listResponse?.ok || !itemsResponse?.ok) return setError("Playlist could not be loaded.");
    const list = (await listResponse.json()) as { playlists?: AppPlaylist[] };
    const payload = (await itemsResponse.json()) as { tracks?: PlaylistItem[]; items?: PlaylistItem[] };
    const found = (list.playlists || []).find((item) => item.id === playlistId) || null;
    setPlaylist(found);
    setTitle(found?.title || "");
    setDescription(found?.description || "");
    setItems(payload.items || payload.tracks || []);
    setError(found ? "" : "Playlist not found.");
  }, [playlistId, token]);

  useEffect(() => { void load(); }, [load]);

  const orderedKeys = useMemo(() => items.map(keyFor), [items]);
  const clearedById = useMemo(() => new Map(player.tracks.filter((track) => track.id).map((track) => [track.id as string, track])), [player.tracks]);
  const playableEntries = useMemo(() => items.map((item) => {
    const key = keyFor(item);
    if (item.beat_id || item.kind === "beat") {
      if (!item.file_url) return null;
      const track: StationTrack = {
        id: `beat-${item.beat_id || item.item_id || item.id}`,
        title: item.title || "BVS beat",
        artist: item.artist_name || "BVS producer",
        src: item.file_url,
        artwork: mediaUrlForStoredValue(item.artwork_url) || item.artwork_url,
        genre: item.genre,
        project: "BVS BeatStore",
      };
      return { key, item, track };
    }
    const trackId = item.track_id || item.item_id || item.id;
    const track = clearedById.get(trackId);
    return track ? { key, item, track } : null;
  }).filter((entry): entry is { key: string; item: PlaylistItem; track: StationTrack } => Boolean(entry)), [clearedById, items]);

  const rememberPlay = (entry?: { item: PlaylistItem; track: StationTrack }) => {
    if (!entry) return;
    const isBeat = Boolean(entry.item.beat_id || entry.item.kind === "beat");
    const rawId = entry.item.beat_id || entry.item.track_id || entry.item.item_id || entry.item.id;
    recordListening({
      id: isBeat ? `beat-${rawId}` : rawId,
      kind: isBeat ? "beat" : "track",
      title: entry.track.title,
      subtitle: entry.track.artist,
      href: isBeat ? `/beat/${rawId}` : "/radio",
      image: entry.track.artwork,
    });
  };

  const playFrom = (itemKey?: string) => {
    if (!playlist || !playableEntries.length) return;
    const startIndex = itemKey ? Math.max(0, playableEntries.findIndex((entry) => entry.key === itemKey)) : 0;
    rememberPlay(playableEntries[startIndex]);
    player.playAll(playableEntries.map((entry) => entry.track), { from: playlist.title, startIndex });
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  const shufflePlay = () => {
    if (!playlist || !playableEntries.length) return;
    const shuffled = [...playableEntries];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    rememberPlay(shuffled[0]);
    player.playAll(shuffled.map((entry) => entry.track), { from: `${playlist.title} · Shuffle` });
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  const patchPlaylist = async (patch: { title?: string; description?: string; isPublic?: boolean }) => {
    if (!token) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/app/playlists/${playlistId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(patch) }).catch(() => null);
    if (!response?.ok) setError("Could not update playlist."); else { setEditing(false); await load(); window.dispatchEvent(new CustomEvent("bvs:playlists-change")); }
    setBusy(false);
  };

  const remove = async (item: PlaylistItem) => {
    if (!token) return;
    const beatId = item.beat_id || (item.kind === "beat" ? item.item_id || item.id : "");
    const trackId = item.track_id || (!beatId ? item.item_id || item.id : "");
    const response = await fetch(`/api/app/playlists/${playlistId}/tracks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(beatId ? { beatId } : { trackId }),
    }).catch(() => null);
    if (response?.ok) await load();
  };

  const move = async (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (!token || nextIndex < 0 || nextIndex >= orderedKeys.length) return;
    const next = [...orderedKeys];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setItems((current) => {
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy.map((item, position) => ({ ...item, position }));
    });
    const response = await fetch(`/api/app/playlists/${playlistId}/tracks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemKeys: next }),
    }).catch(() => null);
    if (!response?.ok) await load();
  };

  const destroy = async () => {
    if (!token || !window.confirm("Delete this playlist? The music itself will stay on BVS.")) return;
    const response = await fetch(`/api/app/playlists/${playlistId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (response?.ok) router.replace(`/app/${surface}/library`);
  };

  const artwork = items.map((item) => (item.artwork_url ? mediaUrlForStoredValue(item.artwork_url) || item.artwork_url : null));
  const totalSeconds = items.reduce((sum, item) => sum + (item.duration_sec || 0), 0);
  const currentId = player.current?.id;
  const isPrivate = playlist?.is_public === false;

  if (loading) return (
    <div className="mx-auto max-w-4xl px-4 pt-8">
      <div className="mx-auto aspect-square w-56 animate-pulse rounded-2xl bg-white/[.05]" />
      <div className="mx-auto mt-5 h-7 w-48 animate-pulse rounded bg-white/[.06]" />
    </div>
  );
  if (!signedIn) return <div className="mx-auto max-w-4xl px-4 py-10 text-center"><h1 className="text-3xl font-semibold">Sign in to open this playlist.</h1></div>;
  if (!playlist) return <div className="mx-auto max-w-4xl px-4 py-10"><h1 className="text-3xl font-semibold">{error || "Loading playlist…"}</h1></div>;

  const menuButton = "flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] transition hover:bg-white/[.06]";

  return <div className="relative mx-auto max-w-4xl px-4 pb-12 pt-4 sm:px-6">
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[26rem] overflow-hidden" aria-hidden="true">
      {artwork.find(Boolean) ? (
        // eslint-disable-next-line @next/next/no-img-element -- blurred ambience copy of the cover
        <img src={artwork.find(Boolean) as string} alt="" className="h-full w-full scale-125 object-cover opacity-40 blur-[60px] saturate-150" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#09090b]/60 to-[#09090b]" />
    </div>

    <Link href={`/app/${surface}/library`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-white/70"><span className="rotate-180"><LibIcon name="chevron" size={18} /></span> Library</Link>

    <div className="mt-3 flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
      <CoverMosaic images={artwork} seed={playlist.id} className="w-[min(62vw,15rem)] shrink-0 sm:w-56" rounded="rounded-2xl" label={`${playlist.title} cover`} />
      <div className="min-w-0 flex-1">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.2em] text-brand"><LibIcon name={isPrivate ? "lock" : "globe"} size={13} />{isPrivate ? "Private playlist" : "Public playlist"}</p>
        {editing ? (
          <div className="mt-3 space-y-2 text-left">
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} aria-label="Playlist name" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-xl font-semibold" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} placeholder="Playlist description" aria-label="Playlist description" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm" />
            <div className="flex gap-2">
              <button type="button" disabled={busy || !title.trim()} onClick={() => void patchPlaylist({ title: title.trim(), description: description.trim() })} className="min-h-11 rounded-full bg-brand px-5 text-sm font-bold text-black disabled:opacity-40">Save</button>
              <button type="button" onClick={() => { setEditing(false); setTitle(playlist.title); setDescription(playlist.description || ""); }} className="min-h-11 rounded-full bg-white/[.08] px-5 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-1.5 text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">{playlist.title}</h1>
            {playlist.description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/55">{playlist.description}</p> : null}
          </>
        )}
        <p className="mt-1.5 text-sm text-white/45">{items.length} item{items.length === 1 ? "" : "s"}{totalSeconds ? ` · ${formatTotalDuration(totalSeconds)}` : ""}</p>
      </div>
    </div>

    <div className="relative mt-6 flex items-center justify-center gap-3 sm:justify-start">
      <button type="button" disabled={!playableEntries.length} onClick={() => playFrom()} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-bold text-black transition active:scale-95 disabled:opacity-40 sm:flex-none"><LibIcon name="play" size={18} /> Play</button>
      <button type="button" disabled={playableEntries.length < 2} onClick={shufflePlay} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white/[.09] px-6 text-[15px] font-semibold transition active:scale-95 disabled:opacity-40 sm:flex-none"><LibIcon name="shuffle" size={18} /> Shuffle</button>
      <button type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label="Playlist options" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/[.09] transition active:scale-95"><LibIcon name="more" size={22} /></button>
      {menuOpen ? (
        <div role="menu" className="absolute right-0 top-14 z-20 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#17171a]/98 py-1 shadow-[0_24px_60px_rgba(0,0,0,.6)] backdrop-blur-xl">
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setEditing(true); }} className={menuButton}><LibIcon name="edit" size={18} /> Edit details</button>
          <button type="button" role="menuitem" disabled={items.length < 2} onClick={() => { setMenuOpen(false); setReordering(true); }} className={`${menuButton} disabled:opacity-40`}><LibIcon name="reorder" size={18} /> Edit order</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void patchPlaylist({ isPublic: playlist.is_public === false }); }} className={menuButton}><LibIcon name={isPrivate ? "globe" : "lock"} size={18} /> Make {isPrivate ? "public" : "private"}</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void destroy(); }} className={`${menuButton} text-red-300`}><LibIcon name="trash" size={18} /> Delete playlist</button>
        </div>
      ) : null}
    </div>
    {!isPrivate ? <div className="mt-3 flex justify-center sm:justify-start"><AppShareButton title={playlist.title} text={`Listen to ${playlist.title} on BVS`} path={`/playlist/${encodeURIComponent(playlist.id)}`} kicker="BVS Playlist" /></div> : null}
    {items.length && playableEntries.length !== items.length ? <p className="mt-3 text-center text-xs text-white/45 sm:text-left">{items.length - playableEntries.length} saved item{items.length - playableEntries.length === 1 ? " is" : "s are"} not currently available on this device.</p> : null}
    {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

    {reordering ? (
      <div className="sticky top-16 z-20 mt-5 flex items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-[#101208]/95 px-4 py-2.5 backdrop-blur-xl">
        <span className="text-sm font-semibold">Reorder or remove items</span>
        <button type="button" onClick={() => setReordering(false)} className="min-h-9 rounded-full bg-brand px-4 text-sm font-bold text-black">Done</button>
      </div>
    ) : null}

    <ol className="mt-5 divide-y divide-white/[.05]">{items.map((item, index) => {
      const itemKey = keyFor(item);
      const playableEntry = playableEntries.find((entry) => entry.key === itemKey);
      const stationTrack = playableEntry?.track;
      const isBeat = Boolean(item.beat_id || item.kind === "beat");
      const isCurrent = Boolean(stationTrack?.id && stationTrack.id === currentId);
      const duration = formatTrackDuration(item.duration_sec);
      const art = item.artwork_url ? mediaUrlForStoredValue(item.artwork_url) || item.artwork_url : null;
      return <li key={itemKey} className="relative">
        <div className="flex items-center gap-3 py-2">
          <span className={`w-6 shrink-0 text-center text-sm tabular-nums ${isCurrent ? "text-brand" : "text-white/35"}`}>{isCurrent ? <span className="inline-flex h-3 items-end gap-[2px]" aria-label="Now playing"><span className="w-[3px] animate-pulse bg-brand" style={{ height: "60%" }} /><span className="w-[3px] animate-pulse bg-brand [animation-delay:150ms]" style={{ height: "100%" }} /><span className="w-[3px] animate-pulse bg-brand [animation-delay:300ms]" style={{ height: "40%" }} /></span> : index + 1}</span>
          <button type="button" disabled={!stationTrack} onClick={() => playFrom(itemKey)} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/[.05] disabled:opacity-45" aria-label={`Play ${item.title || (isBeat ? "beat" : "track")}`}>
            {art ? <Image src={art} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-[10px] font-bold text-brand">BVS</span>}
          </button>
          <button type="button" disabled={!stationTrack} onClick={() => playFrom(itemKey)} className="min-w-0 flex-1 text-left disabled:cursor-default">
            <span className="flex min-w-0 items-center gap-2"><span className={`truncate text-[15px] font-semibold ${isCurrent ? "text-brand" : ""}`}>{item.title || (isBeat ? "BVS beat" : "BVS track")}</span>{isBeat ? <span className="shrink-0 rounded border border-brand/30 px-1.5 text-[9px] font-bold uppercase tracking-wider text-brand">Beat</span> : null}</span>
            <span className="block truncate text-[13px] text-white/45">{item.artist_name || (isBeat ? "BVS producer" : "BVS artist")}{stationTrack ? "" : " · Unavailable here"}</span>
          </button>
          {reordering ? (
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" disabled={index === 0} onClick={() => void move(index, -1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/[.06] disabled:opacity-25" aria-label="Move up"><LibIcon name="up" size={18} /></button>
              <button type="button" disabled={index === items.length - 1} onClick={() => void move(index, 1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/[.06] disabled:opacity-25" aria-label="Move down"><LibIcon name="down" size={18} /></button>
              <button type="button" onClick={() => void remove(item)} className="grid h-10 w-10 place-items-center rounded-full bg-red-500/10 text-red-300" aria-label="Remove"><LibIcon name="close" size={18} /></button>
            </div>
          ) : (
            <>
              {duration ? <span className="hidden shrink-0 text-xs tabular-nums text-white/35 sm:inline">{duration}</span> : null}
              <button type="button" onClick={() => setRowMenu((value) => (value === itemKey ? null : itemKey))} aria-expanded={rowMenu === itemKey} aria-label={`More options for ${item.title || "item"}`} className="grid h-10 w-9 shrink-0 place-items-center text-white/45 hover:text-white"><LibIcon name="more" size={20} /></button>
            </>
          )}
        </div>
        {rowMenu === itemKey && !reordering ? (
          <div role="menu" className="mb-2 ml-9 flex flex-wrap gap-2">
            {stationTrack ? <button type="button" role="menuitem" onClick={() => { player.playNext(stationTrack); setRowMenu(null); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/[.07] px-3 text-[13px]"><LibIcon name="next" size={15} /> Play next</button> : null}
            {stationTrack ? <button type="button" role="menuitem" onClick={() => { player.addToQueue(stationTrack); setRowMenu(null); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/[.07] px-3 text-[13px]"><LibIcon name="queue" size={15} /> Add to queue</button> : null}
            <button type="button" role="menuitem" onClick={() => { setRowMenu(null); void remove(item); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-red-500/10 px-3 text-[13px] text-red-300"><LibIcon name="trash" size={15} /> Remove</button>
          </div>
        ) : null}
      </li>;
    })}</ol>
    {!items.length ? (
      <div className="mt-6 rounded-2xl border border-white/[.06] bg-white/[.02] px-6 py-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[.06] text-white/60"><LibIcon name="playlist" size={26} /></span>
        <h2 className="mt-4 text-lg font-semibold">This playlist is ready for its first track or beat.</h2>
        <Link href={`/app/${surface}/explore`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-bold text-black">Explore music & beats</Link>
      </div>
    ) : null}
  </div>;
}
