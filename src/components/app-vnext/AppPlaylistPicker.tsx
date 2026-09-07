"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppPlaylist } from "@/components/app-vnext/AppPlaylists";

export default function AppPlaylistPicker({ trackId, compact = false }: { trackId: string; compact?: boolean }) {
  const { token, signedIn } = useAppSession();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<AppPlaylist[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const response = await fetch("/api/app/playlists", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json()) as { playlists?: AppPlaylist[] };
    setPlaylists(payload.playlists || []);
  }, [token]);

  useEffect(() => {
    if (open) void load();
    const refresh = () => { if (open) void load(); };
    window.addEventListener("bvs:playlists-change", refresh);
    return () => window.removeEventListener("bvs:playlists-change", refresh);
  }, [load, open]);

  if (!signedIn) return null;

  const add = async (playlist: AppPlaylist) => {
    if (!token) return;
    setBusyId(playlist.id); setMessage("");
    const response = await fetch(`/api/app/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackId }),
    }).catch(() => null);
    if (response?.ok) {
      setMessage(`Added to ${playlist.title}`);
      window.dispatchEvent(new CustomEvent("bvs:playlists-change"));
      window.setTimeout(() => setOpen(false), 650);
    } else {
      const payload = await response?.json().catch(() => ({})) as { error?: string } | undefined;
      setMessage(payload?.error || "Could not add this track.");
    }
    setBusyId("");
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className={compact ? "min-h-9 rounded-full border border-white/10 px-3 text-xs text-text-secondary hover:border-brand/35 hover:text-brand" : "min-h-10 rounded-full border border-white/10 px-4 text-sm font-semibold hover:border-brand/35 hover:text-brand"}>+ Playlist</button>
    {open ? <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Add to playlist" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}><div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#111417] p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Add to playlist</p><h2 className="mt-1 text-xl font-semibold">Where should this live?</h2></div><button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10" aria-label="Close">×</button></div><div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto">{playlists.map((playlist) => <button key={playlist.id} type="button" disabled={busyId === playlist.id} onClick={() => void add(playlist)} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-white/10 px-4 text-left hover:border-brand/35"><span className="min-w-0 truncate font-semibold">{playlist.title}</span><span className="ml-3 shrink-0 text-xs text-text-secondary">{busyId === playlist.id ? "Adding…" : `${playlist.trackCount || 0} tracks`}</span></button>)}</div>{!playlists.length ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-text-secondary">Create your first playlist in Library, then come back here.</p> : null}{message ? <p className="mt-3 text-sm text-brand">{message}</p> : null}</div></div> : null}
  </>;
}
