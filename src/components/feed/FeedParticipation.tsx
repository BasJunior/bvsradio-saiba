"use client";

import { useEffect, useMemo, useState } from "react";
import type { BvsObject } from "@/lib/bvs-object";
import type { AppSurface } from "@/lib/app-surface";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

export type ParticipationSummary = {
  likes: number;
  reposts: number;
  comments: number;
  liked: boolean;
  reposted: boolean;
};

type ThreadComment = {
  id: string;
  kind: "comment" | "reply";
  parentEventId: string | null;
  body: string;
  createdAt: string;
  actor: {
    id: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
  };
};

const emptySummary: ParticipationSummary = { likes: 0, reposts: 0, comments: 0, liked: false, reposted: false };

function relativeTime(iso: string) {
  const age = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function FeedParticipation({
  object,
  surface,
  enabled,
  summary: suppliedSummary,
  onActivity,
}: {
  object: BvsObject;
  surface: AppSurface;
  enabled: boolean;
  summary?: ParticipationSummary;
  onActivity?: (key: string, active: boolean) => void;
}) {
  const session = useAppSession();
  const key = `${object.kind}:${object.id}`;
  const [summary, setSummary] = useState<ParticipationSummary>(suppliedSummary || emptySummary);
  const [threadOpen, setThreadOpen] = useState(false);
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<ThreadComment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (suppliedSummary) setSummary(suppliedSummary);
  }, [suppliedSummary]);

  const roots = useMemo(() => comments.filter((comment) => comment.kind === "comment" || !comment.parentEventId), [comments]);
  const replies = useMemo(() => {
    const grouped = new Map<string, ThreadComment[]>();
    for (const comment of comments) {
      if (!comment.parentEventId) continue;
      grouped.set(comment.parentEventId, [...(grouped.get(comment.parentEventId) || []), comment]);
    }
    return grouped;
  }, [comments]);

  function authHeaders(json = false) {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    };
  }

  async function loadThread() {
    if (!enabled) return;
    setThreadLoading(true);
    setError("");
    const params = new URLSearchParams({ commentsFor: key });
    const response = await fetch(`/api/app/participation?${params.toString()}`, {
      headers: authHeaders(),
      cache: "no-store",
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { comments?: ThreadComment[]; error?: string } : {};
    if (!response?.ok) setError(payload.error || "Could not load comments.");
    else setComments(payload.comments || []);
    setThreadLoading(false);
  }

  async function toggle(kind: "like" | "repost") {
    if (!enabled) return;
    if (!session.signedIn || !session.token) {
      setError("Sign in from your profile to participate.");
      return;
    }
    setError("");
    const field = kind === "like" ? "liked" : "reposted";
    const countField = kind === "like" ? "likes" : "reposts";
    const wasActive = summary[field];
    const previous = summary;
    const optimistic = {
      ...summary,
      [field]: !wasActive,
      [countField]: Math.max(0, summary[countField] + (wasActive ? -1 : 1)),
    } as ParticipationSummary;
    setSummary(optimistic);
    onActivity?.(key, !wasActive || optimistic.comments > 0 || (kind === "like" ? optimistic.reposted : optimistic.liked));

    const response = await fetch("/api/app/participation", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ kind, targetKind: object.kind, targetId: object.id, surface }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { active?: boolean; error?: string } : {};
    if (!response?.ok) {
      setSummary(previous);
      onActivity?.(key, previous.liked || previous.reposted || previous.comments > 0);
      setError(payload.error || "Could not save that reaction.");
      return;
    }
    const confirmed = Boolean(payload.active);
    setSummary((current) => ({
      ...current,
      [field]: confirmed,
      [countField]: Math.max(0, current[countField] + (confirmed === current[field] ? 0 : confirmed ? 1 : -1)),
    } as ParticipationSummary));
  }

  async function submitComment() {
    if (!enabled || sending) return;
    if (!session.signedIn || !session.token) {
      setError("Sign in from your profile to comment.");
      return;
    }
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError("");
    const kind = replyingTo ? "reply" : "comment";
    const response = await fetch("/api/app/participation", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        kind,
        targetKind: object.kind,
        targetId: object.id,
        surface,
        body,
        parentEventId: replyingTo?.id,
      }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { error?: string } : {};
    if (!response?.ok) {
      setError(payload.error || "Could not post that comment.");
      setSending(false);
      return;
    }
    setDraft("");
    setReplyingTo(null);
    setSummary((current) => ({ ...current, comments: current.comments + 1 }));
    onActivity?.(key, true);
    await loadThread();
    setSending(false);
  }

  async function removeComment(comment: ThreadComment) {
    if (!session.token || comment.actor.id !== session.user?.id) return;
    const response = await fetch(`/api/app/participation?eventId=${encodeURIComponent(comment.id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => null);
    if (!response?.ok) {
      setError("Could not remove that comment.");
      return;
    }
    setSummary((current) => ({ ...current, comments: Math.max(0, current.comments - 1) }));
    await loadThread();
  }

  if (!enabled) return null;

  return (
    <div className="mt-3 border-t border-white/[.055] px-1 pt-3">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={summary.liked}
          onClick={() => void toggle("like")}
          className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${summary.liked ? "border-[#ff7a70]/45 bg-[#ff7a70]/12 text-[#ff9a92]" : "border-white/10 text-white/55 hover:border-[#ff7a70]/35 hover:text-[#ff9a92]"}`}
        >
          {summary.liked ? "♥" : "♡"} {summary.likes || "Like"}
        </button>
        <button
          type="button"
          aria-pressed={summary.reposted}
          onClick={() => void toggle("repost")}
          className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${summary.reposted ? "border-[#7db6ff]/45 bg-[#7db6ff]/12 text-[#9bc6ff]" : "border-white/10 text-white/55 hover:border-[#7db6ff]/35 hover:text-[#9bc6ff]"}`}
        >
          ↻ {summary.reposts || "Repost"}
        </button>
        <button
          type="button"
          aria-expanded={threadOpen}
          onClick={() => {
            const next = !threadOpen;
            setThreadOpen(next);
            if (next) void loadThread();
          }}
          className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${threadOpen ? "border-[#a88cff]/45 bg-[#a88cff]/12 text-[#c0aeff]" : "border-white/10 text-white/55 hover:border-[#a88cff]/35 hover:text-[#c0aeff]"}`}
        >
          ◌ {summary.comments || "Comment"}
        </button>
      </div>

      {error ? <p role="status" className="mt-2 text-xs text-[#ff9a92]">{error}</p> : null}

      {threadOpen ? (
        <div className="mt-3 rounded-2xl border border-white/[.07] bg-black/20 p-3">
          {threadLoading ? <p className="text-xs text-white/40">Loading conversation…</p> : null}
          {!threadLoading && !comments.length ? <p className="text-xs text-white/40">Start the conversation.</p> : null}

          <div className="space-y-3">
            {roots.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-white/[.025] px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <strong className="font-semibold text-white/78">{comment.actor.displayName}</strong>
                  <span className="text-white/28">{relativeTime(comment.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-white/66">{comment.body}</p>
                <div className="mt-2 flex gap-3 text-[11px]">
                  {session.signedIn ? (
                    <button type="button" onClick={() => setReplyingTo(comment)} className="font-semibold text-[#a88cff] hover:text-white">Reply</button>
                  ) : null}
                  {comment.actor.id === session.user?.id ? (
                    <button type="button" onClick={() => void removeComment(comment)} className="text-white/38 hover:text-[#ff9a92]">Remove</button>
                  ) : null}
                </div>
                {(replies.get(comment.id) || []).map((reply) => (
                  <div key={reply.id} className="ml-4 mt-2 border-l border-[#a88cff]/25 pl-3">
                    <div className="flex items-center gap-2 text-xs">
                      <strong className="font-semibold text-white/70">{reply.actor.displayName}</strong>
                      <span className="text-white/28">{relativeTime(reply.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-white/60">{reply.body}</p>
                    <div className="mt-1.5 flex gap-3 text-[11px]">
                      {session.signedIn ? <button type="button" onClick={() => setReplyingTo(reply)} className="font-semibold text-[#a88cff] hover:text-white">Reply</button> : null}
                      {reply.actor.id === session.user?.id ? <button type="button" onClick={() => void removeComment(reply)} className="text-white/38 hover:text-[#ff9a92]">Remove</button> : null}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-white/[.06] pt-3">
            {replyingTo ? (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-[#a88cff]/8 px-3 py-2 text-xs text-[#c0aeff]">
                <span>Replying to {replyingTo.actor.displayName}</span>
                <button type="button" onClick={() => setReplyingTo(null)} className="text-white/55 hover:text-white">Cancel</button>
              </div>
            ) : null}
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 1000))}
              rows={2}
              placeholder={session.signedIn ? "Add to the conversation… Use @username to mention someone" : "Sign in to comment"}
              disabled={!session.signedIn || sending}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#a88cff]/55 disabled:opacity-50"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[10px] tabular-nums text-white/28">{draft.length}/1000</span>
              <button
                type="button"
                disabled={!session.signedIn || !draft.trim() || sending}
                onClick={() => void submitComment()}
                className="min-h-9 rounded-full bg-[#a88cff] px-4 text-xs font-bold text-black disabled:opacity-40"
              >
                {sending ? "Posting…" : replyingTo ? "Reply" : "Comment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
