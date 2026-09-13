"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function sectionForPath(pathname: string) {
  const path = pathname.replace(/^\/app\/(ios|android)(?=\/|$)/, "") || "/";
  if (/^\/(feed)(\/|$)/.test(path)) return "feed";
  if (/^\/(explore|discover|catalogue|search)(\/|$)/.test(path)) return "explore";
  if (/^\/(beat|beats|beatstore)(\/|$)/.test(path)) return "beats";
  if (/^\/(studio|creator)(\/|$)/.test(path)) return "studio";
  if (/^\/(marketplace|shop)(\/|$)/.test(path)) return "marketplace";
  if (/^\/(shows|show|episodes)(\/|$)/.test(path)) return "shows";
  if (/^\/(library|account|you|notifications|login|join)(\/|$)/.test(path)) return "neutral";
  return "home";
}
export default function BvsSectionScope({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div data-bvs-section={sectionForPath(pathname)} className="bvs-section-scope">{children}</div>;
}
