"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

/** Reuses the deployed event contract; funnel_stage distinguishes commerce steps. */
export default function OfferAnalytics({ id, kind, source, children }: {
  id: string; kind: string; source: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      trackEvent("flow_object_open", { object_id: id, object_kind: kind, source, funnel_stage: "offer_view" });
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, kind, source]);
  return <div ref={ref} onClickCapture={event => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-offer-action]")) return;
    trackEvent("engagement_action_open", { object_id: id, object_kind: kind, source, funnel_stage: "offer_click" });
  }}>{children}</div>;
}
