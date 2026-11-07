"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { CoverMosaic, LibIcon } from "@/components/app-vnext/LibraryVisuals";
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
  /** Up to four public cover images, in playlist order. */
  coverArtwork?: string[];
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
    <section className="mt-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[1.6rem] font-bold tracking-tight">Playlists</h2>
          <p className="mt-0.5 text-sm text-white/45">Mix BVS tracks and BeatStore beats in one order.</p>
        </div>
        {!showCreate ? <button type="button" onClick={() => setShowCreate(true)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-black transition active:scale-95"><LibIcon name="plus" size={16} /> New</button> : null}
      </div>

      {showCreate ? (
        <div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.03] p-4">
          <div className="flex items-start gap-4">
            <CoverMosaic images={[]} seed={title || "new-playlist"} className="w-20 shrink-0" />
            <div className="min-w-0 flex-1">
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Playlist name" autoFocus aria-label="Playlist name" className="min-h-11 w-full border-b border-white/15 bg-transparent text-lg font-semibold outline-none transition placeholder:text-white/30 focus:border-brand" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="Add a description (optional)" aria-label="Playlist description" className="mt-2 w-full resize-none bg-transparent text-sm text-white/80 outline-none placeholder:text-white/30" />
            </div>
          </div>
          <label className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-black/20 p-3">
            <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/[.06] text-white/70"><LibIcon name={isPublic ? "globe" : "lock"} size={18} /></span><span><span className="block text-sm font-semibold">{isPublic ? "Public playlist" : "Private playlist"}</span><span className="block text-xs text-white/40">{isPublic ? "Anyone on BVS can open and share it." : "Only you can see it. You can share it later."}</span></span></span>
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} className="h-5 w-5 accent-brand" aria-label="Make playlist public" />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy || !title.trim()} onClick={() => void create()} className="min-h-11 flex-1 rounded-full bg-brand px-5 text-sm font-bold text-black transition disabled:opacity-40">{busy ? "Creating…" : "Create playlist"}</button>
            <button type="button" onClick={() => { setShowCreate(false); setError(""); }} className="min-h-11 rounded-full bg-white/[.08] px-5 text-sm font-semibold">Cancel</button>
          </div>
        </div>
      ) : null}

      {loadError ? <div role="alert" className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/[.06] p-4 text-sm text-red-200"><p>{loadError}</p><button type="button" onClick={() => void load()} className="mt-2 min-h-10 font-semibold text-brand underline">Try again</button></div> : null}

      {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <div className="mt-4 space-y-2" aria-label="Loading playlists">
          {[0, 1, 2].map((index) => <div key={index} className="flex items-center gap-3"><div className="h-16 w-16 animate-pulse rounded-lg bg-white/[.05]" /><div className="flex-1 space-y-2"><div className="h-3.5 w-1/2 animate-pulse rounded bg-white/[.06]" /><div className="h-3 w-1/3 animate-pulse rounded bg-white/[.04]" /></div></div>)}
        </div>
      ) : null}

      <div className="mt-4 grid gap-1 sm:grid-cols-2 sm:gap-x-4">
        {playlists.map((playlist) => {
          const itemCount = playlist.itemCount ?? playlist.trackCount ?? 0;
          const isPrivate = playlist.is_public === false;
          return <Link key={playlist.id} href={`/app/${surface}/playlist/${playlist.id}`} className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[.04]">
            <CoverMosaic images={playlist.coverArtwork || []} seed={playlist.id} className="w-16 shrink-0" rounded="rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{playlist.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/45">
                <LibIcon name={isPrivate ? "lock" : "globe"} size={13} />
                <span className="truncate">{isPrivate ? "Private" : "Public"} · {itemCount} item{itemCount === 1 ? "" : "s"}</span>
              </span>
              {playlist.description ? <span className="mt-0.5 block truncate text-xs text-white/35">{playlist.description}</span> : null}
            </span>
            <span className="text-white/30 transition group-hover:text-white/70"><LibIcon name="chevron" size={18} /></span>
          </Link>;
        })}
      </div>

      {!loading && !loadError && !playlists.length ? (
        <div className="mt-4 rounded-2xl border border-white/[.06] bg-white/[.02] px-6 py-9 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[.06] text-white/60"><LibIcon name="playlist" size={26} /></span>
          <h3 className="mt-4 text-lg font-semibold">Create your first playlist</h3>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-white/45">Create a playlist, then add music or beats from Discover.</p>
          {!showCreate ? <button type="button" onClick={() => setShowCreate(true)} className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold text-black"><LibIcon name="plus" size={16} /> New playlist</button> : null}
        </div>
      ) : null}
    </section>
  );
}
