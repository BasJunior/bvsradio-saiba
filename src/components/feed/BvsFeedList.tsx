"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import LibraryAction from "@/components/LibraryAction";
import FeedComposer from "@/components/feed/FeedComposer";
import FeedParticipation, { type ParticipationSummary } from "@/components/feed/FeedParticipation";
import ParticipationPostCard from "@/components/feed/ParticipationPostCard";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { BvsFeedCategory, BvsFeedFilter, BvsFeedItem } from "@/lib/bvs-feed";
import type { AppSurface } from "@/lib/app-surface";
import type { ParticipationPost } from "@/lib/participation-server";
import { shareBvs } from "@/lib/app-native";
import { canonicalBvsShareUrl } from "@/lib/share-url";
import { readLibrary } from "@/lib/library";

const filters: Array<{ id: BvsFeedFilter; label: string }> = [
  { id: "all", label: "Latest" },
  { id: "music", label: "Music" },
  { id: "creator", label: "Creators" },
  { id: "beat", label: "Beats" },
  { id: "live", label: "Live" },
  { id: "marketplace", label: "Marketplace" },
];

type FeedLane = "focus" | "following" | "activity";
const lanes: Array<{ id: FeedLane; label: string; accent: string }> = [
  { id: "focus", label: "Focus", accent: "#e3bd58" },
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
  surface: AppSurface;
  participationEnabled?: boolean;
}) {
  const session = useAppSession();
  const [filter, setFilter] = useState<BvsFeedFilter>("all");
  const [lane, setLane] = useState<FeedLane>("focus");
  const [summaries, setSummaries] = useState<Record<string, ParticipationSummary>>({});
  const [myActivity, setMyActivity] = useState<Set<string>>(new Set());
  const [followIds, setFollowIds] = useState<Set<string>>(new Set());
  const [followNames, setFollowNames] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<ParticipationPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

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

  const loadPosts = useCallback(async (cursor?: string | null, append = false) => {
    if (!participationEnabled) return;
    setPostsLoading(true);
    setPostsError("");
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/app/participation/posts?${params.toString()}`, {
      headers: session.token ? { Authorization: `Bearer ${session.token}` } : undefined,
      cache: "no-store",
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { posts?: ParticipationPost[]; nextCursor?: string | null; error?: string } : {};
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
  }, [participationEnabled, session.token]);

  useEffect(() => { void loadPosts(null, false); }, [loadPosts]);

  const visibleSystem = useMemo(() => {
    const categoryItems = filter === "all" ? items : items.filter((item) => item.category === filter);
    if (lane === "focus") return categoryItems;
    if (lane === "activity") return categoryItems.filter((item) => myActivity.has(targetKey(item)));
    return categoryItems.filter((item) => {
      if (item.category === "creator" && (followIds.has(item.object.id) || followIds.has(item.social?.item.id || ""))) return true;
      const title = normalized(item.object.title);
      const subtitle = normalized(item.object.subtitle);
      return Boolean((title && followNames.has(title)) || (subtitle && followNames.has(subtitle)));
    });
  }, [filter, followIds, followNames, items, lane, myActivity]);

  const visiblePosts = useMemo(() => {
    if (filter !== "all") return [];
    if (lane === "focus") return posts;
    if (lane === "activity") {
      return posts.filter((post) => post.author.id === session.user?.id || myActivity.has(`post:${post.threadId}`));
    }
    return posts.filter((post) => {
      if (followIds.has(post.author.id)) return true;
      const username = normalized(post.author.username);
      const display = normalized(post.author.displayName);
      return Boolean((username && followNames.has(username)) || (display && followNames.has(display)));
    });
  }, [filter, followIds, followNames, lane, myActivity, posts, session.user?.id]);

  const timeline = useMemo<TimelineEntry[]>(() => [
    ...visiblePosts.map((post) => ({ type: "post" as const, at: post.createdAt, id: `post:${post.threadId}`, post })),
    ...visibleSystem.map((item) => ({ type: "system" as const, at: item.occurredAt, id: `system:${item.id}`, item })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [visiblePosts, visibleSystem]);

  async function share(item: BvsFeedItem) {
    await shareBvs({
      title: item.object.title,
      text: `${item.verb} · ${item.object.subtitle || "BVS"}`,
      url: canonicalBvsShareUrl(exactFeedRoute(item)),
    });
  }

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

  return (
    <div>
      <FeedComposer surface={surface} enabled={participationEnabled} onCreated={addPost} />

      <div className="sticky top-[var(--bvs-app-header-height,4rem)] z-20 -mx-4 mt-4 border-y border-white/[.06] bg-[#08080a]/92 px-4 py-3 backdrop-blur-2xl sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white/[.015]" aria-label="Feed controls">
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-2" aria-label="Feed lanes">
            {lanes.map((item) => {
              const active = lane === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLane(item.id)}
                  aria-pressed={active}
                  className="min-h-10 rounded-full border px-4 text-sm font-semibold transition"
                  style={active
                    ? { borderColor: item.accent, backgroundColor: `${item.accent}1f`, color: item.accent }
                    : { borderColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(255,255,255,.025)", color: "rgba(255,255,255,.58)" }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
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
      </div>

      {postsError && filter === "all" ? <p role="status" className="mt-4 rounded-xl border border-[#ff7a70]/20 bg-[#ff7a70]/[.055] px-3 py-2 text-xs text-[#ff9a92]">{postsError}</p> : null}

      <div className="mt-5 space-y-4 sm:mt-7">
        {timeline.map((entry) => {
          if (entry.type === "post") {
            return <ParticipationPostCard key={entry.id} post={entry.post} surface={surface} enabled={participationEnabled} onChanged={updatePost} onDeleted={deletePost} />;
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

              <BvsObjectCard object={item.object} variant={item.category === "beat" ? "feed-beat" : "feed-row"} />

              <FeedParticipation
                object={item.object}
                surface={surface}
                enabled={participationEnabled}
                summary={summaries[key]}
                onActivity={recordActivity}
              />

              <div className="mt-3 flex min-h-11 flex-wrap items-center gap-2 border-t border-white/[.055] px-1 pt-3">
                {item.social ? (
                  <LibraryAction item={{ ...item.social.item, href: exactFeedRoute(item) }} section={item.social.section} compact />
                ) : null}
                <button
                  type="button"
                  onClick={() => void share(item)}
                  className="min-h-9 rounded-full border border-white/10 px-3 text-xs font-medium text-white/55 transition hover:border-[#58d6a7]/35 hover:text-[#78e6bb]"
                  aria-label={`Share ${item.object.title}`}
                >
                  Share
                </button>
                <span className="ml-auto hidden text-[10px] uppercase tracking-[.14em] text-white/25 sm:inline">BVS pulse</span>
              </div>
            </div>
          );
        })}

        {!timeline.length && !postsLoading ? (
          <div className="rounded-[1.65rem] border border-white/[.07] bg-white/[.02] px-5 py-12 text-center">
            <p className="text-sm font-medium text-white/70">
              {lane === "following" ? "Nothing from people you follow in this lane yet." : lane === "activity" ? "You have not participated in this lane yet." : "Nothing new in this lane yet."}
            </p>
            <p className="mt-2 text-xs text-white/38">
              {lane === "activity" && !session.signedIn
                ? "Sign in to keep your BVS activity connected across the app."
                : "When something relevant moves across BVS, it will appear here."}
            </p>
          </div>
        ) : null}

        {postsLoading && filter === "all" ? <p className="py-4 text-center text-xs text-white/35">Loading community posts…</p> : null}
        {nextCursor && filter === "all" && lane === "focus" ? (
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
