"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const EditorialCommandCenter = dynamic(() => import("@/components/EditorialCommandCenter"), { ssr: false });
const EditorialWorkBridge = dynamic(() => import("@/components/EditorialWorkBridge"), { ssr: false });
const EditorialWorkspaceNav = dynamic(() => import("@/components/EditorialWorkspaceNav"), { ssr: false });

function isEditorialPath(pathname: string | null) {
  return Boolean(
    pathname === "/editorial" ||
      pathname === "/admin/editorial" ||
      pathname?.startsWith("/editorial/") ||
      pathname?.startsWith("/admin/editorial/"),
  );
}

export default function DeferredEditorialTools() {
  const pathname = usePathname();
  if (!isEditorialPath(pathname)) return null;

  return (
    <>
      <EditorialCommandCenter />
      <EditorialWorkBridge />
      <EditorialWorkspaceNav />
    </>
  );
}
