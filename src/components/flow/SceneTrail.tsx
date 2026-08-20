"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearRecentFlowObjects,
  readRecentFlowObjects,
} from "@/lib/flow-memory";
import {
  clearFlowTrail,
  readFlowTrail,
  type FlowTrailItem,
} from "@/lib/flow-session";
import { trackEvent } from "@/lib/analytics";

export default function SceneTrail({
  source = "session",
}: {
  source?: "session" | "recent";
}) {
  const [trail, setTrail] = useState<FlowTrailItem[]>([]);

  useEffect(() => {
    const sync = () => {
      const items = source === "recent" ? readRecentFlowObjects() : readFlowTrail();
      setTrail((source === "recent" ? items.slice(0, 8) : items.slice(-6)));
    };
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener("bvs:flow-trail-change", sync);
    window.addEventListener("bvs:recent-flow-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("bvs:flow-trail-change", sync);
      window.removeEventListener("bvs:recent-flow-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [source]);

  if (trail.length < 2) return null;

  function clear() {
    if (source === "recent") clearRecentFlowObjects();
    else clearFlowTrail();
    setTrail([]);
    trackEvent("scene_trail_clear", { source });
  }

  return (
    <section
      aria-label="Your recent discovery trail"
      className="rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Your trail</p>
          <h2 className="mt-1 text-xl font-semibold">Continue where discovery led you</h2>
        </div>
        <button
          type="button"
          onClick={clear}
          className="min-h-11 rounded-full px-3 text-xs text-text-secondary hover:bg-white/5 hover:text-white"
        >
          Clear
        </button>
      </div>

      <ol className="mt-4 flex snap-x gap-2 overflow-x-auto pb-2" data-flow-scroll-key={`scene-trail-${source}`}>
        {trail.map((item, index) => (
          <li key={`${item.kind}-${item.id}-${item.openedAt}`} className="flex shrink-0 snap-start items-center gap-2">
            {index > 0 ? <span className="text-text-secondary" aria-hidden="true">→</span> : null}
            <Link
              href={item.route}
              onClick={() => trackEvent("scene_trail_resume", { object_id: item.id, object_kind: item.kind, source })}
              className="flex min-h-11 max-w-56 items-center rounded-full border border-white/10 bg-black/20 px-4 text-sm hover:border-brand/40 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="truncate">{item.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
