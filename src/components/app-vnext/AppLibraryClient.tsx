"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { appDestination, type AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppOfflineDownloads from "@/components/app-vnext/AppOfflineDownloads";
import AppPlaylists, { type AppPlaylist } from "@/components/app-vnext/AppPlaylists";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { useStationPlayer } from "@/components/StationPlayer";
import { listOffline } from "@/lib/app-offline-native";
import { readLibrary } from "@/lib/library";
import type { DiscoveryItem } from "@/lib/discovery";

type ActiveSection = "all" | "liked" | "playlists" | "downloads" | "following" | "recent";

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
  if (item.href?.startsWith(`/app/${surface}`)) return item.href;
  return `/app/${surface}/explore?q=${encodeURIComponent(item.title)}`;
}

export default function AppLibraryClient({ surface }: { surface: AppSurface }) {
  const [active, setActive] = useState<ActiveSection>("all");
  const [liked, setLiked] = useState<DiscoveryItem[]>([]);
  const [following, setFollowing] = useState<DiscoveryItem[]>([]);
  const [recent, setRecent] = useState<DiscoveryItem[]>([]);
  const [playlists, setPlaylists] = useState<AppPlaylist[]>([]);
  const [downloadCount, setDownloadCount] = useState(0);
  const [libraryMetaLoading, setLibraryMetaLoading] = useState(false);
  const { signedIn, token } = useAppSession();
  const player = useStationPlayer();

  const syncLocalLibrary = useCallback(() => {
    setLiked(readLibrary("favourites").filter((item) => item.kind !== "beat"));
    setFollowing(readLibrary("follows"));
    setRecent(readLibrary("history"));
  }, []);

  useEffect(() => {
    syncLocalLibrary();
    window.addEventListener("bvs:library-change", syncLocalLibrary);
    window.addEventListener("storage", syncLocalLibrary);
    return () => {
      window.removeEventListener("bvs:library-change", syncLocalLibrary);
      window.removeEventListener("storage", syncLocalLibrary);
    };
  }, [syncLocalLibrary]);

  const loadMeta = useCallback(async () => {
    setLibraryMetaLoading(true);
    try {
      const offline = await listOffline().catch(() => []);
      setDownloadCount(offline.length);

      if (!signedIn || !token) {
        setPlaylists([]);
        return;
      }

      const response = await fetch("/api/app/playlists", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok) return;
      const payload = (await response.json().catch(() => ({}))) as { playlists?: AppPlaylist[] };
      setPlaylists(Array.isArray(payload.playlists) ? payload.playlists : []);
    } finally {
      setLibraryMetaLoading(false);
    }
  }, [signedIn, token]);

  useEffect(() => {
    void loadMeta();
    const refresh = () => void loadMeta();
    window.addEventListener("bvs:playlists-change", refresh);
    window.addEventListener("bvs:offline-change", refresh);
    window.addEventListener("bvs:app-resume", refresh);
    return () => {
      window.removeEventListener("bvs:playlists-change", refresh);
      window.removeEventListener("bvs:offline-change", refresh);
      window.removeEventListener("bvs:app-resume", refresh);
    };
  }, [loadMeta]);

  const clearedById = useMemo(
    () => new Map(player.tracks.filter((track) => track.id).map((track) => [track.id as string, track])),
    [player.tracks],
  );

  const playableLiked = useMemo(
    () => liked
      .map((item) => item.kind === "track" ? clearedById.get(item.id) : undefined)
      .filter((track): track is NonNullable<typeof track> => Boolean(track)),
    [clearedById, liked],
  );

  const playableRecent = useMemo(
    () => recent
      .map((item) => item.kind === "track" ? clearedById.get(item.id) : undefined)
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
    const track = item.kind === "track" ? clearedById.get(item.id) : undefined;
    if (!track) return;
    player.playNow(track, { from, related: related.filter((candidate) => candidate.id !== track.id) });
    player.setQueueOpen(false);
    player.openNowPlaying();
  };

  const countFor = (section: ActiveSection) => {
    if (section === "liked") return liked.length;
    if (section === "playlists") return playlists.length;
    if (section === "downloads") return downloadCount;
    if (section === "following") return following.length;
    if (section === "recent") return recent.length;
    return undefined;
  };

  const renderRows = (items: DiscoveryItem[], from: string, related: typeof playableLiked) => {
    if (!items.length) return null;
    return (
      <div className="space-y-2">
        {items.map((item) => {
          const canPlay = item.kind === "track" && clearedById.has(item.id);
          return (
            <article key={`${from}-${item.id}`} className="group flex min-w-0 items-center gap-3 rounded-[1.3rem] border border-white/[.07] bg-white/[.02] p-3 transition hover:border-white/15 hover:bg-white/[.035]">
              <button
                type="button"
                disabled={!canPlay}
                onClick={() => playItem(item, from, related)}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[.95rem] border border-white/[.05] bg-white/[.03] disabled:cursor-default"
                aria-label={canPlay ? `Play ${item.title}` : undefined}
              >
                {item.image ? <Image src={item.image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-brand">BVS</span>}
                {canPlay ? <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">▶</span> : null}
              </button>
              <Link href={nativeHref(surface, item)} className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{item.title}</h3>
                <p className="truncate text-sm text-white/43">{item.subtitle}</p>
              </Link>
              {canPlay ? (
                <button type="button" onClick={() => playItem(item, from, related)} aria-label={`Play ${item.title}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-black">▶</button>
              ) : (
                <Link href={nativeHref(surface, item)} aria-label={`Open ${item.title}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[.08] text-white/55">→</Link>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  const recentLiked = liked.slice(0, 4);
  const recentHistory = recent.slice(0, 6);
  const recentPlaylists = playlists.slice(0, 4);
  const continueItem = recent[0];
  const continuePlayable = Boolean(continueItem?.kind === "track" && continueItem?.id && clearedById.has(continueItem.id));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p data-library-accent="library" className="bvs-library-accent-label text-[10px] font-semibold uppercase tracking-[.22em]">Your BVS</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-6xl">Library</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">Your music, playlists, downloads and creators — ready to play, not buried in menus.</p>
        </div>
        <Link href={`/app/${surface}/explore`} data-library-accent="discover" className="bvs-library-accent-button min-h-11 rounded-full border px-5 py-3 text-sm font-semibold">Discover music →</Link>
      </div>

      {!signedIn ? (
        <Link href={`/app/${surface}/join`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Sync your Library</Link>
      ) : null}

      <div className="sticky top-16 z-30 -mx-4 mt-6 border-y border-white/[.07] bg-[#09090b]/92 px-4 py-3 backdrop-blur-2xl sm:-mx-6 sm:px-6">
        <nav className="flex gap-2 overflow-x-auto" aria-label="Library sections">
          {primarySections.map((section) => {
            const count = countFor(section.id);
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                aria-pressed={active === section.id}
                className="bvs-library-accent-button min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold" data-library-accent={appLibraryAccent(section.id)}
              >
                {section.label}{typeof count === "number" ? ` · ${count}` : ""}
              </button>
            );
          })}
        </nav>
      </div>

      {active === "all" ? (
        <>
          <section className="mt-6 overflow-hidden rounded-[1.7rem] border border-white/[.08] bg-white/[.025]" aria-labelledby="continue-listening-heading">
            {continueItem ? (
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 p-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5 sm:p-4">
                <button
                  type="button"
                  disabled={!continuePlayable}
                  onClick={() => continuePlayable && playItem(continueItem, "Recently Played", playableRecent)}
                  className="relative aspect-square overflow-hidden rounded-[1.25rem] border border-white/[.07] bg-white/[.035] disabled:cursor-default"
                  aria-label={continuePlayable ? `Continue ${continueItem.title}` : undefined}
                >
                  {continueItem.image ? <Image src={continueItem.image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-brand">BVS</span>}
                  {continuePlayable ? <span className="absolute inset-0 grid place-items-center bg-black/20 text-2xl text-white">▶</span> : null}
                </button>
                <div className="flex min-w-0 flex-col justify-center py-1">
                  <p data-library-accent="library" className="bvs-library-accent-label text-[10px] font-semibold uppercase tracking-[.2em]">Continue listening</p>
                  <h2 id="continue-listening-heading" className="mt-2 truncate text-2xl font-semibold sm:text-3xl">{continueItem.title}</h2>
                  <p className="mt-1 truncate text-sm text-white/42">{continueItem.subtitle}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {continuePlayable ? (
                      <button type="button" onClick={() => playItem(continueItem, "Recently Played", playableRecent)} className="min-h-10 rounded-full bg-white px-4 text-xs font-semibold text-black">▶ Play</button>
                    ) : (
                      <Link href={nativeHref(surface, continueItem)} className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-xs font-semibold text-black">Open</Link>
                    )}
                    <button type="button" onClick={() => setActive("recent")} className="min-h-10 rounded-full border border-white/[.1] px-4 text-xs font-semibold text-white/68">History</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Continue listening</p>
                <h2 id="continue-listening-heading" className="mt-2 text-2xl font-semibold">Your Library wakes up as you listen.</h2>
                <p className="mt-2 text-sm leading-6 text-white/42">Play something from Discover and BVS will keep your next move here.</p>
                <Link href={`/app/${surface}/explore`} className="mt-4 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-xs font-semibold text-black">Start listening</Link>
              </div>
            )}
          </section>

          <section className="mt-7" aria-labelledby="quick-access-heading">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p data-library-accent="library" className="bvs-library-accent-label text-[10px] font-semibold uppercase tracking-[.2em]">Your collection</p>
                <h2 id="quick-access-heading" className="mt-1 text-2xl font-semibold">Go straight to what you saved.</h2>
              </div>
              {libraryMetaLoading ? <span className="text-xs text-white/30">Updating…</span> : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <QuickCard accent="library" icon="♡" label="Liked Music" value={`${liked.length} saved`} onClick={() => setActive("liked")} />
              <QuickCard accent="library" icon="▶" label="Playlists" value={signedIn ? `${playlists.length} playlists` : "Sign in to sync"} onClick={() => setActive("playlists")} />
              <QuickCard accent="downloads" icon="↓" label="Downloads" value={`${downloadCount} offline`} onClick={() => setActive("downloads")} />
              <QuickCard accent="library" icon="◷" label="Recently Played" value={recent.length ? `${recent.length} recent` : "Ready when you listen"} onClick={() => setActive("recent")} />
            </div>
          </section>

          {signedIn ? (
            <section className="mt-8" aria-labelledby="playlists-heading">
              <ShelfHeading eyebrow="Your playlists" title="Made for the way you listen." action="See all" onAction={() => setActive("playlists")} />
              {recentPlaylists.length ? (
                <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                  {recentPlaylists.map((playlist) => (
                    <Link key={playlist.id} href={`/app/${surface}/playlist/${playlist.id}`} className="min-w-[12rem] max-w-[14rem] flex-1 rounded-[1.3rem] border border-white/[.07] bg-white/[.022] p-4 transition hover:border-brand/25">
                      <p className="truncate font-semibold">{playlist.title}</p>
                      <p className="mt-2 text-sm text-white/38">{playlist.trackCount || 0} track{playlist.trackCount === 1 ? "" : "s"}</p>
                      <p className="mt-4 text-xs font-semibold text-brand">Open playlist →</p>
                    </Link>
                  ))}
                  <button type="button" onClick={() => setActive("playlists")} className="min-w-[10rem] rounded-[1.3rem] border border-dashed border-brand/25 p-4 text-left text-sm font-semibold text-brand">＋ New playlist</button>
                </div>
              ) : (
                <button type="button" onClick={() => setActive("playlists")} className="mt-4 w-full rounded-[1.3rem] border border-dashed border-white/12 p-5 text-left">
                  <span className="font-semibold">Create your first playlist</span>
                  <span className="mt-1 block text-sm text-white/38">Start here, then add music from Discover.</span>
                </button>
              )}
            </section>
          ) : null}

          <section className="mt-8" aria-labelledby="recent-liked-heading">
            <ShelfHeading eyebrow="Recently liked" title="The music you chose to keep." action="See all" onAction={() => setActive("liked")} />
            <div className="mt-4">
              {recentLiked.length ? renderRows(recentLiked, "Liked Music", playableLiked) : <EmptyState title="Nothing liked yet." copy="Like music in Discover and it will show up here." href={`/app/${surface}/explore`} />}
            </div>
          </section>

          {recentHistory.length ? (
            <section className="mt-8" aria-labelledby="recent-shelf-heading">
              <ShelfHeading eyebrow="Recently played" title="Your last listens, visually." action="See all" onAction={() => setActive("recent")} />
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {recentHistory.map((item) => {
                  const canPlay = item.kind === "track" && clearedById.has(item.id);
                  return (
                    <article key={`recent-shelf-${item.id}`} className="w-[9.5rem] shrink-0">
                      <button
                        type="button"
                        disabled={!canPlay}
                        onClick={() => canPlay ? playItem(item, "Recently Played", playableRecent) : undefined}
                        className="relative aspect-square w-full overflow-hidden rounded-[1.2rem] border border-white/[.07] bg-white/[.03] disabled:cursor-default"
                        aria-label={canPlay ? `Play ${item.title}` : undefined}
                      >
                        {item.image ? <Image src={item.image} alt="" fill unoptimized className="object-cover" /> : <span className="grid h-full w-full place-items-center text-brand">BVS</span>}
                        {canPlay ? <span className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-xs text-white backdrop-blur">▶</span> : null}
                      </button>
                      <Link href={nativeHref(surface, item)} className="mt-2 block min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-white/36">{item.subtitle}</p>
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <button type="button" onClick={() => setActive("following")} className="flex w-full items-center justify-between gap-4 rounded-[1.35rem] border border-white/[.07] bg-white/[.02] p-4 text-left transition hover:border-white/15">
              <span className="min-w-0">
                <span data-library-accent="discover" className="bvs-library-accent-label block text-[10px] font-semibold uppercase tracking-[.16em]">Following</span>
                <span className="mt-1 block truncate text-lg font-semibold">{following.length} creator{following.length === 1 ? "" : "s"} kept close</span>
              </span>
              <span className="shrink-0 text-brand">→</span>
            </button>
          </section>
        </>
      ) : null}

      {active === "liked" ? (
        <section className="mt-7" aria-labelledby="liked-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Liked Music</p><h2 id="liked-heading" className="mt-1 text-3xl font-semibold">Music you want back.</h2></div>
            {playableLiked.length ? <button type="button" onClick={() => playCollection(playableLiked, "Liked Music")} className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black">▶ Play all</button> : null}
          </div>
          <div className="mt-5">{liked.length ? renderRows(liked, "Liked Music", playableLiked) : <EmptyState title="Nothing liked yet." copy="Like music in Discover and it will stay here." href={`/app/${surface}/explore`} />}</div>
        </section>
      ) : null}

      {active === "playlists" ? (
        <section className="mt-2">
          {signedIn ? <AppPlaylists surface={surface} /> : <EmptyState title="Sign in for playlists." copy="Your playlists sync with your BVS identity across devices." href={`/app/${surface}/join`} action="Sign in or join" />}
        </section>
      ) : null}

      {active === "downloads" ? (
        <section className="mt-2">
          {signedIn ? <AppOfflineDownloads surface={surface} /> : <EmptyState title="Sign in for Downloads." copy="Offline music is tied to your BVS identity and rights availability." href={`/app/${surface}/join`} action="Sign in or join" />}
        </section>
      ) : null}

      {active === "following" ? (
        <section className="mt-7" aria-labelledby="following-heading">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Following</p><h2 id="following-heading" className="mt-1 text-3xl font-semibold">Creators you keep close.</h2></div>
          <div className="mt-5">{following.length ? renderRows(following, "Following", []) : <EmptyState title="You are not following anyone yet." copy="Follow artists and producers from Discover." href={`/app/${surface}/explore`} />}</div>
        </section>
      ) : null}

      {active === "recent" ? (
        <section className="mt-7" aria-labelledby="recent-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Recently Played</p><h2 id="recent-heading" className="mt-1 text-3xl font-semibold">Pick up where you left off.</h2></div>
            {playableRecent.length ? <button type="button" onClick={() => playCollection(playableRecent, "Recently Played")} className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black">▶ Play all</button> : null}
          </div>
          <div className="mt-5">{recent.length ? renderRows(recent, "Recently Played", playableRecent) : <EmptyState title="No listening history yet." copy="Your recent music will appear here as you listen." href={`/app/${surface}/explore`} />}</div>
        </section>
      ) : null}
    </div>
  );
}

function QuickCard({ accent, icon, label, value, onClick }: { accent: "library" | "downloads"; icon: string; label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" data-library-accent={accent} onClick={onClick} className="bvs-library-accent-card min-h-[7.2rem] rounded-[1.35rem] border border-white/[.07] bg-white/[.022] p-4 text-left transition hover:-translate-y-0.5">
      <span className="bvs-library-accent-label text-xl" aria-hidden="true">{icon}</span>
      <span className="mt-3 block font-semibold">{label}</span>
      <span className="mt-1 block text-sm text-white/38">{value}</span>
    </button>
  );
}

function ShelfHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2></div>
      <button type="button" onClick={onAction} className="shrink-0 text-sm font-semibold text-brand">{action} →</button>
    </div>
  );
}

function EmptyState({ title, copy, href, action = "Open Discover" }: { title: string; copy: string; href: string; action?: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-white/12 p-7 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/38">{copy}</p>
      <Link href={href} className="mt-4 inline-flex min-h-10 items-center rounded-full border border-brand/28 px-4 text-sm font-semibold text-brand">{action}</Link>
    </div>
  );
}
