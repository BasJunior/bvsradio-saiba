"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { withAuthTimeout } from "@/lib/auth-client-flow";

export type AppPlaylist = {
  id: string;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  is_public?: boolean;
  trackCount?: number;
  itemCount?: number;
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const loadVersion = useRef(0);
  const invalidateLoads = useCallback(() => { ++loadVersion.current; }, []);

  const load = useCallback(async () => {
    const request = ++loadVersion.current;
    await Promise.resolve();
    if (!token) {
      if (request === loadVersion.current) { setPlaylists([]); setLoading(false); setLoadError(""); }
      return;
    }
    setLoading(true);
    setLoadError("");
    let result: { response: Response; payload: { playlists?: AppPlaylist[]; error?: string } };
    try {
      result = await withAuthTimeout(
        fetch("/api/app/playlists", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
          .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) as { playlists?: AppPlaylist[]; error?: string } })),
        12000,
        "Playlist loading took too long. Please try again.",
      );
    } catch (caught) {
      if (request === loadVersion.current) {
        setLoadError(caught instanceof Error ? caught.message : "Could not load playlists.");
        setLoading(false);
      }
      return;
    }
    if (request !== loadVersion.current) return;
    if (!result.response.ok) {
      setLoadError(result.payload.error || "Could not load playlists.");
      setLoading(false);
      return;
    }
    setPlaylists(result.payload.playlists || []);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => { window.clearTimeout(timer); invalidateLoads(); };
  }, [invalidateLoads, load]);
  useEffect(() => {
    const sync = () => void load();
    window.addEventListener("bvs:playlists-change", sync);
    return () => window.removeEventListener("bvs:playlists-change", sync);
  }, [load]);

  const create = async () => {
    const name = title.trim();
    if (!name || !token) return;
    setBusy(true); setError("");
    try {
      const response = await withAuthTimeout(fetch("/api/app/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: name, description: description.trim(), isPublic }),
      }), 12000, "Playlist creation took too long. Please try again.");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(payload.error || "Could not create playlist.");
      } else {
        setTitle(""); setDescription(""); setIsPublic(false); setShowCreate(false);
        window.dispatchEvent(new CustomEvent("bvs:playlists-change"));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create playlist.");
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) return null;

  return (
    <section className="mt-9 rounded-[1.7rem] border border-white/[.07] bg-white/[.022] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Playlists</p>
          <h2 className="mt-2 text-3xl font-semibold">Put the music and beats together your way.</h2>
          <p className="mt-2 text-sm leading-6 text-white/38">Mix BVS tracks and BeatStore beats in one order. Playlists start private; share one only when you make it public.</p>
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

      {loadError ? <div role="alert" className="mt-4 rounded-[1rem] border border-red-400/20 bg-red-500/[.06] p-4 text-sm text-red-200"><p>{loadError}</p><button type="button" onClick={() => void load()} className="mt-2 min-h-10 font-semibold text-brand underline">Try again</button></div> : null}

      {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}

      {loading ? <div className="mt-5 h-20 animate-pulse rounded-[1rem] bg-white/[.035]" aria-label="Loading playlists" /> : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {playlists.map((playlist) => {
          const itemCount = playlist.itemCount ?? playlist.trackCount ?? 0;
          return <Link key={playlist.id} href={`/app/${surface}/playlist/${playlist.id}`} className="group rounded-[1.25rem] border border-white/[.07] bg-black/10 p-4 transition hover:border-white/15 hover:bg-white/[.03]">
            <div className="flex items-center justify-between gap-3"><h3 className="truncate font-semibold">{playlist.title}</h3><span className="shrink-0 rounded-full border border-white/[.07] px-2.5 py-1 text-[11px] text-white/34">{playlist.is_public === false ? "Private" : "Public"}</span></div>
            {playlist.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/38">{playlist.description}</p> : null}
            <div className="mt-3 flex items-center justify-between gap-2"><p className="text-sm text-white/34">{itemCount} item{itemCount === 1 ? "" : "s"}</p><span className="text-white/48 transition group-hover:text-brand">Open →</span></div>
          </Link>;
        })}
      </div>

      {!loading && !loadError && !playlists.length ? <p className="mt-5 rounded-[1rem] border border-dashed border-white/10 p-4 text-sm text-white/38">Create a playlist, then add music or beats from Discover.</p> : null}
    </section>
  );
}
