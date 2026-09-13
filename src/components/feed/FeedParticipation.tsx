"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import ParticipationThreadPanel from "@/components/feed/ParticipationThreadPanel";
import type { BvsObject } from "@/lib/bvs-object";
import type { AppSurface } from "@/lib/app-surface";
import type { ParticipationObjectKind } from "@/lib/participation-server";

export type ParticipationSummary = {
  threadId?: string | null;
  likes: number;
  reposts: number;
  comments: number;
  liked: boolean;
  reposted: boolean;
};

const emptySummary: ParticipationSummary = { threadId: null, likes: 0, reposts: 0, comments: 0, liked: false, reposted: false };
const eligibleKinds = new Set(["track", "release", "beat"]);

export default function FeedParticipation({
  object,
  surface,
  enabled,
  summary: suppliedSummary,
  onActivity,
}: {
  object: BvsObject;
  surface: AppSurface | null;
  enabled: boolean;
  summary?: ParticipationSummary;
  onActivity?: (key: string, active: boolean) => void;
}) {
  const session = useAppSession();
  const eligible = eligibleKinds.has(object.kind);
  const key = `${object.kind}:${object.id}`;
  const [summary, setSummary] = useState<ParticipationSummary>(suppliedSummary || emptySummary);
  const [threadId, setThreadId] = useState<string | null>(suppliedSummary?.threadId || null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!suppliedSummary) return;
    setSummary(suppliedSummary);
    setThreadId(suppliedSummary.threadId || null);
  }, [suppliedSummary]);

  function authHeaders(json = false) {
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    };
  }

  async function toggle(reaction: "like" | "repost") {
    if (!enabled || !eligible) return;
    if (!session.signedIn || !session.token) {
      setError("Sign in to participate.");
      return;
    }
    setError("");
    const field = reaction === "like" ? "liked" : "reposted";
    const countField = reaction === "like" ? "likes" : "reposts";
    const wasActive = summary[field];
    const previous = summary;
    const optimistic = {
      ...summary,
      [field]: !wasActive,
      [countField]: Math.max(0, summary[countField] + (wasActive ? -1 : 1)),
    } as ParticipationSummary;
    setSummary(optimistic);

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

  async function openDiscussion() {
    if (!eligible || opening) return;
    if (threadId) {
      setThreadOpen((current) => !current);
      return;
    }
    setOpening(true);
    setError("");
    const path = `/api/app/participation/content/${encodeURIComponent(object.kind)}/${encodeURIComponent(object.id)}${surface ? `?surface=${surface}` : ""}`;
    const getResponse = await fetch(path, { headers: authHeaders(), cache: "no-store" }).catch(() => null);
    const current = getResponse ? await getResponse.json().catch(() => ({})) as { threadId?: string | null; error?: string } : {};
    if (getResponse?.ok && current.threadId) {
      setThreadId(current.threadId);
      setThreadOpen(true);
      setOpening(false);
      return;
    }
    if (!session.signedIn || !session.token) {
      setThreadOpen(true);
      setOpening(false);
      return;
    }
    const createResponse = await fetch(path, { method: "POST", headers: authHeaders(true), body: "{}" }).catch(() => null);
    const created = createResponse ? await createResponse.json().catch(() => ({})) as { threadId?: string; error?: string } : {};
    if (!createResponse?.ok || !created.threadId) {
      setError(created.error || "Could not open this discussion.");
      setOpening(false);
      return;
    }
    setThreadId(created.threadId);
    setThreadOpen(true);
    setOpening(false);
  }

  if (!enabled || !eligible) return null;

  return (
    <div className="mt-3 border-t border-white/[.055] px-1 pt-3">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={summary.liked} onClick={() => void toggle("like")} className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition ${summary.liked ? "border-[#ff7a70]/45 bg-[#ff7a70]/12 text-[#ff9a92]" : "border-white/10 text-white/55 hover:border-[#ff7a70]/35 hover:text-[#ff9a92]"}`}>
          {summary.liked ? "♥" : "♡"} {summary.likes || "Like"}
        </button>
        <button type="button" aria-pressed={summary.reposted} onClick={() => void toggle("repost")} className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition ${summary.reposted ? "border-[#7BA9D0]/45 bg-[#7BA9D0]/12 text-[#a8c9e5]" : "border-white/10 text-white/55 hover:border-[#7BA9D0]/35 hover:text-[#a8c9e5]"}`}>
          ↻ {summary.reposts || "Repost"}
        </button>
        <button type="button" aria-expanded={threadOpen} onClick={() => void openDiscussion()} className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition ${threadOpen ? "border-[#929DE0]/45 bg-[#929DE0]/12 text-[#c2c9ff]" : "border-white/10 text-white/55 hover:border-[#929DE0]/35 hover:text-[#c2c9ff]"}`}>
          ◌ {opening ? "Opening…" : summary.comments ? `${summary.comments} Discussion` : "Discussion"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-[#ff9a92]" role="alert">{error}</p> : null}
      {threadOpen ? (
        <div className="mt-3">
          {threadId ? (
            <ParticipationThreadPanel
              threadId={threadId}
              surface={surface}
              enabled={enabled}
              onSummary={(next) => {
                setSummary(next);
                onActivity?.(key, next.liked || next.reposted || next.comments > 0);
              }}
            />
          ) : (
            <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4 text-sm text-white/50">
              <p>No discussion yet.</p>
              {!session.signedIn ? <Link href={surface ? `/app/${surface}/join` : `/auth/login?next=${encodeURIComponent("/feed")}`} className="mt-3 inline-flex min-h-10 items-center rounded-full bg-brand px-4 text-xs font-bold text-black">Sign in to start one</Link> : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
