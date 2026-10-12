"use client";

import { useRef, useState } from "react";
import type { AppSurface } from "@/lib/app-surface";

type LikeState = { likes: number; liked: boolean };

export default function CommentLikeButton({ threadId, messageId, authorName, likes, liked, token, surface }: {
  threadId: string; messageId: string; authorName: string;
  likes: number; liked: boolean; token: string | null; surface: AppSurface | null;
}) {
  const [override, setOverride] = useState<{ baseline: LikeState; value: LikeState } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  // A refreshed server payload supersedes the local optimistic snapshot.
  const current = override && override.baseline.likes === likes && override.baseline.liked === liked
    ? override.value : { likes, liked };

  async function toggle() {
    if (pending.current) return;
    if (!token) { setError("Sign in to like comments."); return; }
    const previous = current;
    const active = !previous.liked;
    const baseline = { likes, liked };
    pending.current = true;
    setBusy(true);
    setError("");
    setOverride({ baseline, value: { liked: active, likes: Math.max(0, previous.likes + (active ? 1 : -1)) } });
    try {
      const response = await fetch(`/api/app/participation/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/like${surface ? `?surface=${surface}` : ""}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active }), signal: AbortSignal.timeout(10000),
      });
      const data = await response.json().catch(() => ({})) as Partial<LikeState> & { error?: string; messageId?: string };
      if (!response.ok || data.messageId !== messageId || typeof data.likes !== "number" || typeof data.liked !== "boolean") {
        throw new Error(data.error || "Could not save your like. Try again.");
      }
      setOverride({ baseline, value: { likes: Math.max(0, data.likes), liked: data.liked } });
    } catch (issue) {
      setOverride({ baseline, value: previous });
      setError(issue instanceof Error && issue.name !== "TimeoutError" ? issue.message : "Could not save your like. Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" disabled={busy} aria-pressed={current.liked}
      aria-label={`${current.liked ? "Unlike" : "Like"} comment by ${authorName}, ${current.likes} ${current.likes === 1 ? "like" : "likes"}`}
      onClick={() => void toggle()}
      className={`min-h-9 px-1 font-semibold transition disabled:opacity-50 ${current.liked ? "text-[#ff9a92]" : "text-white/50 hover:text-[#ff9a92]"}`}>
      <span aria-hidden="true">{current.liked ? "♥" : "♡"}</span> {current.likes || "Like"}
    </button>
    {error ? <span role="alert" className="text-[11px] text-[#ff9a92]">{error}</span> : null}
  </span>;
}
