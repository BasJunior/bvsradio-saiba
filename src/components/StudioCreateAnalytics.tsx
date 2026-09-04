"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function StudioCreateAnalytics({ intent }: { intent: "release" | "beat" | "service" | "music_video" }) {
  useEffect(() => {
    trackEvent("create_form_started", { intent });
  }, [intent]);
  return null;
}
