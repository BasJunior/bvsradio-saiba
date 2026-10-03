"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getLibrarySnapshot, libraryItemsFromSnapshot, type LibrarySection } from "@/lib/library";

function subscribe(callback: () => void) {
  window.addEventListener("bvs:library-change", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("bvs:library-change", callback); window.removeEventListener("storage", callback); };
}

export function useLocalLibrary(section: LibrarySection, owner: string) {
  const snapshot = useSyncExternalStore(subscribe, useCallback(() => getLibrarySnapshot(section, owner), [section, owner]), () => "[]");
  return useMemo(() => libraryItemsFromSnapshot(snapshot), [snapshot]);
}
