"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { ShareCardDetails } from "@/lib/share-card";

// Canvas rendering is loaded only after the listener asks to share.
const ShareCard = dynamic(() => import("@/components/app-vnext/AppShareButton"), { ssr: false });

export default function ShareCardHost() {
  const [request, setRequest] = useState<{ details: ShareCardDetails; key: number } | null>(null);
  const dismiss = useCallback(() => setRequest(null), []);
  useEffect(() => {
    const open = (event: Event) => {
      const details = (event as CustomEvent<ShareCardDetails>).detail;
      if (details?.title && details?.path) setRequest({ details, key: Date.now() });
    };
    window.addEventListener("bvs:share-card", open);
    return () => window.removeEventListener("bvs:share-card", open);
  }, []);
  return request ? <ShareCard key={request.key} {...request.details} autoOpen hideTrigger onDismiss={dismiss} /> : null;
}
