"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const VisitorAssistant = dynamic(() => import("@/components/VisitorAssistant"), { ssr: false });
const PwaRegister = dynamic(() => import("@/components/PwaRegister"), { ssr: false });
const ClientErrorBeacon = dynamic(() => import("@/components/ClientErrorBeacon"), { ssr: false });

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export default function DeferredGlobalTools() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const activate = () => setReady(true);

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(activate, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(activate, 900);
    }

    return () => {
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <VisitorAssistant />
      <PwaRegister />
      {process.env.NODE_ENV !== "production" ? <ClientErrorBeacon /> : null}
    </>
  );
}
