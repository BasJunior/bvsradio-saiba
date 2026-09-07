"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readLibrary, toggleLibraryItem } from "@/lib/library";
import type { DiscoveryItem } from "@/lib/discovery";
import { useLibrarySync } from "@/components/LibrarySyncProvider";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import { appExplore } from "@/lib/app-surface";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import PlaylistQuickAdd from "@/components/library/PlaylistQuickAdd";
import WebPlaylists from "@/components/library/WebPlaylists";

type ActiveSection = "all" | "liked" | "playlists" | "downloads" | "following" | "recent" | "saved-beats" | "licensed-beats";
type OwnedBeat = {
  beatId: string;
  orderReference: string;
  title: string;
  producerName: string;
  licenceCode: string;
  licenceSummary: string;
  workspaceId?: string | null;
};
type LibraryDownload = {
  reference: string;
  createdAt: string;
  itemId: string;
  title: string;
  href: string;
  orderHref: string;
};
type PlaylistSummary = {
  id: string;
  title: string;
  description?: string | null;
  is_public?: boolean;
  trackCount?: number;
};

const sectionMeta: Array<{ id: ActiveSection; label: string; copy: string }> = [
  { id: "all", label: "All", copy: "Your most useful music, playlists and downloads without the long scroll." },
  { id: "liked", label: "Liked Music", copy: "Songs and releases you want to hear again." },
  { id: "playlists", label: "Playlists", copy: "Listening sessions you build from BVS music." },
  { id: "downloads", label: "Downloads", copy: "Purchased music files that are ready for you." },
  { id: "following", label: "Following", copy: "Artists and producers you want to keep close." },
  { id: "recent", label: "Recently Played", copy: "Pick up where you left off." },
  { id: "saved-beats", label: "Saved Beats", copy: "Beat ideas you may want to write to or licence." },
  { id: "licensed-beats", label: "Licensed Beats", copy: "Beat licences you have purchased through BVS." },
];

const primarySections: ActiveSection[] = ["all", "liked", "playlists", "downloads"];
const secondarySections: ActiveSection[] = ["following", "recent"];
const creatorSections: ActiveSection[] = ["saved-beats", "licensed-beats"];

function metaFor(section: ActiveSection) {
  return sectionMeta.find((item) => item.id === section) || sectionMeta[0];
}

function initialSection(): ActiveSection {
  if (typeof window === "undefined") return "all";
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("section") || window.location.hash.replace(/^#/, "");
  const allowed = sectionMeta.map((item) => item.id);
  return allowed.includes(requested as ActiveSection) ? requested as ActiveSection : "all";
}

function rawTrackId(item: DiscoveryItem) {
  return item.kind === "track" ? item.id.replace(/^track-/, "") : "";
}

export default function LibraryView() {
  const [active, setActive] = useState<ActiveSection>("all");
  const [favourites, setFavourites] = useState<DiscoveryItem[]>([]);
  const [following, setFollowing] = useState<DiscoveryItem[]>([]);
  const [history, setHistory] = useState<DiscoveryItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [downloads, setDownloads] = useState<LibraryDownload[]>([]);
  const [libraryMetaLoading, setLibraryMetaLoading] = useState(false);
  const [downloadsError, setDownloadsError] = useState("");
  const [ownedBeats, setOwnedBeats] = useState<OwnedBeat[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [ownedError, setOwnedError] = useState("");
  const [openingBeat, setOpeningBeat] = useState("");
  const { state, signedIn, syncNow } = useLibrarySync();
  const { surface } = useAppSurface();
  const discoverHref = surface ? appExplore(surface) : "/search";
  const webOnly = !surface;

  useEffect(() => { setActive(initialSection()); }, []);
  useEffect(() => {
    if (!webOnly && (active === "saved-beats" || active === "licensed-beats")) setActive("all");
  }, [active, webOnly]);

  useEffect(() => {
    const sync = () => {
      setFavourites(readLibrary("favourites"));
      setFollowing(readLibrary("follows"));
      setHistory(readLibrary("history"));
    };
    sync();
    window.addEventListener("bvs:library-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bvs:library-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!signedIn || !isSupabaseConfigured()) {
      setPlaylists([]);
      setDownloads([]);
      setLibraryMetaLoading(false);
      setDownloadsError("");
      return;
    }
    let cancelled = false;
    setLibraryMetaLoading(true);
    setDownloadsError("");
    createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [playlistResponse, downloadsResponse] = await Promise.all([
        fetch("/api/playlists", { headers, cache: "no-store" }).catch(() => null),
        fetch("/api/library/downloads", { headers, cache: "no-store" }).catch(() => null),
      ]);
      if (cancelled) return;
      if (playlistResponse?.ok) {
        const payload = await playlistResponse.json().catch(() => ({}));
        setPlaylists(Array.isArray(payload.playlists) ? payload.playlists : []);
      }
      if (downloadsResponse?.ok) {
        const payload = await downloadsResponse.json().catch(() => ({}));
        setDownloads(Array.isArray(payload.downloads) ? payload.downloads : []);
      } else if (downloadsResponse) {
        const payload = await downloadsResponse.json().catch(() => ({}));
        setDownloadsError(payload.error || "Could not load downloads.");
      }
    }).catch(() => {
      if (!cancelled) setDownloadsError("Could not load downloads.");
    }).finally(() => {
      if (!cancelled) setLibraryMetaLoading(false);
    });
    return () => { cancelled = true; };
  }, [signedIn]);

  useEffect(() => {
    const refresh = () => {
      if (!signedIn || !isSupabaseConfigured()) return;
      createClient().auth.getSession().then(async ({ data }) => {
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch("/api/playlists", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
        if (!response?.ok) return;
        const payload = await response.json().catch(() => ({}));
        setPlaylists(Array.isArray(payload.playlists) ? payload.playlists : []);
      });
    };
    window.addEventListener("bvs:playlists-change", refresh);
    return () => window.removeEventListener("bvs:playlists-change", refresh);
  }, [signedIn]);

  useEffect(() => {
    if (!webOnly || active !== "licensed-beats" || !signedIn || !isSupabaseConfigured()) {
      if (!signedIn) setOwnedBeats([]);
      return;
    }
    let cancelled = false;
    setOwnedLoading(true);
    setOwnedError("");
    createClient()
      .auth.getSession()
      .then(async ({ data }) => {
        const token = data.session?.access_token;
        if (!token) throw new Error("Sign in to see your licences.");
        const response = await fetch("/api/library/owned", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load licences.");
        if (!cancelled) setOwnedBeats(Array.isArray(payload.beats) ? payload.beats : []);
      })
      .catch((caught) => {
        if (!cancelled) setOwnedError(caught instanceof Error ? caught.message : "Could not load licences.");
      })
      .finally(() => {
        if (!cancelled) setOwnedLoading(false);
      });
    return () => { cancelled = true; };
  }, [active, signedIn, webOnly]);

  const likedMusic = useMemo(() => favourites.filter(item => item.kind !== "beat"), [favourites]);
  const savedBeats = useMemo(() => favourites.filter(item => item.kind === "beat"), [favourites]);

  const changeSection = (section: ActiveSection) => {
    setActive(section);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", section);
      url.hash = "";
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const remove = (section: "favourites" | "follows", item: DiscoveryItem) => {
    toggleLibraryItem(section, item);
  };

  async function writeToBeat(beat: OwnedBeat) {
    if (beat.workspaceId) {
      window.location.href = `/creator/studio/songs/${beat.workspaceId}`;
      return;
    }
    if (!isSupabaseConfigured()) return;
    setOpeningBeat(beat.beatId);
    setOwnedError("");
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in before opening Lyrics Pad.");
      const response = await fetch("/api/creator/song-workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderReference: beat.orderReference, beatId: beat.beatId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not open Lyrics Pad.");
      window.location.href = `/creator/studio/songs/${payload.workspace.id}`;
    } catch (caught) {
      setOwnedError(caught instanceof Error ? caught.message : "Could not open Lyrics Pad.");
      setOpeningBeat("");
    }
  }

  const renderItems = (items: DiscoveryItem[], kind: "liked" | "following" | "recent" | "saved-beats") => {
    if (!items.length) return null;
    return <div className="space-y-3">
      {items.map(item => {
        const trackId = rawTrackId(item);
        return <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[.02] p-4">
          <Link href={item.href} className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-brand">{item.kind === "beat" ? "Beat" : item.kind}</p>
            <h2 className="truncate font-medium">{item.title}</h2>
            <p className="truncate text-sm text-text-secondary">{item.subtitle}</p>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {kind === "liked" && trackId ? <PlaylistQuickAdd trackId={trackId} compact /> : null}
            {kind === "saved-beats" ? <Link href={item.href} className="min-h-10 rounded-full border border-brand/25 px-3 py-2 text-xs font-semibold text-brand">View beat</Link> : null}
            {kind !== "recent" ? <button type="button" onClick={() => remove(kind === "following" ? "follows" : "favourites", item)} className="min-h-10 rounded-full border border-white/15 px-3 py-2 text-xs text-text-secondary hover:border-red-300/40 hover:text-red-200">{kind === "following" ? "Unfollow" : "Remove"}</button> : null}
          </div>
        </div>;
      })}
    </div>;
  };

  const activeMeta = metaFor(active);
  const activeItems = active === "liked" ? likedMusic : active === "following" ? following : active === "recent" ? history : active === "saved-beats" ? savedBeats : [];

  const countFor = (section: ActiveSection) => {
    if (section === "liked") return likedMusic.length;
    if (section === "playlists") return playlists.length;
    if (section === "downloads") return downloads.length;
    if (section === "following") return following.length;
    if (section === "recent") return history.length;
    if (section === "saved-beats") return savedBeats.length;
    if (section === "licensed-beats") return ownedBeats.length;
    return undefined;
  };

  return (
    <div className="mx-auto min-h-[60vh] max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-brand">Your BVS</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Library</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">Everything you keep is one tap away. Liked music no longer pushes playlists, downloads or recent listening down the page.</p>
        </div>
        <Link href={discoverHref} className="rounded-full border border-brand/30 px-4 py-2.5 text-sm font-semibold text-brand">Explore BVS →</Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <span>
          {!signedIn
            ? "Saved on this device. Sign in to sync playlists and purchases across devices."
            : state === "synced"
              ? "Synced to your BVS account."
              : state === "syncing"
                ? "Syncing your library…"
                : "Saved locally; account sync needs attention."}
        </span>
        {signedIn && state === "error" ? <button type="button" onClick={syncNow} className="text-brand hover:underline">Try again</button> : null}
        {!signedIn ? <Link href="/auth/login?next=%2Flibrary" className="text-brand hover:underline">Sign in</Link> : null}
      </div>

      <div className="sticky top-16 z-30 -mx-4 mt-5 border-y border-white/10 bg-bg-primary/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Primary library sections">
          {primarySections.map(section => {
            const meta = metaFor(section);
            const count = countFor(section);
            return <button key={section} type="button" onClick={() => changeSection(section)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active === section ? "border-brand bg-brand text-black" : "border-white/15 text-text-secondary hover:border-brand/45 hover:text-text-primary"}`}>
              {meta.label}{typeof count === "number" ? ` · ${count}` : ""}
            </button>;
          })}
        </nav>
        <nav className="mt-2 flex gap-2 overflow-x-auto" aria-label="More library sections">
          {secondarySections.map(section => <button key={section} type="button" onClick={() => changeSection(section)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${active === section ? "bg-white/10 text-brand" : "text-text-secondary hover:text-text-primary"}`}>{metaFor(section).label}{typeof countFor(section) === "number" ? ` · ${countFor(section)}` : ""}</button>)}
          {webOnly ? creatorSections.map(section => <button key={section} type="button" onClick={() => changeSection(section)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${active === section ? "bg-white/10 text-brand" : "text-text-secondary hover:text-text-primary"}`}>{metaFor(section).label}{typeof countFor(section) === "number" ? ` · ${countFor(section)}` : ""}</button>) : null}
        </nav>
      </div>

      {active === "all" ? <section className="mt-6" aria-labelledby="library-all-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Library hub</p><h2 id="library-all-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">Your library now</h2></div>
          {libraryMetaLoading ? <span className="text-xs text-text-secondary">Refreshing account items…</span> : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAccessCard label="Liked Music" count={likedMusic.length} detail="Saved songs & releases" symbol="♥" onClick={() => changeSection("liked")} />
          <QuickAccessCard label="Playlists" count={playlists.length} detail="Your listening sessions" symbol="▶" onClick={() => changeSection("playlists")} />
          <QuickAccessCard label="Downloads" count={downloads.length} detail={signedIn ? "Purchased files ready" : "Sign in for purchases"} symbol="↓" onClick={() => changeSection("downloads")} />
          <QuickAccessCard label="Recently Played" count={history.length} detail="Continue listening" symbol="◷" onClick={() => changeSection("recent")} />
        </div>

        {history.length ? <LibraryShelf title="Continue listening" actionLabel="See recent" onAction={() => changeSection("recent")} items={history.slice(0, 4)} /> : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[.02] p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Playlists</p><h3 className="mt-1 text-xl font-semibold">Your mixes, closer</h3></div><button type="button" onClick={() => changeSection("playlists")} className="text-sm font-semibold text-brand">See all →</button></div>
            {signedIn && playlists.length ? <div className="mt-4 space-y-2">{playlists.slice(0, 3).map(playlist => <Link key={playlist.id} href={`/playlist/${playlist.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 p-3 transition hover:border-brand/35"><span className="min-w-0"><span className="block truncate font-medium">{playlist.title}</span><span className="text-xs text-text-secondary">{playlist.trackCount || 0} track{playlist.trackCount === 1 ? "" : "s"}</span></span><span className="text-brand">→</span></Link>)}</div> : <button type="button" onClick={() => changeSection("playlists")} className="mt-4 w-full rounded-2xl border border-dashed border-white/15 p-4 text-left text-sm text-text-secondary">{signedIn ? "Create your first playlist without leaving Library." : "Sign in to create playlists that follow you across devices."}</button>}
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[.02] p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Recently liked</p><h3 className="mt-1 text-xl font-semibold">Keep the best within reach</h3></div><button type="button" onClick={() => changeSection("liked")} className="text-sm font-semibold text-brand">See all →</button></div>
            {likedMusic.length ? <div className="mt-4 space-y-2">{likedMusic.slice(0, 3).map(item => <Link key={item.id} href={item.href} className="block rounded-2xl border border-white/10 p-3 transition hover:border-brand/35"><span className="block truncate font-medium">{item.title}</span><span className="block truncate text-xs text-text-secondary">{item.subtitle}</span></Link>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-text-secondary">Like music while you explore and it will appear here.</p>}
          </div>
        </div>
      </section> : null}

      {active !== "all" ? <section className="mt-6 rounded-[1.65rem] border border-white/10 bg-white/[.02] p-5 sm:p-6" aria-labelledby="library-section-title">
        {active === "playlists" ? <WebPlaylists embedded /> : <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{active.startsWith("saved") || active.startsWith("licensed") ? "Creator library" : "Your library"}</p>
              <h2 id="library-section-title" className="mt-2 text-2xl font-semibold sm:text-3xl">{activeMeta.label}</h2>
              <p className="mt-2 text-sm text-text-secondary">{activeMeta.copy}</p>
            </div>
            <button type="button" onClick={() => changeSection("all")} className="rounded-full border border-white/15 px-4 py-2 text-xs text-text-secondary hover:border-brand/40 hover:text-brand">Back to hub</button>
          </div>

          {active === "downloads" ? <DownloadsPanel signedIn={signedIn} loading={libraryMetaLoading} error={downloadsError} downloads={downloads} /> : null}

          {active === "licensed-beats" && webOnly ? <div className="space-y-3">
            {ownedError ? <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{ownedError}</p> : null}
            {ownedLoading ? <p className="text-sm text-text-secondary">Loading licences…</p> : null}
            {ownedBeats.map(beat => <div key={`${beat.orderReference}-${beat.beatId}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-brand">Licensed beat</p>
                <h3 className="truncate font-medium">{beat.title}</h3>
                <p className="truncate text-sm text-text-secondary">{beat.producerName} · {beat.licenceCode.replaceAll("_", " ")}</p>
                {beat.licenceSummary ? <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{beat.licenceSummary}</p> : null}
              </div>
              <button type="button" onClick={() => void writeToBeat(beat)} disabled={openingBeat === beat.beatId} className="min-h-11 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{beat.workspaceId ? "Open Lyrics Pad" : openingBeat === beat.beatId ? "Opening…" : "Write lyrics"}</button>
            </div>)}
          </div> : null}

          {!["downloads", "licensed-beats"].includes(active) ? renderItems(activeItems, active === "liked" ? "liked" : active === "following" ? "following" : active === "recent" ? "recent" : "saved-beats") : null}

          {!["downloads", "licensed-beats"].includes(active) && activeItems.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-9 text-center"><h3 className="text-lg">Nothing here yet</h3><p className="mt-2 text-sm text-text-secondary">{activeMeta.copy}</p><Link href={active === "saved-beats" ? "/catalogue?type=beat#beatstore" : discoverHref} className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">{active === "saved-beats" ? "Find beats" : "Discover BVS"}</Link></div> : null}
          {active === "licensed-beats" && webOnly && !ownedLoading && !ownedError && ownedBeats.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-9 text-center"><h3 className="text-lg">No licensed beats yet</h3><p className="mt-2 text-sm text-text-secondary">When you purchase a BVS beat licence, it will appear here with your writing workspace.</p><Link href="/catalogue?type=beat#beatstore" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Explore BeatStore</Link></div> : null}
        </>}
      </section> : null}
    </div>
  );
}

function QuickAccessCard({ label, count, detail, symbol, onClick }: { label: string; count: number; detail: string; symbol: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group min-h-32 rounded-3xl border border-white/10 bg-white/[.025] p-4 text-left transition hover:border-brand/40 hover:bg-brand/[.04] sm:p-5">
    <div className="flex items-start justify-between gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand/25 bg-brand/10 text-lg text-brand">{symbol}</span><span className="text-2xl font-semibold text-brand">{count}</span></div>
    <p className="mt-4 font-semibold group-hover:text-brand">{label}</p>
    <p className="mt-1 text-xs text-text-secondary">{detail}</p>
  </button>;
}

function LibraryShelf({ title, actionLabel, onAction, items }: { title: string; actionLabel: string; onAction: () => void; items: DiscoveryItem[] }) {
  return <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.02] p-5">
    <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{title}</h3><button type="button" onClick={onAction} className="text-sm font-semibold text-brand">{actionLabel} →</button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map(item => <Link key={item.id} href={item.href} className="min-w-0 rounded-2xl border border-white/10 p-3 transition hover:border-brand/35"><p className="truncate font-medium">{item.title}</p><p className="mt-1 truncate text-xs text-text-secondary">{item.subtitle}</p></Link>)}</div>
  </section>;
}

function DownloadsPanel({ signedIn, loading, error, downloads }: { signedIn: boolean; loading: boolean; error: string; downloads: LibraryDownload[] }) {
  if (!signedIn) return <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center"><h3 className="text-lg font-semibold">Sign in for your downloads</h3><p className="mt-2 text-sm text-text-secondary">Purchased files are tied to your BVS account so they stay available across devices.</p><Link href="/auth/login?next=%2Flibrary%3Fsection%3Ddownloads" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Sign in</Link></div>;
  if (loading) return <p className="text-sm text-text-secondary">Loading downloads…</p>;
  if (error) return <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</p>;
  if (!downloads.length) return <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center"><h3 className="text-lg font-semibold">No downloadable purchases yet</h3><p className="mt-2 text-sm text-text-secondary">When a paid BVS music product has a staged file, it will appear here automatically.</p><Link href="/catalogue" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Browse music</Link></div>;
  return <div className="space-y-3">{downloads.map(download => <div key={`${download.reference}-${download.itemId}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-black/10 p-4"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-brand">Ready to download</p><h3 className="truncate font-medium">{download.title}</h3><p className="mt-1 text-xs text-text-secondary">Purchased {new Date(download.createdAt).toLocaleDateString()}</p></div><div className="flex flex-wrap gap-2"><Link href={download.orderHref} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-xs text-text-secondary hover:border-brand/35 hover:text-brand">Order details</Link><a href={download.href} className="inline-flex min-h-10 items-center rounded-full bg-brand px-4 text-xs font-semibold text-black">Download ↓</a></div></div>)}</div>;
}
