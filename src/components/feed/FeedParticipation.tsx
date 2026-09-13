"use client";

import { useEffect, useMemo, useState } from "react";
import type { BvsObject } from "@/lib/bvs-object";
import type { AppSurface } from "@/lib/app-surface";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

export type ParticipationSummary = {
  threadId?: string | null;
  likes: number;
  reposts: number;
  comments: number;
  liked: boolean;
  reposted: boolean;
};

type ThreadMessage = {
  id: string;
  threadId: string;
  kind: "root" | "reply";
  replyToId: string | null;
  body: string;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  author: {
    id: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
  };
  replyToAuthor: {
    id: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

type ThreadPayload = {
  thread: { id: string; type: "post" | "content" };
  messages: ThreadMessage[];
  summary: ParticipationSummary & { threadId: string };
};

const emptySummary: ParticipationSummary = { threadId: null, likes: 0, reposts: 0, comments: 0, liked: false, reposted: false };
const eligibleKinds = new Set(["track", "release", "beat"]);
const RULES_VERSION = "participation-v1";

function relativeTime(iso: string) {
  const age = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function clientKey(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${random}`.slice(0, 160);
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
  const eligible = eligibleKinds.has(object.kind);
  const key = `${object.kind}:${object.id}`;
  const [summary, setSummary] = useState<ParticipationSummary>(suppliedSummary || emptySummary);
  const [threadId, setThreadId] = useState<string | null>(suppliedSummary?.threadId || null);
  const [rootMessageId, setRootMessageId] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [editing, setEditing] = useState<ThreadMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [rulesRequired, setRulesRequired] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!suppliedSummary) return;
    setSummary(suppliedSummary);
    setThreadId(suppliedSummary.threadId || null);
  }, [suppliedSummary]);

  const visibleMessages = useMemo(() => messages.filter((message) => message.kind === "reply"), [messages]);
  const children = useMemo(() => {
    const grouped = new Map<string, ThreadMessage[]>();
    for (const message of visibleMessages) {
      if (!message.replyToId) continue;
      grouped.set(message.replyToId, [...(grouped.get(message.replyToId) || []), message]);
    }
    return grouped;
  }, [visibleMessages]);
  const topLevel = useMemo(
    () => rootMessageId ? children.get(rootMessageId) || [] : visibleMessages.filter((message) => !message.replyToId),
    [children, rootMessageId, visibleMessages],
  );

  function authHeaders(json = false) {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    };
  }

  async function discoverThread() {
    const params = new URLSearchParams({ kind: object.kind, id: object.id });
    const response = await fetch(`/api/app/participation/content?${params.toString()}`, {
      headers: authHeaders(),
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return { threadId: null as string | null, rootMessageId: null as string | null };
    const payload = await response.json().catch(() => ({})) as { threadId?: string | null; rootMessageId?: string | null };
    if (payload.threadId) setThreadId(payload.threadId);
    if (payload.rootMessageId) setRootMessageId(payload.rootMessageId);
    return { threadId: payload.threadId || null, rootMessageId: payload.rootMessageId || null };
  }

  async function ensureThread() {
    if (threadId && rootMessageId) return { threadId, rootMessageId };
    if (!session.token) return { threadId: null, rootMessageId: null };
    const response = await fetch("/api/app/participation/content", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ kind: object.kind, id: object.id, surface }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { threadId?: string; rootMessageId?: string; error?: string } : {};
    if (!response?.ok || !payload.threadId || !payload.rootMessageId) {
      setError(payload.error || "Could not open the discussion.");
      return { threadId: null, rootMessageId: null };
    }
    setThreadId(payload.threadId);
    setRootMessageId(payload.rootMessageId);
    return { threadId: payload.threadId, rootMessageId: payload.rootMessageId };
  }

  async function loadThread(explicitId?: string | null) {
    if (!enabled || !eligible) return;
    setThreadLoading(true);
    setError("");
    const found = explicitId || threadId || (await discoverThread()).threadId;
    if (!found) {
      setMessages([]);
      setThreadLoading(false);
      return;
    }
    const response = await fetch(`/api/app/participation/threads/${encodeURIComponent(found)}`, {
      headers: authHeaders(),
      cache: "no-store",
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as ThreadPayload & { error?: string } : null;
    if (!response?.ok || !payload) {
      setError(payload?.error || "Could not load the discussion.");
      setThreadLoading(false);
      return;
    }
    setThreadId(payload.thread.id);
    setMessages(payload.messages || []);
    const root = (payload.messages || []).find((message) => message.kind === "root");
    setRootMessageId(root?.id || null);
    setSummary(payload.summary || emptySummary);
    setThreadLoading(false);
  }

  async function toggle(reaction: "like" | "repost") {
    if (!enabled || !eligible) return;
    if (!session.signedIn || !session.token) {
      setError("Sign in from your profile to participate.");
      return;
    }
    setError("");
    const field = reaction === "like" ? "liked" : "reposted";
    const countField = reaction === "like" ? "likes" : "reposts";
    const wasActive = summary[field];
    const previous = summary;
    setSummary({
      ...summary,
      [field]: !wasActive,
      [countField]: Math.max(0, summary[countField] + (wasActive ? -1 : 1)),
    } as ParticipationSummary);

    const response = await fetch("/api/app/participation", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        reaction,
        active: !wasActive,
        threadId: threadId || undefined,
        targetKind: object.kind,
        targetId: object.id,
        surface,
      }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { summary?: ParticipationSummary; error?: string } : {};
    if (!response?.ok || !payload.summary) {
      setSummary(previous);
      setError(payload.error || "Could not save that reaction.");
      return;
    }
    setSummary(payload.summary);
    setThreadId(payload.summary.threadId || threadId);
    onActivity?.(key, payload.summary.liked || payload.summary.reposted || payload.summary.comments > 0);
  }

  async function submitComment() {
    if (!enabled || !eligible || sending) return;
    if (!session.signedIn || !session.token) {
      setError("Sign in from your profile to comment.");
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError("");
    const ensured = await ensureThread();
    if (!ensured.threadId || !ensured.rootMessageId) {
      setSending(false);
      return;
    }
    const replyToId = replyingTo?.id || ensured.rootMessageId;
    const response = await fetch(`/api/app/participation/threads/${encodeURIComponent(ensured.threadId)}/replies`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ body: text, replyToId, clientKey: clientKey("reply") }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { error?: string; code?: string } : {};
    if (response?.status === 409 && payload.code === "RULES_REQUIRED") {
      setRulesRequired(true);
      setSending(false);
      return;
    }
    if (!response?.ok) {
      setError(payload.error || "Could not post that reply. Your draft is still here.");
      setSending(false);
      return;
    }
    setDraft("");
    setReplyingTo(null);
    setSummary((current) => ({ ...current, comments: current.comments + 1 }));
    onActivity?.(key, true);
    await loadThread(ensured.threadId);
    setSending(false);
  }

  async function agreeAndContinue() {
    if (!session.token) return;
    setSending(true);
    setError("");
    const response = await fetch("/api/app/participation/rules", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ agree: true, version: RULES_VERSION }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => ({})) as { error?: string } : {};
      setError(payload.error || "Could not save the rules agreement.");
      setSending(false);
      return;
    }
    setRulesRequired(false);
    setSending(false);
    await submitComment();
  }

  async function saveEdit() {
    if (!editing || !session.token || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    const response = await fetch(`/api/app/participation/messages/${encodeURIComponent(editing.id)}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({ body: text }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = response ? await response.json().catch(() => ({})) as { error?: string } : {};
      setError(payload.error || "Could not edit that reply.");
      setSending(false);
      return;
    }
    setDraft("");
    setEditing(null);
    await loadThread();
    setSending(false);
  }

  async function removeMessage(message: ThreadMessage) {
    if (!session.token || message.author.id !== session.user?.id) return;
    const response = await fetch(`/api/app/participation/messages/${encodeURIComponent(message.id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => null);
    if (!response?.ok) {
      setError("Could not remove that reply.");
      return;
    }
    setSummary((current) => ({ ...current, comments: Math.max(0, current.comments - 1) }));
    await loadThread();
  }

  function startEdit(message: ThreadMessage) {
    setReplyingTo(null);
    setEditing(message);
    setDraft(message.deleted ? "" : message.body);
  }

  function renderMessage(message: ThreadMessage, depth = 0): React.ReactNode {
    const nested = children.get(message.id) || [];
    return (
      <div key={message.id} className={depth ? "ml-4 mt-2 border-l border-[#a88cff]/25 pl-3" : "rounded-xl bg-white/[.025] px-3 py-2.5"}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <strong className="font-semibold text-white/78">{message.author.displayName}</strong>
          {message.replyToAuthor && depth > 0 ? <span className="text-white/32">to {message.replyToAuthor.displayName}</span> : null}
          <span className="text-white/28">{relativeTime(message.createdAt)}</span>
          {message.editedAt ? <span className="text-white/24">edited</span> : null}
        </div>
        <p className={`mt-1 whitespace-pre-wrap break-words text-sm leading-5 ${message.deleted ? "italic text-white/32" : "text-white/66"}`}>{message.body}</p>
        {!message.deleted ? (
          <div className="mt-2 flex gap-3 text-[11px]">
            {session.signedIn ? <button type="button" onClick={() => { setEditing(null); setReplyingTo(message); setDraft(""); }} className="font-semibold text-[#a88cff] hover:text-white">Reply</button> : null}
            {message.author.id === session.user?.id ? <button type="button" onClick={() => startEdit(message)} className="text-white/42 hover:text-white">Edit</button> : null}
            {message.author.id === session.user?.id ? <button type="button" onClick={() => void removeMessage(message)} className="text-white/38 hover:text-[#ff9a92]">Remove</button> : null}
          </div>
        ) : null}
        {nested.length ? <div>{nested.map((child) => renderMessage(child, Math.min(depth + 1, 3)))}</div> : null}
      </div>
    );
  }

  if (!enabled || !eligible) return null;

  return (
    <div className="mt-3 border-t border-white/[.055] px-1 pt-3">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={summary.liked} onClick={() => void toggle("like")} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${summary.liked ? "border-[#ff7a70]/45 bg-[#ff7a70]/12 text-[#ff9a92]" : "border-white/10 text-white/55 hover:border-[#ff7a70]/35 hover:text-[#ff9a92]"}`}>
          {summary.liked ? "♥" : "♡"} {summary.likes || "Like"}
        </button>
        <button type="button" aria-pressed={summary.reposted} onClick={() => void toggle("repost")} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${summary.reposted ? "border-[#7db6ff]/45 bg-[#7db6ff]/12 text-[#9bc6ff]" : "border-white/10 text-white/55 hover:border-[#7db6ff]/35 hover:text-[#9bc6ff]"}`}>
          ↻ {summary.reposts || "Repost"}
        </button>
        <button type="button" aria-expanded={threadOpen} onClick={() => { const next = !threadOpen; setThreadOpen(next); if (next) void loadThread(); }} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${threadOpen ? "border-[#a88cff]/45 bg-[#a88cff]/12 text-[#c0aeff]" : "border-white/10 text-white/55 hover:border-[#a88cff]/35 hover:text-[#c0aeff]"}`}>
          ◌ {summary.comments || "Discuss"}
        </button>
      </div>

      {error ? <p role="status" className="mt-2 text-xs text-[#ff9a92]">{error}</p> : null}

      {threadOpen ? (
        <div className="mt-3 rounded-2xl border border-white/[.07] bg-black/20 p-3">
          {threadLoading ? <p className="text-xs text-white/40">Loading discussion…</p> : null}
          {!threadLoading && !topLevel.length ? <p className="text-xs text-white/40">Start the discussion.</p> : null}
          <div className="space-y-3">{topLevel.map((message) => renderMessage(message))}</div>

          {rulesRequired ? (
            <div className="mt-3 rounded-xl border border-brand/25 bg-brand/[.06] p-3">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-brand">BVS community rules</p>
              <p className="mt-2 text-xs leading-5 text-white/58">Be constructive. No harassment or spam. Share only work you have the right to share. BVS may remove harmful or rights-infringing content.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={sending} onClick={() => void agreeAndContinue()} className="min-h-9 rounded-full bg-brand px-4 text-xs font-bold text-black disabled:opacity-40">Agree & continue</button>
                <button type="button" onClick={() => setRulesRequired(false)} className="min-h-9 rounded-full border border-white/10 px-4 text-xs text-white/55">Not now</button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 border-t border-white/[.06] pt-3">
            {replyingTo || editing ? (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-[#a88cff]/8 px-3 py-2 text-xs text-[#c0aeff]">
                <span>{editing ? `Editing your reply` : `Replying to ${replyingTo?.author.displayName}`}</span>
                <button type="button" onClick={() => { setReplyingTo(null); setEditing(null); setDraft(""); }} className="text-white/55 hover:text-white">Cancel</button>
              </div>
            ) : null}
            <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} rows={2} placeholder={session.signedIn ? "Add to the discussion…" : "Sign in to reply"} disabled={!session.signedIn || sending} className="w-full resize-none rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#a88cff]/55 disabled:opacity-50" />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[10px] tabular-nums text-white/28">{draft.length}/500</span>
              <button type="button" disabled={!session.signedIn || !draft.trim() || sending} onClick={() => void (editing ? saveEdit() : submitComment())} className="min-h-9 rounded-full bg-[#a88cff] px-4 text-xs font-bold text-black disabled:opacity-40">
                {sending ? "Saving…" : editing ? "Save edit" : replyingTo ? "Reply" : "Comment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
