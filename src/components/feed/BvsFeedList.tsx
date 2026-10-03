"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import LibraryAction from "@/components/LibraryAction";
import FeedComposer from "@/components/feed/FeedComposer";
import FeedParticipation, { type ParticipationSummary } from "@/components/feed/FeedParticipation";
import ParticipationPostCard from "@/components/feed/ParticipationPostCard";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { BvsFeedCategory, BvsFeedFilter, BvsFeedItem } from "@/lib/bvs-feed";
import type { AppSurface } from "@/lib/app-surface";
import type { ParticipationPost } from "@/lib/participation-server";
import { readLibrary } from "@/lib/library";

const filters: Array<{ id: BvsFeedFilter; label: string }> = [
  { id: "all", label: "All updates" },
  { id: "music", label: "Music" },
  { id: "creator", label: "Creators" },
  { id: "beat", label: "Beats" },
  { id: "live", label: "Live" },
  { id: "marketplace", label: "Marketplace" },
];

type FeedLane = "focus" | "following" | "activity";
const lanes: Array<{ id: FeedLane; label: string; accent: string }> = [
  { id: "focus", label: "Latest", accent: "#e3bd58" },
  { id: "following", label: "Following", accent: "#7db6ff" },
  { id: "activity", label: "My Activity", accent: "#a88cff" },
];

const categoryLabel: Record<BvsFeedCategory, string> = {
  music: "Music",
  creator: "Creator",
  beat: "BeatStore",
  live: "Live",
  marketplace: "Marketplace",
};

const PULL_REFRESH_TRIGGER = 54;

function relativeTime(iso: string) {
  const age = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

function exactFeedRoute(item: BvsFeedItem) {
  if (item.object.kind !== "beat") return item.object.route;
  if (/^\/app\/(ios|android)\/beat\//.test(item.object.route)) return item.object.route;
  return `/beat/${encodeURIComponent(item.object.id)}`;
}

function targetKey(item: BvsFeedItem) {
  return `${item.object.kind}:${item.object.id}`;
}

function normalized(value?: string | null) {
  return String(value || "").trim().toLocaleLowerCase();
}

type TimelineEntry =
  | { type: "system"; at: string; id: string; item: BvsFeedItem }
  | { type: "post"; at: string; id: string; post: ParticipationPost };

export default function BvsFeedList({
  items,
  surface,
  participationEnabled = false,
}: {
  items: BvsFeedItem[];
  surface: AppSurface | null;
  participationEnabled?: boolean;
}) {
  const router = useRouter();
  const session = useAppSession();
  const [filter, setFilter] = useState<BvsFeedFilter>("all");
  const [query, setQuery] = useState("");
  const [lane, setLane] = useState<FeedLane>("focus");
  const [summaries, setSummaries] = useState<Record<string, ParticipationSummary>>({});
  const [myActivity, setMyActivity] = useState<Set<string>>(new Set());
  const [followIds, setFollowIds] = useState<Set<string>>(new Set());
  const [followNames, setFollowNames] = useState<Set<string>>(new Set());
  const postsRequest = useRef(0);
  const [posts, setPosts] = useState<ParticipationPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const pullStart = useRef<{ x: number; y: number } | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const sync = () => {
      const followed = readLibrary("follows");
      setFollowIds(new Set(followed.map((item) => String(item.id))));
      setFollowNames(new Set(followed.flatMap((item) => [normalized(item.title), normalized(item.subtitle)]).filter(Boolean)));
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
    if (!participationEnabled || !items.length) return;
    let active = true;
    const keys = [...new Set(items.map(targetKey))].slice(0, 120);
    const params = new URLSearchParams({ keys: keys.join(",") });
    void fetch(`/api/app/participation?${params.toString()}`, {
      headers: session.token ? { Authorization: `Bearer ${session.token}` } : undefined,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as { summaries?: Record<string, ParticipationSummary>; myActivity?: string[] };
      })
      .then((payload) => {
        if (!active || !payload) return;
        setSummaries(payload.summaries || {});
        setMyActivity(new Set(payload.myActivity || []));
      })
      .catch(() => null);
    return () => { active = false; };
  }, [items, participationEnabled, session.token]);

  const loadPosts = useCallback(async (cursor?: string | null, append = false, reset = false) => {
    if (!participationEnabled) return;
    const requestId = ++postsRequest.current;
    if (reset) { setPosts([]); setNextCursor(null); }
    setPostsLoading(true);
    setPostsError("");
    const params = new URLSearchParams({ limit: "20", lane, ...(surface ? { surface } : {}) });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/app/participation/posts?${params.toString()}`, {
      headers: session.token ? { Authorization: `Bearer ${session.token}` } : undefined,
      cache: "no-store",
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { posts?: ParticipationPost[]; nextCursor?: string | null; error?: string } : {};
    if (requestId !== postsRequest.current) return;
    if (!response?.ok) {
      setPostsError(payload.error || "Community posts could not be loaded.");
      setPostsLoading(false);
      return;
    }
    setPosts((current) => {
      const incoming = payload.posts || [];
      if (!append) return incoming;
      const known = new Set(current.map((post) => post.threadId));
      return [...current, ...incoming.filter((post) => !known.has(post.threadId))];
    });
    setNextCursor(payload.nextCursor || null);
    setPostsLoading(false);
  }, [participationEnabled, session.token, lane, surface]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void loadPosts(null, false, true); });
    return () => { active = false; postsRequest.current += 1; };
  }, [loadPosts]);

  const refreshFeed = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setPullDistance(PULL_REFRESH_TRIGGER);
    window.dispatchEvent(new CustomEvent("bvs:feed-refresh", { detail: { surface, lane } }));
    router.refresh();
    await Promise.allSettled([
      loadPosts(null, false),
      new Promise<void>((resolve) => window.setTimeout(resolve, 520)),
    ]);
    setRefreshing(false);
    setPullDistance(0);
  }, [lane, loadPosts, refreshing, router, surface]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (refreshing || window.scrollY > 0 || !event.touches[0]) {
      pullStart.current = null;
      return;
    }
    pullStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, [refreshing]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = pullStart.current;
    const touch = event.touches[0];
    if (!start || !touch || window.scrollY > 0 || refreshing) return;
    const dy = touch.clientY - start.y;
    const dx = Math.abs(touch.clientX - start.x);
    if (dy <= 0 || dy < dx * 1.15) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(88, dy * 0.46));
  }, [refreshing]);

  const finishPull = useCallback(() => {
    pullStart.current = null;
    if (refreshing) return;
    if (pullDistance >= PULL_REFRESH_TRIGGER) void refreshFeed();
    else setPullDistance(0);
  }, [pullDistance, refreshFeed, refreshing]);

  const visibleSystem = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const categoryItems = items.filter(item => (filter === "all" || item.category === filter) && (!needle || [item.object.title, item.object.subtitle, item.verb, ...(item.object.metadata || [])].join(" ").toLocaleLowerCase().includes(needle)));
    if (lane === "focus") return categoryItems;
    if (lane === "activity") return categoryItems.filter((item) => myActivity.has(targetKey(item)));
    return categoryItems.filter((item) => {
      if (item.category === "creator" && (followIds.has(item.object.id) || followIds.has(item.social?.item.id || ""))) return true;
      const title = normalized(item.object.title);
      const subtitle = normalized(item.object.subtitle);
      return Boolean((title && followNames.has(title)) || (subtitle && followNames.has(subtitle)));
    });
  }, [filter, followIds, followNames, items, lane, myActivity, query]);

  const visiblePosts = useMemo(() => {
    if (filter !== "all") return [];
    const needle = query.trim().toLocaleLowerCase();
    return posts.filter(post => !needle || [post.body, post.author.displayName, post.author.username, post.attachment?.title].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
  }, [filter, posts, query]);

  const timeline = useMemo<TimelineEntry[]>(() => [
    ...visiblePosts.map((post) => ({ type: "post" as const, at: post.createdAt, id: `post:${post.threadId}`, post })),
    ...visibleSystem.map((item) => ({ type: "system" as const, at: item.occurredAt, id: `system:${item.id}`, item })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [visiblePosts, visibleSystem]);

  function recordActivity(key: string, active: boolean) {
    setMyActivity((current) => {
      const next = new Set(current);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function addPost(post: ParticipationPost) {
    setPosts((current) => [post, ...current.filter((item) => item.threadId !== post.threadId)]);
    recordActivity(`post:${post.threadId}`, true);
    setFilter("all");
    setQuery("");
    setLane("focus");
  }

  function updatePost(post: ParticipationPost) {
    setPosts((current) => current.map((item) => item.threadId === post.threadId ? post : item));
    if (post.viewerLiked || post.viewerReposted || post.author.id === session.user?.id) recordActivity(`post:${post.threadId}`, true);
  }

  function deletePost(threadId: string) {
    setPosts((current) => current.filter((post) => post.threadId !== threadId));
    recordActivity(`post:${threadId}`, false);
  }

  const pullReady = pullDistance >= PULL_REFRESH_TRIGGER;
  const pulseStrength = Math.min(1, pullDistance / PULL_REFRESH_TRIGGER);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishPull}
      onTouchCancel={() => { pullStart.current = null; setPullDistance(0); }}
    >
      <div
        aria-live="polite"
        className="pointer-events-none -mt-1 flex items-center justify-center overflow-hidden transition-[height,opacity] duration-200"
        style={{ height: refreshing || pullDistance > 2 ? `${Math.max(24, pullDistance)}px` : "0px", opacity: refreshing || pullDistance > 2 ? 1 : 0 }}
      >
        <div className="flex items-center gap-2 rounded-full border border-brand/20 bg-brand/[.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-brand">
          <span className="flex h-4 items-center gap-[2px]" aria-hidden="true">
            {[0.45, 0.8, 1, 0.72, 0.42].map((factor, index) => (
              <span
                key={index}
                className={refreshing ? "w-[2px] animate-pulse rounded-full bg-brand" : "w-[2px] rounded-full bg-brand transition-all"}
                style={{ height: `${4 + Math.round(10 * factor * Math.max(.18, pulseStrength))}px`, animationDelay: `${index * 70}ms` }}
              />
            ))}
          </span>
          <span>{refreshing ? "Refreshing BVS" : pullReady ? "Release for fresh BVS" : "Pull to refresh"}</span>
        </div>
      </div>

      <FeedComposer key={session.user?.id || "guest"} surface={surface} enabled={participationEnabled} onCreated={addPost} />

      <div className="sticky top-[var(--bvs-app-header-height,4rem)] z-20 -mx-4 mt-4 border-y border-white/[.06] bg-[#08080a]/92 px-4 py-3 backdrop-blur-2xl sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white/[.015]" aria-label="Feed controls">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max gap-2" aria-label="Feed lanes">
            {lanes.filter(item => participationEnabled || item.id !== 'activity').map((item) => {
              const active = lane === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLane(item.id)}
                  aria-pressed={active}
                  className="bvs-feed-lane min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold text-white/60 transition"
                >
                  {item.label}
                </button>
              );
            })}
          </div></div>
          <button type="button" disabled={refreshing} onClick={() => void refreshFeed()} className="min-h-11 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold text-white/70 hover:text-white disabled:opacity-50" aria-label="Refresh feed">{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <details className="group mt-2" data-feed-refine="true">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-2 text-xs text-white/55 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden"><span>Search & filter{query.trim() ? ` · ${query.trim()}` : filter !== "all" ? ` · ${filters.find(item => item.id === filter)?.label}` : ""}</span><span aria-hidden="true" className="transition-transform group-open:rotate-180 motion-reduce:transition-none">⌄</span></summary>
        <label className="mt-2 block"><span className="sr-only">Search this feed</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search updates, artists or music" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-brand/50" /></label>
        <div className="mt-2 overflow-x-auto">
          <div className="flex min-w-max gap-1.5 sm:flex-wrap" aria-label="Feed categories">
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={active}
                  className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${active ? "border-brand/50 bg-brand/12 text-brand" : "border-white/10 bg-white/[.02] text-white/45 hover:border-white/20 hover:text-white"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        </details>
      </div>

      {postsError && filter === "all" ? <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ff7a70]/20 bg-[#ff7a70]/[.055] px-3 py-2 text-xs text-[#ff9a92]"><span>{postsError}</span><button type="button" onClick={() => void loadPosts(null, false)} className="min-h-9 rounded-full border border-white/15 px-3 text-white">Try again</button></div> : null}

      <div className="mt-5 space-y-4 sm:mt-7">
        {timeline.map((entry) => {
          if (entry.type === "post") {
            return <ParticipationPostCard key={`${entry.id}:${session.user?.id || "guest"}`} post={entry.post} surface={surface} enabled={participationEnabled} onChanged={updatePost} onDeleted={deletePost} />;
          }
          const item = entry.item;
          const key = targetKey(item);
          return (
            <div key={entry.id} className="rounded-[1.65rem] border border-white/[.075] bg-white/[.018] p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{categoryLabel[item.category]}</span>
                    <span className="text-white/20" aria-hidden="true">•</span>
                    <span className="text-xs font-medium text-white/72">{item.category === "beat" ? "New drop" : item.verb}</span>
                  </div>
                </div>
                <time suppressHydrationWarning dateTime={item.occurredAt} className="shrink-0 text-xs tabular-nums text-white/35" title={item.occurredAt}>
                  {relativeTime(item.occurredAt)}
                </time>
              </div>

              <BvsObjectCard object={item.object} variant={item.category === "beat" ? "feed-beat" : "feed-row"} menuExtras={item.social ? <LibraryAction item={{ ...item.social.item, href: exactFeedRoute(item) }} section={item.social.section} /> : undefined} />

              <FeedParticipation
                key={`${key}:${session.user?.id || "guest"}`}
                object={item.object}
                surface={surface}
                enabled={participationEnabled}
                summary={summaries[key]}
                onActivity={recordActivity}
              />

            </div>
          );
        })}

        {!timeline.length && !postsLoading ? (
          <div className="rounded-[1.65rem] border border-white/[.07] bg-white/[.02] px-5 py-12 text-center">
            <p className="text-sm font-medium text-white/70">
              {query.trim() ? `No updates match “${query.trim()}”.` : lane === "following" ? "Your followed creators will appear here." : lane === "activity" ? "Your likes, reposts and conversations belong here." : "No updates in this category yet."}
            </p>
            <p className="mt-2 text-xs text-white/38">
              {lane === "activity" && !session.signedIn
                ? "Sign in to keep your BVS activity connected across the app."
                : "When something relevant moves across BVS, it will appear here."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {query.trim() ? <button type="button" onClick={() => setQuery('')} className="min-h-11 rounded-full border border-white/15 px-4 text-sm text-white">Clear search</button> : null}
              {lane === 'activity' && !session.signedIn ? <Link href={surface ? `/app/${surface}/join` : '/auth/login?next=/feed'} className="min-h-11 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-black">Sign in</Link> : <Link href={surface ? `/app/${surface}/explore` : '/search?mode=creators'} className="min-h-11 rounded-full border border-white/15 px-4 py-3 text-sm text-white">Discover creators</Link>}
              <button type="button" onClick={() => { setLane('focus'); setFilter('all'); setQuery(''); }} className="min-h-11 rounded-full border border-white/15 px-4 text-sm text-white">Show latest</button>
            </div>
          </div>
        ) : null}

        {postsLoading && filter === "all" ? <p className="py-4 text-center text-xs text-white/35">Loading community posts…</p> : null}
        {nextCursor && filter === "all" ? (
          <div className="pt-1 text-center">
            <button type="button" disabled={postsLoading} onClick={() => void loadPosts(nextCursor, true)} className="min-h-11 rounded-full border border-white/10 px-5 text-sm font-semibold text-white/55 transition hover:border-[#929DE0]/35 hover:text-white disabled:opacity-40">
              {postsLoading ? "Loading…" : "Load more posts"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
