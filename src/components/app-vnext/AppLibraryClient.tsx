"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { appDestination, type AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppOfflineDownloads from "@/components/app-vnext/AppOfflineDownloads";
import AppPlaylists, { type AppPlaylist } from "@/components/app-vnext/AppPlaylists";
import { CoverMosaic, LibIcon, LikedCover, type LibIconName } from "@/components/app-vnext/LibraryVisuals";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { useStationPlayer } from "@/components/StationPlayer";
import { listOffline } from "@/lib/app-offline-native";
import { useLocalLibrary } from "@/lib/use-local-library";
import { useAccountJson } from "@/lib/use-account-json";
import { withAuthTimeout, safeAuthDestination } from "@/lib/auth-client-flow";
import type { DiscoveryItem } from "@/lib/discovery";
import { libraryPlaybackId, useLibraryPlayback } from "@/lib/use-library-playback";
import { appLibrarySectionPath, readAppLibrarySection, type AppLibrarySection as ActiveSection } from "@/lib/discovery-continuity";

const primarySections: Array<{ id: ActiveSection; label: string }> = [
  { id: "all", label: "All" },
  { id: "liked", label: "Liked" },
  { id: "playlists", label: "Playlists" },
  { id: "downloads", label: "Downloads" },
];

function appLibraryAccent(section: ActiveSection) {
  if (section === "downloads") return "downloads";
  if (section === "following") return "discover";
  return "library";
}

function nativeHref(surface: AppSurface, item: DiscoveryItem) {
  try {
    const translated = appDestination(surface, new URL(item.href || "/", "https://bvs.local"));
    if (translated) return translated;
  } catch {
    // Fall through to Discover when a saved href is malformed.
  }
  if (item.href?.startsWith(`/app/${surface}/`)) return safeAuthDestination(item.href, `/app/${surface}/explore`, `/app/${surface}`);
  return `/app/${surface}/explore?q=${encodeURIComponent(item.title)}`;
}

export default function AppLibraryClient({ surface, initialSection = "all" }: { surface: AppSurface; initialSection?: ActiveSection }) {
  const [active, setActive] = useState<ActiveSection>(initialSection);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [downloadCountError, setDownloadCountError] = useState("");
  const [downloadCountLoading, setDownloadCountLoading] = useState(true);
  const [offlineRefresh, setOfflineRefresh] = useState(0);
  const { signedIn, token, user } = useAppSession();
  const owner = user?.id || "";
  const likedCache = useLocalLibrary("favourites", owner);
  const liked = useMemo(() => likedCache.filter(item => item.kind !== "beat"), [likedCache]);
  const following = useLocalLibrary("follows", owner);
  const recent = useLocalLibrary("history", owner);
  const playlistRequest = useAccountJson<{ playlists?: AppPlaylist[] }>({ owner, token, url: "/api/app/playlists", enabled: signedIn });
  const reloadPlaylists = playlistRequest.reload;
  const playlists = playlistRequest.data?.playlists || [];
  const libraryMetaLoading = playlistRequest.loading;
  const player = useStationPlayer();

  useEffect(() => {
    const sync = () => setActive(readAppLibrarySection(new URLSearchParams(window.location.search)));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const changeSection = (section: ActiveSection) => {
    setActive(section);
    const path = appLibrarySectionPath(surface, section, new URLSearchParams(window.location.search));
    window.history.replaceState(window.history.state, "", path);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  useEffect(() => {
    let alive = true;
    let version = 0;
    const refreshOffline = async () => {
      const request = ++version;
      setDownloadCountLoading(true);
      setDownloadCountError("");
      try {
        const offline = await withAuthTimeout(listOffline(), 12000, "Offline library timed out.");
        if (alive && request === version) setDownloadCount(offline.length);
      } catch (caught) {
        if (alive && request === version) {
          setDownloadCount(null);
          setDownloadCountError(caught instanceof Error ? caught.message : "Download count is unavailable.");
        }
      } finally {
        if (alive && request === version) setDownloadCountLoading(false);
      }
    };
    const refresh = () => { reloadPlaylists(); void refreshOffline(); };
    void refreshOffline();
    window.addEventListener("bvs:playlists-change", reloadPlaylists);
    window.addEventListener("bvs:offline-change", refresh);
    window.addEventListener("bvs:app-resume", refresh);
    return () => {
      alive = false;
      window.removeEventListener("bvs:playlists-change", reloadPlaylists);
      window.removeEventListener("bvs:offline-change", refresh);
      window.removeEventListener("bvs:app-resume", refresh);
    };
  }, [offlineRefresh, reloadPlaylists]);

  const playback = useLibraryPlayback([...liked, ...recent], player.tracks);
  const clearedById = playback.byId;

  const playableLiked = useMemo(
    () => liked
      .map((item) => clearedById.get(item.id) || clearedById.get(libraryPlaybackId(item)))
      .filter((track): track is NonNullable<typeof track> => Boolean(track)),
    [clearedById, liked],
  );

  const playableRecent = useMemo(
    () => recent
      .map((item) => clearedById.get(item.id) || clearedById.get(libraryPlaybackId(item)))
      .filter((track): track is NonNullable<typeof track> => Boolean(track)),
    [clearedById, recent],
  );

  const playCollection = (tracks: typeof playableLiked, from: string) => {
    if (!tracks.length) return;
    player.playAll(tracks, { from });
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  const playItem = (item: DiscoveryItem, from: string, related: typeof playableLiked) => {
    const track = clearedById.get(item.id) || clearedById.get(libraryPlaybackId(item));
    if (!track) return;
    player.playNow(track, { from, related: related.filter((candidate) => candidate.id !== track.id) });
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  const shuffled = (tracks: typeof playableLiked) => {
    const copy = [...tracks];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  };

  const countFor = (section: ActiveSection) => {
    if (section === "liked") return liked.length;
    if (section === "playlists") return playlists.length;
    if (section === "downloads") return downloadCount ?? undefined;
    if (section === "following") return following.length;
    if (section === "recent") return recent.length;
    return undefined;
  };

  const renderRows = (items: DiscoveryItem[], from: string, related: typeof playableLiked) => {
    if (!items.length) return null;
    return (
      <div className="divide-y divide-white/[.06] overflow-hidden rounded-2xl border border-white/[.06] bg-white/[.018]">
        {items.map((item) => {
          const canPlay = clearedById.has(item.id) || clearedById.has(libraryPlaybackId(item));
          const nowPlaying = Boolean(player.current?.id && (player.current.id === item.id || player.current.id === libraryPlaybackId(item)));
          return (
            <article key={`${from}-${item.id}`} className="group flex min-w-0 items-center gap-3 px-3 py-2.5 transition hover:bg-white/[.03]">
              <button
                type="button"
                disabled={!canPlay}
                onClick={() => playItem(item, from, related)}
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/[.04] disabled:cursor-default"
                aria-label={canPlay ? `Play ${item.title}` : undefined}
              >
                {item.image ? <Image src={item.image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-[10px] font-bold text-brand">BVS</span>}
                {canPlay ? <span className="absolute inset-0 grid place-items-center bg-black/35 text-white opacity-0 transition group-hover:opacity-100"><LibIcon name="play" size={18} /></span> : null}
              </button>
              {canPlay ? <button type="button" onClick={() => playItem(item, from, related)} aria-label={`Play ${item.title}`} className="min-w-0 flex-1 text-left">
                <h3 className={`truncate text-[15px] font-semibold ${nowPlaying ? "text-brand" : ""}`}>{item.title}</h3>
                <p className="truncate text-[13px] text-white/45">{item.subtitle}</p>
              </button> : <Link href={nativeHref(surface, item)} className="min-w-0 flex-1">
                <h3 className="truncate text-[15px] font-semibold">{item.title}</h3>
                <p className="truncate text-[13px] text-white/45">{item.subtitle}</p>
                <p className="mt-0.5 text-[11px] text-white/35">{playback.loading ? "Loading preview…" : playback.error ? "Preview unavailable" : "Not currently available to play"}</p>
              </Link>}
              <Link href={nativeHref(surface, item)} aria-label={`Open ${item.title}`} className="grid h-11 w-9 shrink-0 place-items-center text-white/35 transition group-hover:text-white/70"><LibIcon name="chevron" size={18} /></Link>
            </article>
          );
        })}
      </div>
    );
  };

  const recentLiked = liked.slice(0, 4);
  const recentHistory = recent.slice(0, 4);
  const recentPlaylists = playlists.slice(0, 8);
  const likedArtwork = liked.map((item) => item.image).filter(Boolean).slice(0, 4);

  const chips: Array<{ id: ActiveSection; label: string }> = [
    ...primarySections,
    { id: "following", label: "Following" },
    { id: "recent", label: "Recent" },
  ];

  return (
    <div className="bvs-square-library mx-auto max-w-5xl px-4 pb-12 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p data-library-accent="library" className="bvs-library-accent-label text-[10px] font-semibold uppercase tracking-[.22em]">Your BVS</p>
          <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">Library</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/app/${surface}/explore`} aria-label="Discover music" data-library-accent="discover" className="bvs-library-accent-button grid h-11 w-11 place-items-center rounded-full border"><LibIcon name="search" /></Link>
          {signedIn ? <button type="button" onClick={() => changeSection("playlists")} aria-label="New playlist" className="grid h-11 w-11 place-items-center rounded-full bg-brand text-black transition active:scale-95"><LibIcon name="plus" /></button> : null}
        </div>
      </header>
      <p className="mt-2 text-sm text-white/45">Your music. Your mixes. Your next listen.</p>

      {playback.error ? <p role="status" className="mt-4 text-sm text-red-200">{playback.error} <button type="button" onClick={playback.retry} className="min-h-11 px-3 underline">Retry previews</button></p> : null}

      {!signedIn ? (
        <Link href={`/app/${surface}/join`} className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-brand/25 bg-brand/[.07] p-4">
          <span><span className="block font-semibold">Sync your Library</span><span className="mt-0.5 block text-sm text-white/50">Keep likes, playlists and downloads on every device.</span></span>
          <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-brand px-4 text-sm font-semibold text-black">Sign in</span>
        </Link>
      ) : null}

      <div className="sticky top-16 z-30 -mx-4 mt-5 bg-[#09090b]/92 px-4 py-2.5 backdrop-blur-2xl sm:-mx-6 sm:px-6">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto" aria-label="Library sections">
          {chips.map((section) => {
            const count = countFor(section.id);
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => changeSection(section.id)}
                aria-pressed={active === section.id}
                className="bvs-library-accent-button min-h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition"
                data-library-accent={appLibraryAccent(section.id)}
              >
                {section.label}{typeof count === "number" && section.id !== "all" ? <span className="opacity-60"> {count}</span> : null}
              </button>
            );
          })}
        </nav>
        {playlistRequest.error ? <p role="alert" className="mt-2 text-sm text-red-300">{playlistRequest.error} <button type="button" onClick={playlistRequest.reload} className="min-h-11 px-3 underline">Try again</button></p> : null}
      </div>

      {active === "all" ? (
        <>
          <section className="mt-5" aria-labelledby="quick-access-heading">
            <h2 id="quick-access-heading" className="sr-only">Quick access</h2>
            <div className="bvs-library-metrics grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <QuickCard accent="library" cover={<LikedCover className="h-12 w-12" rounded="rounded-lg" />} label="Liked Music" value={`${liked.length} saved`} onClick={() => changeSection("liked")} />
              <QuickCard accent="library" cover={<CoverMosaic images={playlists[0]?.coverArtwork || []} seed={playlists[0]?.id || "playlists"} className="h-12 w-12" rounded="rounded-lg" />} label="Playlists" value={signedIn ? `${playlists.length} playlist${playlists.length === 1 ? "" : "s"}` : "Sign in to sync"} onClick={() => changeSection("playlists")} />
              <QuickCard accent="downloads" cover={<IconCover name="download" tone="downloads" />} label="Downloads" value={downloadCountError ? "Unavailable · open details" : downloadCountLoading || downloadCount === null ? "Checking this device…" : `${downloadCount} offline`} onClick={() => changeSection("downloads")} />
              <QuickCard accent="library" cover={<IconCover name="clock" tone="recent" />} label="Recently Played" value={recent.length ? `${recent.length} recent` : "Ready when you listen"} onClick={() => changeSection("recent")} />
            </div>
            {libraryMetaLoading ? <p className="mt-2 text-xs text-white/30">Updating…</p> : null}
            {downloadCountError ? <p role="alert" className="mt-3 text-sm text-amber-200">Downloads could not be checked. <button type="button" onClick={() => setOfflineRefresh((value) => value + 1)} className="min-h-10 px-2 font-semibold text-brand underline">Try again</button><button type="button" onClick={() => changeSection("downloads")} className="min-h-10 px-2 font-semibold text-brand underline">Open Downloads</button></p> : null}
          </section>

          {recentHistory.length ? <section className="bvs-library-shelf mt-8" aria-labelledby="library-now-heading">
            <div className="flex items-center justify-between gap-4">
              <h2 id="library-now-heading" className="text-[1.35rem] font-bold tracking-tight">Continue listening</h2>
              {playableRecent.length ? <button type="button" onClick={() => playCollection(playableRecent, "Recently Played")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/[.08] px-3.5 text-[13px] font-semibold"><LibIcon name="play" size={14} /> Play all</button> : null}
            </div>
            <div className="mt-3">{renderRows(recentHistory, "Recently Played", playableRecent)}</div>
          </section> : null}

          {signedIn ? (
            <section className="mt-8" aria-labelledby="playlists-heading">
              <ShelfHeading id="playlists-heading" title="Your playlists" action="See all" onAction={() => changeSection("playlists")} />
              <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
                <button type="button" onClick={() => changeSection("liked")} className="w-[9.5rem] shrink-0 snap-start text-left">
                  <LikedCover className="w-full" />
                  <span className="mt-2 block truncate text-sm font-semibold">Liked Music</span>
                  <span className="block truncate text-xs text-white/45">{liked.length} song{liked.length === 1 ? "" : "s"}</span>
                </button>
                {recentPlaylists.map((playlist) => {
                  const count = playlist.itemCount ?? playlist.trackCount ?? 0;
                  return (
                    <Link key={playlist.id} href={`/app/${surface}/playlist/${playlist.id}`} className="w-[9.5rem] shrink-0 snap-start">
                      <CoverMosaic images={playlist.coverArtwork || []} seed={playlist.id} className="w-full" />
                      <span className="mt-2 block truncate text-sm font-semibold">{playlist.title}</span>
                      <span className="block truncate text-xs text-white/45">{count} item{count === 1 ? "" : "s"}</span>
                    </Link>
                  );
                })}
                <button type="button" onClick={() => changeSection("playlists")} className="w-[9.5rem] shrink-0 snap-start text-left">
                  <span className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-white/20 text-white/60"><LibIcon name="plus" size={30} /></span>
                  <span className="mt-2 block text-sm font-semibold">New playlist</span>
                  <span className="block text-xs text-white/45">Music and beats</span>
                </button>
              </div>
            </section>
          ) : null}

          <section className="mt-8" aria-labelledby="recent-liked-heading">
            <ShelfHeading id="recent-liked-heading" title="Recently liked" action="See all" onAction={() => changeSection("liked")} />
            <div className="mt-3">
              {recentLiked.length ? renderRows(recentLiked, "Liked Music", playableLiked) : <EmptyState icon="heart" title="Nothing liked yet." copy="Tap the heart on anything you love and it lands here." href={`/app/${surface}/explore`} />}
            </div>
          </section>
        </>
      ) : null}

      {active === "liked" ? (
        <section className="mt-5" aria-labelledby="liked-heading">
          <CollectionHero
            cover={likedArtwork.length >= 2 ? <CoverMosaic images={likedArtwork} seed="liked" className="w-full" /> : <LikedCover className="w-full" />}
            eyebrow="Collection"
            title="Liked Music"
            headingId="liked-heading"
            meta={`${liked.length} song${liked.length === 1 ? "" : "s"}`}
            onPlay={playableLiked.length ? () => playCollection(playableLiked, "Liked Music") : undefined}
            onShuffle={playableLiked.length > 1 ? () => playCollection(shuffled(playableLiked), "Liked Music · Shuffle") : undefined}
          />
          <div className="mt-5">{liked.length ? renderRows(liked, "Liked Music", playableLiked) : <EmptyState icon="heart" title="Nothing liked yet." copy="Tap the heart on anything you love and it stays here." href={`/app/${surface}/explore`} />}</div>
        </section>
      ) : null}

      {active === "playlists" ? (
        <section className="mt-2">
          {signedIn ? <AppPlaylists key={owner} surface={surface} /> : <EmptyState icon="playlist" title="Sign in for playlists." copy="Your playlists sync with your BVS identity across devices." href={`/app/${surface}/join`} action="Sign in or join" />}
        </section>
      ) : null}

      {active === "downloads" ? (
        <section className="mt-2">
          {signedIn ? <AppOfflineDownloads key={owner} surface={surface} /> : <EmptyState icon="download" title="Sign in for Downloads." copy="Offline music is tied to your BVS identity and rights availability." href={`/app/${surface}/join`} action="Sign in or join" />}
        </section>
      ) : null}

      {active === "following" ? (
        <section className="mt-6" aria-labelledby="following-heading">
          <h2 id="following-heading" className="text-[1.6rem] font-bold tracking-tight">Following</h2>
          <p className="mt-1 text-sm text-white/45">Creators you keep close.</p>
          <div className="mt-4">{following.length ? renderRows(following, "Following", []) : <EmptyState icon="people" title="You are not following anyone yet." copy="Follow artists and producers from Discover." href={`/app/${surface}/explore`} />}</div>
        </section>
      ) : null}

      {active === "recent" ? (
        <section className="mt-5" aria-labelledby="recent-heading">
          <CollectionHero
            cover={<IconCover name="clock" tone="recent" large />}
            eyebrow="History"
            title="Recently Played"
            headingId="recent-heading"
            meta={`${recent.length} item${recent.length === 1 ? "" : "s"} · pick up where you left off`}
            onPlay={playableRecent.length ? () => playCollection(playableRecent, "Recently Played") : undefined}
          />
          <div className="mt-5">{recent.length ? renderRows(recent, "Recently Played", playableRecent) : <EmptyState icon="clock" title="No listening history yet." copy="Your recent music will appear here as you listen." href={`/app/${surface}/explore`} />}</div>
        </section>
      ) : null}
    </div>
  );
}

function IconCover({ name, tone, large = false }: { name: LibIconName; tone: "downloads" | "recent"; large?: boolean }) {
  const background = tone === "downloads"
    ? "linear-gradient(140deg, #5ec8ff 0%, #1d5f8a 55%, #0d2233 100%)"
    : "linear-gradient(140deg, #c4f343 0%, #5d7a1c 55%, #1c2410 100%)";
  return (
    <span aria-hidden="true" className={`grid aspect-square place-items-center text-white shadow-[0_14px_34px_-16px_rgba(0,0,0,.9)] ${large ? "w-full rounded-xl" : "h-12 w-12 rounded-lg"}`} style={{ background }}>
      <LibIcon name={name} size={large ? 64 : 22} />
    </span>
  );
}

function QuickCard({ accent, cover, label, value, onClick }: { accent: "library" | "downloads"; cover: ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" data-library-accent={accent} onClick={onClick} className="bvs-library-accent-card flex min-h-[4.5rem] items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.04] p-2.5 pr-3 text-left transition active:scale-[.98] hover:bg-white/[.07]">
      <span className="shrink-0">{cover}</span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">{label}</span>
        <span className="block truncate text-[12px] text-white/45">{value}</span>
      </span>
    </button>
  );
}

function CollectionHero({ cover, eyebrow, title, headingId, meta, onPlay, onShuffle }: { cover: ReactNode; eyebrow: string; title: string; headingId: string; meta: string; onPlay?: () => void; onShuffle?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
      <div className="w-44 shrink-0 sm:w-48">{cover}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">{eyebrow}</p>
        <h2 id={headingId} className="mt-1 text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">{title}</h2>
        <p className="mt-1 text-sm text-white/50">{meta}</p>
        {onPlay || onShuffle ? (
          <div className="mt-4 flex items-center justify-center gap-3 sm:justify-start">
            {onPlay ? <button type="button" onClick={onPlay} aria-label={`Play ${title}`} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-bold text-black transition active:scale-95"><LibIcon name="play" size={18} /> Play</button> : null}
            {onShuffle ? <button type="button" onClick={onShuffle} aria-label={`Shuffle ${title}`} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/[.09] px-5 text-[15px] font-semibold transition active:scale-95"><LibIcon name="shuffle" size={18} /> Shuffle</button> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ShelfHeading({ id, title, action, onAction }: { id: string; title: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className="text-[1.35rem] font-bold tracking-tight">{title}</h2>
      <button type="button" onClick={onAction} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 text-[13px] font-semibold text-white/55 hover:text-white">{action}<LibIcon name="chevron" size={16} /></button>
    </div>
  );
}

function EmptyState({ icon, title, copy, href, action = "Open Discover" }: { icon: LibIconName; title: string; copy: string; href: string; action?: string }) {
  return (
    <div className="rounded-2xl border border-white/[.06] bg-white/[.02] px-6 py-9 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[.06] text-white/60"><LibIcon name={icon} size={26} /></span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-white/45">{copy}</p>
      <Link href={href} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-black">{action}</Link>
    </div>
  );
}
