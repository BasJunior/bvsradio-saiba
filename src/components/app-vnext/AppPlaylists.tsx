"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

export type AppPlaylist = {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  is_public?: boolean;
  trackCount?: number;
  updated_at?: string;
};

export default function AppPlaylists({ surface }: { surface: AppSurface }) {
  const { token, signedIn } = useAppSession();
  const [playlists, setPlaylists] = useState<AppPlaylist[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return setPlaylists([]);
    const response = await fetch("/api/app/playlists", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json()) as { playlists?: AppPlaylist[] };
    setPlaylists(payload.playlists || []);
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const sync = () => void load();
    window.addEventListener("bvs:playlists-change", sync);
    return () => window.removeEventListener("bvs:playlists-change", sync);
  }, [load]);

  const create = async () => {
    const name = title.trim();
    if (!name || !token) return;
    setBusy(true); setError("");
    const response = await fetch("/api/app/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: name, description: description.trim(), isPublic }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => ({})) as { error?: string } | undefined;
      setError(payload?.error || "Could not create playlist.");
    } else {
      setTitle(""); setDescription(""); setIsPublic(false); setShowCreate(false);
      await load();
      window.dispatchEvent(new CustomEvent("bvs:playlists-change"));
    }
    setBusy(false);
  };

  if (!signedIn) return null;
  return (
    <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Playlists</p><h2 className="mt-1 text-2xl font-semibold">Build your own BVS.</h2><p className="mt-1 text-sm text-text-secondary">Private by default. Make a playlist public only when you want to share it.</p></div><button type="button" onClick={() => setShowCreate((value) => !value)} className="min-h-10 rounded-full border border-brand/35 px-4 text-sm font-semibold text-brand">{showCreate ? "Cancel" : "+ New playlist"}</button></div>
      {showCreate ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Playlist name" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:border-brand/50" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="Optional description" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-brand/50" /><label className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3"><span><span className="block text-sm font-semibold">Public playlist</span><span className="mt-0.5 block text-xs text-text-secondary">Anyone with access to BVS can open and share it.</span></span><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-5 w-5 accent-brand" /></label><button type="button" disabled={busy || !title.trim()} onClick={() => void create()} className="mt-3 min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40">{busy ? "Creating…" : "Create playlist"}</button></div> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">{playlists.map((playlist) => <Link key={playlist.id} href={`/app/${surface}/playlist/${playlist.id}`} className="rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-brand/35"><div className="flex items-center justify-between gap-3"><h3 className="truncate font-semibold">{playlist.title}</h3><span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-text-secondary">{playlist.is_public === false ? "Private" : "Public"}</span></div>{playlist.description ? <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{playlist.description}</p> : null}<div className="mt-3 flex items-center justify-between gap-2"><p className="text-sm text-text-secondary">{playlist.trackCount || 0} track{playlist.trackCount === 1 ? "" : "s"}</p><span className="text-brand">Open →</span></div></Link>)}</div>
      {!playlists.length ? <p className="mt-5 rounded-xl border border-dashed border-white/10 p-4 text-sm text-text-secondary">Create a playlist, then add rights-cleared music from Explore.</p> : null}
    </section>
  );
}
