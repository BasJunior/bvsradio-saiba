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
    <section className="mt-9 rounded-[1.7rem] border border-white/[.07] bg-white/[.022] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Playlists</p>
          <h2 className="mt-2 text-3xl font-semibold">Put the music together your way.</h2>
          <p className="mt-2 text-sm leading-6 text-white/38">Playlists start private. Share one only when you choose to make it public.</p>
        </div>
        <button type="button" onClick={() => setShowCreate((value) => !value)} className="min-h-10 rounded-full border border-brand/28 px-4 text-sm font-semibold text-brand transition hover:bg-brand/[.08]">{showCreate ? "Cancel" : "+ New playlist"}</button>
      </div>

      {showCreate ? (
        <div className="mt-5 rounded-[1.25rem] border border-white/[.07] bg-black/10 p-4">
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Playlist name" className="min-h-11 w-full rounded-[1rem] border border-white/[.08] bg-black/20 px-4 outline-none transition focus:border-brand/35" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="Optional description" className="mt-2 w-full rounded-[1rem] border border-white/[.08] bg-black/20 px-4 py-3 outline-none transition focus:border-brand/35" />
          <label className="mt-3 flex items-center justify-between gap-4 rounded-[1rem] border border-white/[.07] p-3">
            <span><span className="block text-sm font-semibold">Public playlist</span><span className="mt-1 block text-xs text-white/34">Anyone on BVS can open and share it.</span></span>
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-5 w-5 accent-brand" />
          </label>
          <button type="button" disabled={busy || !title.trim()} onClick={() => void create()} className="mt-3 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-brand disabled:opacity-40">{busy ? "Creating…" : "Create playlist"}</button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {playlists.map((playlist) => (
          <Link key={playlist.id} href={`/app/${surface}/playlist/${playlist.id}`} className="group rounded-[1.25rem] border border-white/[.07] bg-black/10 p-4 transition hover:border-white/15 hover:bg-white/[.03]">
            <div className="flex items-center justify-between gap-3"><h3 className="truncate font-semibold">{playlist.title}</h3><span className="shrink-0 rounded-full border border-white/[.07] px-2.5 py-1 text-[11px] text-white/34">{playlist.is_public === false ? "Private" : "Public"}</span></div>
            {playlist.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/38">{playlist.description}</p> : null}
            <div className="mt-3 flex items-center justify-between gap-2"><p className="text-sm text-white/34">{playlist.trackCount || 0} track{playlist.trackCount === 1 ? "" : "s"}</p><span className="text-white/48 transition group-hover:text-brand">Open →</span></div>
          </Link>
        ))}
      </div>

      {!playlists.length ? <p className="mt-5 rounded-[1rem] border border-dashed border-white/10 p-4 text-sm text-white/38">Create a playlist, then add music from Discover.</p> : null}
    </section>
  );
}
