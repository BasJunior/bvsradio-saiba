"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import ParticipationMentionPicker, { type MentionProfile } from "@/components/feed/ParticipationMentionPicker";
import type { AppSurface } from "@/lib/app-surface";

export type ThreadMessage = {
  id: string;
  threadId: string;
  kind: "root" | "comment" | "reply";
  replyToId: string | null;
  body: string;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; username: string | null; displayName: string; avatarUrl: string | null };
  replyToAuthor: { id: string; username: string | null; displayName: string; avatarUrl: string | null } | null;
};

type ThreadPayload = {
  thread: {
    id: string;
    type: "post" | "content";
    intent: string | null;
    status: "published" | "locked";
    authorUserId: string | null;
    object: { kind: string; id: string; title: string; href: string; ownerUserId: string | null } | null;
    attachment: { kind: string; id: string; title: string; href: string } | null;
  };
  messages: ThreadMessage[];
  summary: { threadId: string; likes: number; reposts: number; comments: number; liked: boolean; reposted: boolean };
  subscription: { watchAllReplies: boolean; muted: boolean };
};

function clientKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `reply-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function relativeTime(iso: string) {
  const age = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function ParticipationThreadPanel({
  threadId,
  surface,
  enabled,
  showRoot = false,
  onSummary,
}: {
  threadId: string;
  surface: AppSurface | null;
  enabled: boolean;
  showRoot?: boolean;
  onSummary?: (summary: ThreadPayload["summary"]) => void;
}) {
  const session = useAppSession();
  const [payload, setPayload] = useState<ThreadPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [draftKey, setDraftKey] = useState(clientKey);
  const [mentions, setMentions] = useState<MentionProfile[]>([]);
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [rulesRequired, setRulesRequired] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [editing, setEditing] = useState<ThreadMessage | null>(null);
  const [editBody, setEditBody] = useState("");
  const [reporting, setReporting] = useState<ThreadMessage | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");

  const authHeaders = useCallback((json = false) => ({
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
  }), [session.token]);

  const summaryCallback = useRef(onSummary);
  summaryCallback.current = onSummary;

  const load = useCallback(async () => {
    if (!enabled || !threadId) return;
    setLoading(true);
    const response = await fetch(`/api/app/participation/threads/${encodeURIComponent(threadId)}${surface ? `?surface=${surface}` : ""}`, {
      headers: authHeaders(), cache: "no-store",
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) as ThreadPayload & { error?: string } : null;
    if (!response?.ok || !data?.thread) {
      setError(data?.error || "Conversation could not be loaded.");
      setPayload(null);
    } else {
      setPayload(data);
      setError("");
      summaryCallback.current?.(data.summary);
    }
    setLoading(false);
  }, [authHeaders, enabled, threadId, surface]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setDraft("");
    setDraftKey(clientKey());
    setMentions([]);
    setReplyingTo(null);
    setEditing(null);
    setReporting(null);
    setRulesRequired(false);
    setRulesAccepted(false);
  }, [session.user?.id, threadId]);

  const root = useMemo(() => payload?.messages.find((message) => message.kind === "root") || null, [payload]);
  const conversation = useMemo(() => payload?.messages.filter((message) => message.kind !== "root") || [], [payload]);
  const defaultParent = payload?.thread.type === "post" ? root : null;

  async function agreeRules() {
    if (!session.token || !rulesAccepted) return false;
    const response = await fetch("/api/app/participation/rules", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ agree: true, version: "participation-v1" }),
    }).catch(() => null);
    if (!response?.ok) { setError("Could not save your community-rules agreement."); return false; }
    setRulesRequired(false);
    return true;
  }

  async function sendReply() {
    if (!payload || !draft.trim() || sending) return;
    if (!session.signedIn || !session.token) { setError("Sign in to join this conversation."); return; }
    if (payload.thread.status === "locked") { setError("This conversation is locked."); return; }
    if (rulesRequired && !await agreeRules()) return;
    const parent = replyingTo || defaultParent;
    if (payload.thread.type === "post" && !parent) { setError("The original post is unavailable."); return; }
    setSending(true);
    setError("");
    const response = await fetch(`/api/app/participation/threads/${encodeURIComponent(threadId)}/replies`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ body: draft, replyToId: parent?.id || null, clientKey: draftKey, mentionUserIds: mentions.map((profile) => profile.id) }),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) as { error?: string; code?: string } : {};
    if (!response?.ok) {
      if (response?.status === 409 && data.code === "RULES_REQUIRED") setRulesRequired(true);
      else setError(data.error || "Could not send your reply. Your text is still here.");
      setSending(false);
      return;
    }
    setDraft("");
    setDraftKey(clientKey());
    setMentions([]);
    setReplyingTo(null);
    setRulesAccepted(false);
    await load();
    setSending(false);
  }

  async function saveEdit() {
    if (!editing || !session.token || !editBody.trim()) return;
    const isRoot = editing.kind === "root";
    const url = isRoot
      ? `/api/app/participation/threads/${encodeURIComponent(threadId)}`
      : `/api/app/participation/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(editing.id)}`;
    const response = await fetch(url, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ body: editBody }) }).catch(() => null);
    if (!response?.ok) { setError("Could not update that message."); return; }
    setEditing(null);
    setEditBody("");
    await load();
  }

  async function removeMessage(message: ThreadMessage) {
    if (!session.token || message.author.id !== session.user?.id) return;
    if (!window.confirm("Delete this message? Replies can leave a tombstone so the conversation still makes sense.")) return;
    const url = message.kind === "root"
      ? `/api/app/participation/threads/${encodeURIComponent(threadId)}`
      : `/api/app/participation/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(message.id)}`;
    const response = await fetch(url, { method: "DELETE", headers: authHeaders() }).catch(() => null);
    if (!response?.ok) { setError("Could not delete that message."); return; }
    await load();
  }

  async function reportMessage() {
    if (!reporting || !session.token) return;
    const response = await fetch("/api/app/participation/reports", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ threadId, messageId: reporting.id, reason: reportReason, details: reportDetails }),
    }).catch(() => null);
    if (!response?.ok) { setError("Could not submit that report."); return; }
    setReporting(null);
    setReportDetails("");
    setError("");
  }

  async function blockAuthor(message: ThreadMessage) {
    if (!session.token || message.author.id === session.user?.id) return;
    if (!window.confirm(`Block ${message.author.displayName}? Their content will be hidden from your signed-in experience and new alerts between you will be suppressed.`)) return;
    const response = await fetch("/api/app/participation/blocks", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ blockedUserId: message.author.id }),
    }).catch(() => null);
    if (!response?.ok) { setError("Could not block that account."); return; }
    await load();
  }

  async function updateSubscription(next: { watchAllReplies?: boolean; muted?: boolean }) {
    if (!session.token || !payload) return;
    const response = await fetch(`/api/app/participation/threads/${encodeURIComponent(threadId)}/subscription`, {
      method: "PUT", headers: authHeaders(true), body: JSON.stringify(next),
    }).catch(() => null);
    if (!response?.ok) { setError("Could not update conversation notifications."); return; }
    await load();
  }

  function renderMessage(message: ThreadMessage) {
    const own = message.author.id === session.user?.id;
    return (
      <article key={message.id} id={`reply-${message.id}`} className="rounded-xl border border-white/[.06] bg-white/[.022] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <strong className="font-semibold text-white/78">{message.author.displayName}</strong>
              {message.replyToAuthor ? <span className="text-[#929DE0]">replying to {message.replyToAuthor.displayName}</span> : null}
              <time className="text-white/28" dateTime={message.createdAt}>{relativeTime(message.createdAt)}</time>
              {message.editedAt ? <span className="text-white/25">edited</span> : null}
            </div>
            {editing?.id === message.id ? (
              <div className="mt-2">
                <textarea value={editBody} onChange={(event) => setEditBody(event.target.value.slice(0, message.kind === "root" ? 1000 : 500))} rows={3} className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none focus:border-[#929DE0]/50" />
                <div className="mt-2 flex gap-2"><button type="button" onClick={() => void saveEdit()} className="min-h-9 rounded-full bg-brand px-3 text-xs font-bold text-black">Save</button><button type="button" onClick={() => { setEditing(null); setEditBody(""); }} className="min-h-9 rounded-full px-3 text-xs text-white/50">Cancel</button></div>
              </div>
            ) : <p className={`mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 ${message.deleted ? "italic text-white/35" : "text-white/68"}`}>{message.body}</p>}
          </div>
        </div>
        {!message.deleted && !editing ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {session.signedIn ? <button type="button" onClick={() => setReplyingTo(message)} className="min-h-8 font-semibold text-[#929DE0] hover:text-white">Reply</button> : null}
            {own ? <button type="button" onClick={() => { setEditing(message); setEditBody(message.body); }} className="min-h-8 text-white/42 hover:text-white">Edit</button> : null}
            {own ? <button type="button" onClick={() => void removeMessage(message)} className="min-h-8 text-white/42 hover:text-[#ff9a92]">Delete</button> : null}
            {!own && session.signedIn ? <button type="button" onClick={() => { setReporting(message); setReportReason("spam"); setReportDetails(""); }} className="min-h-8 text-white/38 hover:text-[#ff9a92]">Report</button> : null}
            {!own && session.signedIn ? <button type="button" onClick={() => void blockAuthor(message)} className="min-h-8 text-white/38 hover:text-[#ff9a92]">Block</button> : null}
          </div>
        ) : null}
      </article>
    );
  }

  if (!enabled) return null;
  if (loading) return <div className="rounded-xl border border-white/[.06] p-4 text-sm text-white/40">Loading conversation…</div>;
  if (!payload) return <div className="rounded-xl border border-white/[.06] p-4 text-sm text-white/45">{error || "Conversation unavailable."}</div>;

  return (
    <section className="space-y-3" aria-label="Conversation">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-white/58">{payload.summary.comments} {payload.summary.comments === 1 ? "reply" : "replies"}</span>
        {session.signedIn ? (
          <>
            <button type="button" onClick={() => void updateSubscription({ watchAllReplies: !payload.subscription.watchAllReplies, muted: false })} className={`min-h-9 rounded-full border px-3 ${payload.subscription.watchAllReplies ? "border-[#7BA9D0]/40 bg-[#7BA9D0]/10 text-[#a8c9e5]" : "border-white/10 text-white/45"}`}>{payload.subscription.watchAllReplies ? "Watching" : "Watch replies"}</button>
            <button type="button" onClick={() => void updateSubscription({ muted: !payload.subscription.muted, watchAllReplies: false })} className={`min-h-9 rounded-full border px-3 ${payload.subscription.muted ? "border-white/20 bg-white/[.06] text-white/65" : "border-white/10 text-white/45"}`}>{payload.subscription.muted ? "Muted" : "Mute"}</button>
          </>
        ) : null}
        <Link href="/contact" className="ml-auto min-h-9 px-2 py-2 text-white/38 hover:text-white">Support</Link>
      </div>

      {showRoot && (payload.thread.object || payload.thread.attachment) ? (
        <Link href={(payload.thread.object || payload.thread.attachment)!.href} className="block rounded-xl border border-white/10 p-3 text-sm bvs-section-label">
          {(payload.thread.object || payload.thread.attachment)!.title} →
        </Link>
      ) : null}
      {showRoot && root && payload.thread.type === "post" ? renderMessage(root) : null}
      <div className="space-y-2">{conversation.map(renderMessage)}</div>
      {!conversation.length ? <p className="rounded-xl border border-white/[.06] bg-white/[.015] p-4 text-sm text-white/38">No replies yet. Be the first person to add something useful.</p> : null}

      {reporting ? (
        <div className="rounded-xl border border-[#ff7a70]/25 bg-[#ff7a70]/[.045] p-3">
          <p className="text-sm font-semibold text-white/75">Report this message</p>
          <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-white">
            <option value="harassment">Harassment</option><option value="spam">Spam</option><option value="harmful_content">Harmful content</option><option value="rights_concern">Rights concern</option><option value="other">Other</option>
          </select>
          <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value.slice(0, 500))} rows={2} placeholder="Optional detail for BVS staff" className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-white outline-none" />
          <div className="mt-2 flex gap-2"><button type="button" onClick={() => void reportMessage()} className="min-h-9 rounded-full bg-[#ff7a70] px-3 text-xs font-bold text-black">Send report</button><button type="button" onClick={() => setReporting(null)} className="min-h-9 rounded-full px-3 text-xs text-white/50">Cancel</button></div>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#929DE0]/16 bg-[#929DE0]/[.03] p-3">
        {replyingTo ? <div className="mb-2 flex items-center justify-between rounded-lg bg-[#929DE0]/10 px-3 py-2 text-xs text-[#c2c9ff]"><span>Replying to {replyingTo.author.displayName}</span><button type="button" onClick={() => setReplyingTo(null)} className="text-white/55">Cancel</button></div> : null}
        <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} rows={3} disabled={!session.signedIn || payload.thread.status === "locked"} placeholder={payload.thread.status === "locked" ? "This conversation is locked" : session.signedIn ? "Add a reply…" : "Sign in to reply"} className="w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-[#929DE0]/50 disabled:opacity-50" />
        <div className="mt-1 flex justify-end text-[11px] text-white/30">{draft.length}/500</div>
        {session.signedIn ? <div className="mt-2"><ParticipationMentionPicker selected={mentions} onChange={setMentions} max={5} /></div> : null}
        {rulesRequired ? <label className="mt-2 flex items-start gap-2 rounded-lg border border-[#929DE0]/20 p-2.5 text-xs leading-5 text-white/60"><input type="checkbox" checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} className="mt-1 accent-[#D4AF37]" /><span>I agree to the current BVS community rules before contributing.</span></label> : null}
        {error ? <p className="mt-2 text-xs text-[#ff9a92]" role="alert">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          {!session.signedIn ? <Link href={surface ? `/app/${surface}/login?next=${encodeURIComponent(`/app/${surface}/feed/${threadId}`)}` : `/auth/login?next=${encodeURIComponent(`/feed/${threadId}`)}`} className="min-h-10 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/65">Sign in</Link> : <span />}
          <button type="button" disabled={!session.signedIn || !draft.trim() || sending || payload.thread.status === "locked" || (rulesRequired && !rulesAccepted)} onClick={() => void sendReply()} className="min-h-10 rounded-full bg-brand px-4 text-xs font-bold text-black disabled:opacity-40">{sending ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </section>
  );
}
