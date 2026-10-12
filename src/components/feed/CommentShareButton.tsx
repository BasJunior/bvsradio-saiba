"use client";
import { canonicalBvsShareUrl } from "@/lib/share-url";
export default function CommentShareButton({ threadId, messageId, authorName, body, onNotice }: { threadId: string; messageId: string; authorName: string; body: string; onNotice: (notice: string) => void }) {
  const url = canonicalBvsShareUrl(`/feed/${encodeURIComponent(threadId)}#reply-${encodeURIComponent(messageId)}`);
  async function copy() {
    try { await navigator.clipboard.writeText(url); onNotice("Comment link copied."); }
    catch { onNotice("Could not copy. Use Share comment instead."); }
  }
  async function share() {
    if (!navigator.share) return copy();
    try { await navigator.share({ title: `${authorName} on BVS`, text: body.slice(0, 160), url }); }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) await copy(); }
  }
  return <>
    <button type="button" onClick={() => void share()} className="min-h-11 rounded-lg px-3 text-left text-xs text-white/65 hover:bg-white/5">Share comment</button>
    <button type="button" onClick={() => void copy()} className="min-h-11 rounded-lg px-3 text-left text-xs text-white/65 hover:bg-white/5">Copy comment link</button>
  </>;
}
