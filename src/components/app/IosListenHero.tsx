"use client";

import IosHomeListenPanel from "@/components/app/IosHomeListenPanel";
import { IOS_SURFACE_COPY, iosTrackCountLabel } from "@/lib/ios-surface-copy";

/**
 * Locked iOS home hero. Copy comes from the iOS copy lane; listen chrome is the
 * iOS-stable panel. Web HomeListenPanel / AppListenHero changes do not flow here.
 */
export default function IosListenHero({ trackCount }: { trackCount: number }) {
  return (
    <section id="listen" className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">{IOS_SURFACE_COPY.homeEyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{IOS_SURFACE_COPY.homeTitle}</h1>
        </div>
        <p className="text-xs text-text-secondary">{iosTrackCountLabel(trackCount)}</p>
      </div>
      <IosHomeListenPanel />
    </section>
  );
}
