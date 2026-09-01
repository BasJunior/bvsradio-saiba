"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

export type AppPlaylist = {
  id: string;
  title: string;
  description?: string | null;
  is_public?: boolean;
  trackCount?: number;
  updated_at?: string;
};

export default function AppPlaylists({ surface }: { surface: AppSurface }) {
  const { token, signedIn } = useAppSession();
  const [playlists, setPlaylists] = useState<AppPlaylist[]>([]);
  const [title, setTitle] = useState("");
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

  const create = async () => {
    const name = title.trim();
    if (!name || !token) return;
    setBusy(true); setError("");
    const response = await fetch("/api/app/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: name, isPublic: true }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => ({})) as { error?: string } | undefined;
      setError(payload?.error || "Could not create playlist.");
    } else {
      setTitle("");
      await load();
      window.dispatchEvent(new CustomEvent("bvs:playlists-change"));
    }
    setBusy(false);
  };

  if (!signedIn) return null;
  return (
    <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5">
      <p className="text-xs uppercase tracking-[.18em] text-brand">Playlists</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">Build your own BVS.</h2><p className="mt-1 text-sm text-text-secondary">Synced to your account and ready across devices.</p></div></div>
      <div className="mt-4 flex gap-2"><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void create(); }} maxLength={100} placeholder="New playlist name" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:border-brand/50" /><button type="button" disabled={busy || !title.trim()} onClick={() => void create()} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-black disabled:opacity-40">{busy ? "Creating…" : "Create"}</button></div>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{playlists.map((playlist) => <Link key={playlist.id} href={`/app/${surface}/playlist/${playlist.id}`} className="rounded-2xl border border-white/10 bg-black/10 p-4 hover:border-brand/35"><div className="flex items-center justify-between gap-3"><h3 className="truncate font-semibold">{playlist.title}</h3><span className="shrink-0 text-xs text-text-secondary">{playlist.is_public === false ? "Private" : "Public"}</span></div><p className="mt-1 text-sm text-text-secondary">{playlist.trackCount || 0} track{playlist.trackCount === 1 ? "" : "s"}</p></Link>)}</div>
      {!playlists.length ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-text-secondary">Create a playlist, then add music from Explore.</p> : null}
    </section>
  );
}
