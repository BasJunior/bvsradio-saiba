"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppPlaylist } from "@/components/app-vnext/AppPlaylists";
import { useStationPlayer } from "@/components/StationPlayer";
import { shareBvs } from "@/lib/app-native";
import { recordListening } from "@/lib/library";
import { mediaUrlForStoredValue } from "@/lib/media-url";

type PlaylistTrack = {
  id: string;
  track_id: string;
  position: number;
  title?: string;
  artist_name?: string;
  genre?: string;
  artwork_url?: string;
  duration_sec?: number;
};

export default function AppPlaylistDetailClient({ surface, playlistId }: { surface: AppSurface; playlistId: string }) {
  const router = useRouter();
  const player = useStationPlayer();
  const { token, signedIn, loading } = useAppSession();
  const [playlist, setPlaylist] = useState<AppPlaylist | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [listResponse, tracksResponse] = await Promise.all([
      fetch("/api/app/playlists", { headers, cache: "no-store" }).catch(() => null),
      fetch(`/api/app/playlists/${playlistId}/tracks`, { headers, cache: "no-store" }).catch(() => null),
    ]);
    if (!listResponse?.ok || !tracksResponse?.ok) return setError("Playlist could not be loaded.");
    const list = (await listResponse.json()) as { playlists?: AppPlaylist[] };
    const payload = (await tracksResponse.json()) as { tracks?: PlaylistTrack[] };
    const found = (list.playlists || []).find((item) => item.id === playlistId) || null;
    setPlaylist(found); setTitle(found?.title || ""); setDescription(found?.description || ""); setTracks(payload.tracks || []); setError(found ? "" : "Playlist not found.");
  }, [playlistId, token]);

  useEffect(() => { void load(); }, [load]);
  const orderedIds = useMemo(() => tracks.map((item) => item.track_id), [tracks]);
  const clearedById = useMemo(() => new Map(player.tracks.filter((track) => track.id).map((track) => [track.id as string, track])), [player.tracks]);
  const playableTracks = useMemo(() => tracks.map((item) => clearedById.get(item.track_id)).filter((track): track is NonNullable<typeof track> => Boolean(track)), [clearedById, tracks]);

  const rememberPlay = (trackId?: string) => {
    const track = trackId ? clearedById.get(trackId) : playableTracks[0];
    if (!track) return;
    recordListening({ id: track.id || track.src, kind: "track", title: track.title, subtitle: track.artist, href: "/radio", image: track.artwork });
  };

  const playFrom = (trackId?: string) => {
    if (!playlist || !playableTracks.length) return;
    const startIndex = trackId ? Math.max(0, playableTracks.findIndex((track) => track.id === trackId)) : 0;
    rememberPlay(playableTracks[startIndex]?.id);
    player.playAll(playableTracks, { from: playlist.title, startIndex });
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  const shufflePlay = () => {
    if (!playlist || !playableTracks.length) return;
    const shuffled = [...playableTracks];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    rememberPlay(shuffled[0]?.id);
    player.playAll(shuffled, { from: `${playlist.title} · Shuffle` });
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

  const remove = async (trackId: string) => {
    if (!token) return;
    const response = await fetch(`/api/app/playlists/${playlistId}/tracks`, { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ trackId }) }).catch(() => null);
    if (response?.ok) await load();
  };

  const move = async (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (!token || nextIndex < 0 || nextIndex >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setTracks((current) => {
      const copy = [...current]; [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]]; return copy.map((item, position) => ({ ...item, position }));
    });
    const response = await fetch(`/api/app/playlists/${playlistId}/tracks`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ trackIds: next }) }).catch(() => null);
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
    <button type="button" onClick={() => router.back()} className="text-sm text-text-secondary">← Library</button>
    <div className="mt-5 rounded-[1.9rem] border border-brand/20 bg-gradient-to-br from-brand/[.10] to-white/[.02] p-6">
      <p className="text-xs uppercase tracking-[.18em] text-brand">Your playlist</p>
      {editing ? <div className="mt-3 space-y-2"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-xl font-semibold" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} placeholder="Playlist description" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" /><div className="flex gap-2"><button type="button" disabled={busy || !title.trim()} onClick={() => void patchPlaylist({ title: title.trim(), description: description.trim() })} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-black">Save</button><button type="button" onClick={() => { setEditing(false); setTitle(playlist.title); setDescription(playlist.description || ""); }} className="rounded-xl border border-white/15 px-4 py-2 text-sm">Cancel</button></div></div> : <><h1 className="mt-2 text-4xl font-semibold tracking-tight">{playlist.title}</h1>{playlist.description ? <p className="mt-2 max-w-2xl text-sm text-text-secondary">{playlist.description}</p> : null}</>}
      <p className="mt-2 text-sm text-text-secondary">{tracks.length} track{tracks.length === 1 ? "" : "s"} · {playlist.is_public === false ? "Private" : "Public"}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={!playableTracks.length} onClick={() => playFrom()} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40">▶ Play</button>
        <button type="button" disabled={playableTracks.length < 2} onClick={shufflePlay} className="min-h-11 rounded-full border border-brand/35 px-5 text-sm font-semibold text-brand disabled:opacity-40">Shuffle play</button>
        <button type="button" onClick={() => setEditing((value) => !value)} className="min-h-10 rounded-full border border-white/15 px-4 text-sm">Edit</button>
        <button type="button" onClick={() => void patchPlaylist({ isPublic: playlist.is_public === false })} className="min-h-10 rounded-full border border-white/15 px-4 text-sm">Make {playlist.is_public === false ? "public" : "private"}</button>
        {playlist.is_public !== false ? <button type="button" onClick={() => void shareBvs({ title: playlist.title, text: `Listen to ${playlist.title} on BVS`, url: `${window.location.origin}/app/${surface}/playlist/${playlist.id}` })} className="min-h-10 rounded-full border border-white/15 px-4 text-sm">Share</button> : null}
        <button type="button" onClick={() => void destroy()} className="min-h-10 rounded-full border border-red-400/25 px-4 text-sm text-red-200">Delete</button>
      </div>
      {tracks.length && playableTracks.length !== tracks.length ? <p className="mt-3 text-xs text-text-secondary">{tracks.length - playableTracks.length} saved track{tracks.length - playableTracks.length === 1 ? " is" : "s are"} not cleared for this app surface or currently unavailable.</p> : null}
    </div>
    {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
    <div className="mt-6 space-y-2">{tracks.map((track, index) => {
      const playable = clearedById.has(track.track_id);
      const stationTrack = clearedById.get(track.track_id);
      return <article key={track.track_id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.02] p-3">
        <button type="button" disabled={!playable} onClick={() => playFrom(track.track_id)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl disabled:opacity-45" aria-label={`Play ${track.title || "track"}`}>
          {track.artwork_url ? <Image src={mediaUrlForStoredValue(track.artwork_url) || track.artwork_url} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center bg-white/5 text-xs text-brand">BVS</span>}
          {playable ? <span className="absolute inset-0 grid place-items-center bg-black/25 text-lg text-white">▶</span> : null}
        </button>
        <div className="min-w-0 flex-1"><button type="button" disabled={!playable} onClick={() => playFrom(track.track_id)} className="block w-full text-left disabled:cursor-default"><h2 className="truncate font-semibold">{track.title || "BVS track"}</h2><p className="truncate text-sm text-text-secondary">{track.artist_name || "BVS artist"}</p></button>{playable && stationTrack ? <div className="mt-2 flex flex-wrap gap-1"><button type="button" onClick={() => player.playNext(stationTrack)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-text-secondary">Play next</button><button type="button" onClick={() => player.addToQueue(stationTrack)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-text-secondary">Add to queue</button></div> : <p className="mt-1 text-xs text-amber-200/80">Unavailable on this app surface</p>}</div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" disabled={index === 0} onClick={() => void move(index, -1)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 disabled:opacity-25" aria-label="Move up">↑</button>
          <button type="button" disabled={index === tracks.length - 1} onClick={() => void move(index, 1)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 disabled:opacity-25" aria-label="Move down">↓</button>
          <button type="button" onClick={() => void remove(track.track_id)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-red-200" aria-label="Remove">×</button>
        </div>
      </article>;
    })}</div>
    {!tracks.length ? <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center"><h2 className="text-xl font-semibold">This playlist is ready for its first track.</h2><button type="button" onClick={() => router.push(`/app/${surface}/explore`)} className="mt-4 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black">Explore music</button></div> : null}
  </div>;
}
