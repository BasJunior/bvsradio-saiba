"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import MobileFlowNav from "@/components/layout/MobileFlowNav";

function isVNextAppPath(pathname: string) {
  return /^\/app\/(ios|android)(?:\/|$)/.test(pathname);
}

export function RootNavbar() {
  const pathname = usePathname();
  if (isVNextAppPath(pathname)) return null;
  return <Navbar />;
}

export function RootMobileFlowNav() {
  const pathname = usePathname();
  if (isVNextAppPath(pathname)) return null;
  return <MobileFlowNav />;
}
