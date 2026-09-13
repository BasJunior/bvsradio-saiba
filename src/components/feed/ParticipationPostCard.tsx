"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppSurface } from "@/lib/app-surface";
import { shareBvs } from "@/lib/app-native";
import { canonicalBvsShareUrl } from "@/lib/share-url";
import type { ParticipationPost } from "@/lib/participation-server";

const intentLabel = {
  update: "Update",
  question: "Question",
  collaboration: "Looking for collaboration",
} as const;

const intentStyle = {
  update: "border-[#78e6bb]/25 bg-[#58d6a7]/[.06] text-[#78e6bb]",
  question: "border-[#929DE0]/30 bg-[#929DE0]/[.08] text-[#c2c9ff]",
  collaboration: "border-[#7db6ff]/25 bg-[#7db6ff]/[.07] text-[#9bc6ff]",
} as const;

function relativeTime(iso: string) {
  const age = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

export default function ParticipationPostCard({
  post,
  surface,
  enabled,
  onChanged,
  onDeleted,
}: {
  post: ParticipationPost;
  surface: AppSurface | null;
  enabled: boolean;
  onChanged?: (post: ParticipationPost) => void;
  onDeleted?: (threadId: string) => void;
}) {
  const session = useAppSession();
  const [current, setCurrent] = useState(post);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const permalink = surface ? `/app/${surface}/feed/${encodeURIComponent(current.threadId)}` : `/feed/${encodeURIComponent(current.threadId)}`;
  const own = current.author.id === session.user?.id;

  function authHeaders(json = false) {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    };
  }

  function commit(next: ParticipationPost) {
    setCurrent(next);
    onChanged?.(next);
  }

  async function toggle(reaction: "like" | "repost") {
    if (!enabled || busy) return;
    if (!session.token) {
      setError("Sign in to react to this post.");
      return;
    }
    setError("");
    const liked = reaction === "like";
    const wasActive = liked ? current.viewerLiked : current.viewerReposted;
    const optimistic: ParticipationPost = {
      ...current,
      viewerLiked: liked ? !wasActive : current.viewerLiked,
      viewerReposted: liked ? current.viewerReposted : !wasActive,
      likeCount: liked ? Math.max(0, current.likeCount + (wasActive ? -1 : 1)) : current.likeCount,
      repostCount: liked ? current.repostCount : Math.max(0, current.repostCount + (wasActive ? -1 : 1)),
    };
    const previous = current;
    commit(optimistic);
    const response = await fetch("/api/app/participation", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ reaction, active: !wasActive, threadId: current.threadId }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as {
      error?: string;
      summary?: { likes: number; reposts: number; comments: number; liked: boolean; reposted: boolean };
    } : {};
    if (!response?.ok || !payload.summary) {
      commit(previous);
      setError(payload.error || "Could not save that reaction.");
      return;
    }
    commit({
      ...optimistic,
      likeCount: payload.summary.likes,
      repostCount: payload.summary.reposts,
      replyCount: payload.summary.comments,
      viewerLiked: payload.summary.liked,
      viewerReposted: payload.summary.reposted,
    });
  }

  async function saveEdit() {
    if (!session.token || !own || busy || !editBody.trim()) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/app/participation/threads/${encodeURIComponent(current.threadId)}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({ body: editBody }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => ({})) as { error?: string } : {};
      setError(payload.error || "Could not update this post.");
      setBusy(false);
      return;
    }
    commit({ ...current, body: editBody.trim(), editedAt: new Date().toISOString() });
    setEditing(false);
    setBusy(false);
  }

  async function removePost() {
    if (!session.token || !own || busy) return;
    if (!window.confirm("Delete this post? Replies may leave a tombstone so the conversation still makes sense.")) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/app/participation/threads/${encodeURIComponent(current.threadId)}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => ({})) as { error?: string } : {};
      setError(payload.error || "Could not delete this post.");
      setBusy(false);
      return;
    }
    onDeleted?.(current.threadId);
  }

  async function share() {
    await shareBvs({
      title: `${current.author.displayName} on BVS`,
      text: current.body.slice(0, 180),
      url: canonicalBvsShareUrl(permalink),
    });
  }

  return (
    <article className="rounded-[1.65rem] border border-white/[.075] bg-white/[.022] p-4 sm:p-5" data-community-thread={current.threadId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="truncate text-sm font-semibold text-white/82">{current.author.displayName}</strong>
            {current.author.username ? <span className="truncate text-xs text-white/32">@{current.author.username}</span> : null}
            <time dateTime={current.createdAt} className="text-xs text-white/28">{relativeTime(current.createdAt)}</time>
            {current.editedAt ? <span className="text-[10px] text-white/25">edited</span> : null}
          </div>
          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em] ${intentStyle[current.intent]}`}>
            {intentLabel[current.intent]}
          </span>
        </div>
        {own ? (
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => { setEditing((value) => !value); setEditBody(current.body); }} className="min-h-9 rounded-full px-2 text-xs text-white/38 hover:text-white">Edit</button>
            <button type="button" disabled={busy} onClick={() => void removePost()} className="min-h-9 rounded-full px-2 text-xs text-white/38 hover:text-[#ff9a92] disabled:opacity-40">Delete</button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3">
          <textarea value={editBody} onChange={(event) => setEditBody(event.target.value.slice(0, 1000))} rows={4} className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white outline-none focus:border-[#929DE0]/55" />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="min-h-9 rounded-full px-3 text-xs text-white/45">Cancel</button>
            <button type="button" disabled={busy || !editBody.trim()} onClick={() => void saveEdit()} className="min-h-9 rounded-full bg-brand px-4 text-xs font-bold text-black disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-white/72">{current.body}</p>
      )}

      {current.attachment ? (
        <Link href={current.attachment.href} className="mt-4 flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#58d6a7]/18 bg-[#58d6a7]/[.045] px-4 py-3 transition hover:border-[#58d6a7]/35">
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[.14em] text-[#78e6bb]">Attached {current.attachment.kind}</span>
            <span className="mt-1 block truncate text-sm font-semibold text-white/76">{current.attachment.title}</span>
            {current.attachment.subtitle ? <span className="block truncate text-xs text-white/34">{current.attachment.subtitle}</span> : null}
          </span>
          <span aria-hidden="true" className="text-[#78e6bb]">→</span>
        </Link>
      ) : null}

      {error ? <p role="status" className="mt-3 text-xs text-[#ff9a92]">{error}</p> : null}

      <div className="mt-4 flex min-h-10 flex-wrap items-center gap-1.5 border-t border-white/[.055] pt-3">
        <button type="button" aria-pressed={current.viewerLiked} onClick={() => void toggle("like")} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${current.viewerLiked ? "border-[#ff7a70]/45 bg-[#ff7a70]/12 text-[#ff9a92]" : "border-white/10 text-white/50 hover:border-[#ff7a70]/35 hover:text-[#ff9a92]"}`}>
          {current.viewerLiked ? "♥" : "♡"} {current.likeCount || "Like"}
        </button>
        <button type="button" aria-pressed={current.viewerReposted} onClick={() => void toggle("repost")} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${current.viewerReposted ? "border-[#7db6ff]/45 bg-[#7db6ff]/12 text-[#9bc6ff]" : "border-white/10 text-white/50 hover:border-[#7db6ff]/35 hover:text-[#9bc6ff]"}`}>
          ↻ {current.repostCount || "Repost"}
        </button>
        <Link href={permalink} className="min-h-9 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 transition hover:border-[#929DE0]/35 hover:text-[#c2c9ff]">
          ◌ {current.replyCount || "Reply"}
        </Link>
        <button type="button" onClick={() => void share()} className="min-h-9 rounded-full border border-white/10 px-3 text-xs font-medium text-white/42 transition hover:border-[#58d6a7]/35 hover:text-[#78e6bb]">Share</button>
      </div>
    </article>
  );
}
