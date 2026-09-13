"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppPlaylist } from "@/components/app-vnext/AppPlaylists";
import AppShareButton from "@/components/app-vnext/AppShareButton";
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

  if (loading) return <div className="mx-auto max-w-4xl px-4 pt-8"><div className="h-48 animate-pulse rounded-[2rem] bg-white/[.04]" /></div>;
  if (!signedIn) return <div className="mx-auto max-w-4xl px-4 py-10 text-center"><h1 className="text-3xl font-semibold">Sign in to open this playlist.</h1></div>;
  if (!playlist) return <div className="mx-auto max-w-4xl px-4 py-10"><h1 className="text-3xl font-semibold">{error || "Loading playlist…"}</h1></div>;

  return <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6">
    <Link href={`/app/${surface}/library`} className="inline-flex min-h-10 items-center text-sm text-text-secondary">← Library</Link>
    <div className="mt-5 rounded-[1.9rem] border border-brand/20 bg-gradient-to-br from-brand/[.10] to-white/[.02] p-6">
      <p className="text-xs uppercase tracking-[.18em] text-brand">Your playlist</p>
      {editing ? <div className="mt-3 space-y-2"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-xl font-semibold" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} placeholder="Playlist description" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" /><div className="flex gap-2"><button type="button" disabled={busy || !title.trim()} onClick={() => void patchPlaylist({ title: title.trim(), description: description.trim() })} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-black">Save</button><button type="button" onClick={() => { setEditing(false); setTitle(playlist.title); setDescription(playlist.description || ""); }} className="rounded-xl border border-white/15 px-4 py-2 text-sm">Cancel</button></div></div> : <><h1 className="mt-2 text-4xl font-semibold tracking-tight">{playlist.title}</h1>{playlist.description ? <p className="mt-2 max-w-2xl text-sm text-text-secondary">{playlist.description}</p> : null}</>}
      <p className="mt-2 text-sm text-text-secondary">{items.length} item{items.length === 1 ? "" : "s"} · {playlist.is_public === false ? "Private" : "Public"}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={!playableEntries.length} onClick={() => playFrom()} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40">▶ Play</button>
        <button type="button" disabled={playableEntries.length < 2} onClick={shufflePlay} className="min-h-11 rounded-full border border-brand/35 px-5 text-sm font-semibold text-brand disabled:opacity-40">Shuffle play</button>
        <button type="button" onClick={() => setEditing((value) => !value)} className="min-h-10 rounded-full border border-white/15 px-4 text-sm">Edit</button>
        <button type="button" onClick={() => void patchPlaylist({ isPublic: playlist.is_public === false })} className="min-h-10 rounded-full border border-white/15 px-4 text-sm">Make {playlist.is_public === false ? "public" : "private"}</button>
        {playlist.is_public !== false ? <AppShareButton title={playlist.title} text={`Listen to ${playlist.title} on BVS`} path={`/playlist/${encodeURIComponent(playlist.id)}`} kicker="BVS Playlist" /> : null}
        <button type="button" onClick={() => void destroy()} className="min-h-10 rounded-full border border-red-400/25 px-4 text-sm text-red-200">Delete</button>
      </div>
      {items.length && playableEntries.length !== items.length ? <p className="mt-3 text-xs text-text-secondary">{items.length - playableEntries.length} saved item{items.length - playableEntries.length === 1 ? " is" : "s are"} not currently available on this device.</p> : null}
    </div>
    {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    <div className="mt-6 space-y-2">{items.map((item, index) => {
      const itemKey = keyFor(item);
      const playableEntry = playableEntries.find((entry) => entry.key === itemKey);
      const stationTrack = playableEntry?.track;
      const isBeat = Boolean(item.beat_id || item.kind === "beat");
      return <article key={itemKey} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.02] p-3">
        <button type="button" disabled={!stationTrack} onClick={() => playFrom(itemKey)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl disabled:opacity-45" aria-label={`Play ${item.title || (isBeat ? "beat" : "track")}`}>
          {item.artwork_url ? <Image src={mediaUrlForStoredValue(item.artwork_url) || item.artwork_url} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center bg-white/5 text-xs text-brand">BVS</span>}
          {stationTrack ? <span className="absolute inset-0 grid place-items-center bg-black/25 text-lg text-white">▶</span> : null}
        </button>
        <div className="min-w-0 flex-1"><button type="button" disabled={!stationTrack} onClick={() => playFrom(itemKey)} className="block w-full text-left disabled:cursor-default"><div className="flex min-w-0 items-center gap-2"><h2 className="truncate font-semibold">{item.title || (isBeat ? "BVS beat" : "BVS track")}</h2>{isBeat ? <span className="shrink-0 rounded-full border border-brand/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand">Beat</span> : null}</div><p className="truncate text-sm text-text-secondary">{item.artist_name || (isBeat ? "BVS producer" : "BVS artist")}</p></button>{stationTrack ? <div className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => player.playNext(stationTrack)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-text-secondary">Play next</button><button type="button" onClick={() => player.addToQueue(stationTrack)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-text-secondary">Add to queue</button></div> : <p className="mt-1 text-xs text-amber-200/80">Unavailable here</p>}</div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" disabled={index === 0} onClick={() => void move(index, -1)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 disabled:opacity-25" aria-label="Move up">↑</button>
          <button type="button" disabled={index === items.length - 1} onClick={() => void move(index, 1)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 disabled:opacity-25" aria-label="Move down">↓</button>
          <button type="button" onClick={() => void remove(item)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-red-200" aria-label="Remove">×</button>
        </div>
      </article>;
    })}</div>
    {!items.length ? <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center"><h2 className="text-xl font-semibold">This playlist is ready for its first track or beat.</h2><Link href={`/app/${surface}/explore`} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black">Explore music & beats</Link></div> : null}
  </div>;
}
