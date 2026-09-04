"use client";

import { useState } from "react";
import { shareBvs } from "@/lib/app-native";

export default function AppShareButton({ title, text, path, compact = false }: { title: string; text?: string; path: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={async () => {
    const url = `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
    const ok = await shareBvs({ title, text, url });
    if (ok) { setDone(true); window.setTimeout(() => setDone(false), 1400); }
  }} className={compact ? "min-h-9 rounded-full border border-white/10 px-3 text-xs" : "min-h-10 rounded-full border border-white/15 px-4 text-sm"}>{done ? "Shared ✓" : "Share"}</button>;
}
