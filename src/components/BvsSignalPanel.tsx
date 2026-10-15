
"use client";
import { useBvsSignal } from "@/lib/use-bvs-signal";
import { signalJourney } from "@/lib/bvs-signal";
import { openBvsShareCard } from "@/lib/share-card";

function displayTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }).format(date) : "";
}
export default function BvsSignalPanel({ trackId, source, compact = false, title = "This track", artist = "", artwork }: {
  trackId?: string; source: "station" | "song" | "share" | "explore"; compact?: boolean;
  title?: string; artist?: string; artwork?: string;
}) {
  const { signal, error, busy, catchTrack, retry } = useBvsSignal(trackId, source);
  if (!signal) return error ? (
    <div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/50" role="status">
      {error} <button type="button" onClick={retry} className="min-h-11 px-3 text-brand">Try again</button>
    </div>
  ) : null;
  const journey = signalJourney(signal);
  const early = Boolean(signal.caughtAt && signal.firstSpinPlayedAt &&
    Date.parse(signal.caughtAt) < Date.parse(signal.firstSpinPlayedAt));
  const share = () => openBvsShareCard({
    title, text: `I caught ${title}${artist ? ` by ${artist}` : ""} on BVS. Discovery receipt #${signal.catchPosition}.`,
    path: `/song/${signal.trackId}`, image: artwork, kicker: "Caught on BVS",
  });
  return (
    <section aria-label="BVS Signal" data-bvs-signal={signal.status}
      className={compact ? "mt-4 border-t border-white/10 pt-4" : "mt-6 border border-white/15 bg-white/[.025] p-4 sm:p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/45">BVS Signal</p>
          <p className={`mt-1 text-sm font-semibold ${signal.status === "breakout" ? "text-brand" : "text-white/90"}`}>{signal.label}</p>
        </div>
        {signal.catchCount > 0 && <p className="text-xs text-white/55">{signal.catchCount} {signal.catchCount === 1 ? "listener caught this" : "listeners caught this"}</p>}
      </div>
      {signal.status === "rising" && <p className="mt-2 text-xs text-white/55">{signal.recentCatchCount} Catches in the last 7 days · more than the previous 7.</p>}
      {!signal.firstSpinPlayedAt && signal.firstSpinScheduledAt && (
        <p className="mt-2 text-xs text-white/55">
          {signal.status === "awaiting_first_spin" ? "Scheduled time passed. Broadcast confirmation is still pending." : `Scheduled · ${displayTime(signal.firstSpinScheduledAt)}`}
        </p>
      )}
      {signal.editorialReason && (
        <div className="mt-4 border-l-2 border-brand/70 pl-3">
          <p className="text-[10px] uppercase tracking-[.15em] text-brand">Why BVS selected it</p>
          <p className="mt-1 text-sm leading-relaxed text-white/80">{signal.editorialReason}</p>
        </div>
      )}
      {!compact && journey.length > 0 && (
        <details className="mt-4 border-t border-white/10 pt-3">
          <summary className="min-h-11 cursor-pointer text-xs text-white/60">This song’s BVS journey</summary>
          <ol className="space-y-3 border-l border-white/15 pl-4">
            {journey.map(item => <li key={item.label} className="text-xs">
              <p className="font-medium text-white/80">{item.label}</p>
              <time dateTime={item.at} className="mt-1 block text-white/45">{displayTime(item.at)}</time>
            </li>)}
          </ol>
        </details>
      )}
      <div className={`mt-4 border p-3 ${signal.caught ? "border-brand/30 bg-brand/[.06]" : "border-white/10"}`}>
        {signal.caught ? (
          <div aria-live="polite">
            <p className="text-sm font-semibold text-brand">{early ? "You caught this before its First Spin." : "You caught this on BVS."}</p>
            <p className="mt-1 text-xs text-white/55">Discovery receipt #{signal.catchPosition} · {signal.caughtAt ? displayTime(signal.caughtAt) : ""}</p>
            <button type="button" onClick={share} className="mt-2 min-h-11 border border-brand/40 px-4 text-xs font-semibold text-brand">Share your discovery ↗</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void catchTrack()} disabled={busy} aria-busy={busy}
              className="min-h-11 border border-brand/50 bg-brand px-4 text-sm font-semibold text-black disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
              {busy ? "Saving your Catch…" : "Catch this track"}
            </button>
            <p className="max-w-xs text-xs leading-relaxed text-white/55">Found something? Keep a dated receipt that you discovered it here.</p>
          </div>
        )}
      </div>
      {!compact && <p className="mt-3 text-[11px] leading-relaxed text-white/40">Catch saves your discovery, not a vote. Rotation and BVS Breakout stay editorial.</p>}
      {error && <p role="alert" className="mt-3 text-xs text-red-200">{error}</p>}
    </section>
  );
}
