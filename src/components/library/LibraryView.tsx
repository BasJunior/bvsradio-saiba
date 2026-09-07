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

type ActiveSection = "liked" | "playlists" | "following" | "recent" | "saved-beats" | "licensed-beats";
type OwnedBeat = {
  beatId: string;
  orderReference: string;
  title: string;
  producerName: string;
  licenceCode: string;
  licenceSummary: string;
  workspaceId?: string | null;
};

const personalSections: Array<{ id: ActiveSection; label: string; copy: string }> = [
  { id: "liked", label: "Liked Music", copy: "Songs and releases you want to hear again." },
  { id: "playlists", label: "Playlists", copy: "Listening sessions you build from BVS music." },
  { id: "following", label: "Following", copy: "Artists and producers you want to keep close." },
  { id: "recent", label: "Recently Played", copy: "Pick up where you left off." },
];

const creatorSections: Array<{ id: ActiveSection; label: string; copy: string }> = [
  { id: "saved-beats", label: "Saved Beats", copy: "Beat ideas you may want to write to or licence." },
  { id: "licensed-beats", label: "Licensed Beats", copy: "Beat licences you have purchased through BVS." },
];

function initialSection(): ActiveSection {
  if (typeof window === "undefined") return "liked";
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("section") || window.location.hash.replace(/^#/, "");
  const allowed: ActiveSection[] = ["liked", "playlists", "following", "recent", "saved-beats", "licensed-beats"];
  return allowed.includes(requested as ActiveSection) ? requested as ActiveSection : "liked";
}

function rawTrackId(item: DiscoveryItem) {
  return item.kind === "track" ? item.id.replace(/^track-/, "") : "";
}

export default function LibraryView() {
  const [active, setActive] = useState<ActiveSection>("liked");
  const [favourites, setFavourites] = useState<DiscoveryItem[]>([]);
  const [following, setFollowing] = useState<DiscoveryItem[]>([]);
  const [history, setHistory] = useState<DiscoveryItem[]>([]);
  const [ownedBeats, setOwnedBeats] = useState<OwnedBeat[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [ownedError, setOwnedError] = useState("");
  const [openingBeat, setOpeningBeat] = useState("");
  const { state, signedIn, syncNow } = useLibrarySync();
  const { surface } = useAppSurface();
  const discoverHref = surface ? appExplore(surface) : "/search";
  const webOnly = !surface;
  const visiblePersonalSections = useMemo(() => webOnly ? personalSections : personalSections.filter(section => section.id !== "playlists"), [webOnly]);

  useEffect(() => { setActive(initialSection()); }, []);
  useEffect(() => {
    if (!webOnly && (active === "playlists" || active === "saved-beats" || active === "licensed-beats")) setActive("liked");
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

  const activeMeta = [...personalSections, ...creatorSections].find(section => section.id === active) || personalSections[0];
  const activeItems = active === "liked" ? likedMusic : active === "following" ? following : active === "recent" ? history : active === "saved-beats" ? savedBeats : [];

  return (
    <div className="mx-auto min-h-[60vh] max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-brand">Your BVS</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Library</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">The music you keep, the people you follow, the playlists you build and the creator ideas you may come back to.</p>
        </div>
        <Link href={discoverHref} className="rounded-full border border-brand/30 px-4 py-2.5 text-sm font-semibold text-brand">Explore BVS →</Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <span>
          {!signedIn
            ? "Saved on this device. Sign in to sync across devices."
            : state === "synced"
              ? "Synced to your BVS account."
              : state === "syncing"
                ? "Syncing your library…"
                : "Saved locally; account sync needs attention."}
        </span>
        {signedIn && state === "error" ? <button type="button" onClick={syncNow} className="text-brand hover:underline">Try again</button> : null}
        {!signedIn ? <Link href="/auth/login?next=%2Flibrary" className="text-brand hover:underline">Sign in</Link> : null}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[15rem_1fr] lg:items-start">
        <aside className="rounded-[1.45rem] border border-white/10 bg-white/[.02] p-3 lg:sticky lg:top-24">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">Your music</p>
          <div className="space-y-1">
            {visiblePersonalSections.map(section => <button key={section.id} type="button" onClick={() => changeSection(section.id)} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${active === section.id ? "bg-brand text-black" : "text-text-secondary hover:bg-white/5 hover:text-white"}`}><span className="flex items-center justify-between gap-3"><span>{section.label}</span>{section.id === "liked" ? <span className="text-xs opacity-70">{likedMusic.length}</span> : section.id === "following" ? <span className="text-xs opacity-70">{following.length}</span> : section.id === "recent" ? <span className="text-xs opacity-70">{history.length}</span> : null}</span></button>)}
          </div>
          {webOnly ? <>
            <div className="my-3 border-t border-white/10" />
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">Creator library</p>
            <div className="space-y-1">
              {creatorSections.map(section => <button key={section.id} type="button" onClick={() => changeSection(section.id)} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${active === section.id ? "bg-brand text-black" : "text-text-secondary hover:bg-white/5 hover:text-white"}`}><span className="flex items-center justify-between gap-3"><span>{section.label}</span>{section.id === "saved-beats" ? <span className="text-xs opacity-70">{savedBeats.length}</span> : null}</span></button>)}
            </div>
          </> : null}
        </aside>

        <section className="min-w-0 rounded-[1.65rem] border border-white/10 bg-white/[.02] p-5 sm:p-6" aria-labelledby="library-section-title">
          {active === "playlists" && webOnly ? <WebPlaylists embedded /> : <>
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{active.startsWith("saved") || active.startsWith("licensed") ? "Creator library" : "Your library"}</p>
              <h2 id="library-section-title" className="mt-2 text-2xl font-semibold sm:text-3xl">{activeMeta.label}</h2>
              <p className="mt-2 text-sm text-text-secondary">{activeMeta.copy}</p>
            </div>

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
            </div> : renderItems(activeItems, active === "liked" ? "liked" : active === "following" ? "following" : active === "recent" ? "recent" : "saved-beats")}

            {active !== "licensed-beats" && activeItems.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-9 text-center"><h3 className="text-lg">Nothing here yet</h3><p className="mt-2 text-sm text-text-secondary">{activeMeta.copy}</p><Link href={active === "saved-beats" ? "/catalogue?type=beat#beatstore" : discoverHref} className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">{active === "saved-beats" ? "Find beats" : "Discover BVS"}</Link></div> : null}
            {active === "licensed-beats" && webOnly && !ownedLoading && !ownedError && ownedBeats.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-9 text-center"><h3 className="text-lg">No licensed beats yet</h3><p className="mt-2 text-sm text-text-secondary">When you purchase a BVS beat licence, it will appear here with your writing workspace.</p><Link href="/catalogue?type=beat#beatstore" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Explore BeatStore</Link></div> : null}
          </>}
        </section>
      </div>
    </div>
  );
}
