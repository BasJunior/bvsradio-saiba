"use client";

import { usePathname } from "next/navigation";
import VisitorAssistant from "@/components/VisitorAssistant";

export default function VisitorAssistantGate() {
  const pathname = usePathname();
  if (/^\/app\/(ios|android)(?:\/|$)/.test(pathname)) return null;
  return <VisitorAssistant />;
}
