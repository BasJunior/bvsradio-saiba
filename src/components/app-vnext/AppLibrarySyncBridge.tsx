"use client";

import { useCallback, useEffect } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { DiscoveryItem } from "@/lib/discovery";
import {
  clearLibraryCache,
  getLibraryCacheOwner,
  readLibrary,
  setLibraryCacheOwner,
  writeLibrary,
  type LibrarySection,
} from "@/lib/library";

type Pending = { section: LibrarySection; item: DiscoveryItem; saved: boolean; at: string; userId: string };
type RemoteRow = { section?: string; item?: DiscoveryItem; updated_at?: string };

const sections: LibrarySection[] = ["favourites", "follows", "history"];
const queueKey = "bvs.library.sync.pending.v1";
const lastUserKey = "bvs.library.sync.last-user.v1";

function readQueue(): Pending[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(queueKey) || "[]") as Pending[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.item?.id && item?.userId && sections.includes(item.section))
      : [];
  } catch {
    return [];
  }
}

function writeQueue(items: Pending[]) {
  window.localStorage.setItem(queueKey, JSON.stringify(items.slice(-300)));
}

function enqueue(op: Pending) {
  const next = readQueue().filter(
    (item) => !(item.userId === op.userId && item.section === op.section && item.item.id === op.item.id),
  );
  next.push(op);
  writeQueue(next);
}

function mergeItems(local: DiscoveryItem[], remote: DiscoveryItem[], section: LibrarySection) {
  const seen = new Set<string>();
  const merged: DiscoveryItem[] = [];
  for (const item of [...local, ...remote]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return section === "history" ? merged.slice(0, 30) : merged;
}

export default function AppLibrarySyncBridge() {
  const { token, signedIn, loading, user } = useAppSession();
  const userId = user?.id || "";

  const send = useCallback(async (op: Pending) => {
    if (!token || !userId || op.userId !== userId) return false;
    try {
      const response = await fetch("/api/app/library", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section: op.section, item: op.item, saved: op.saved, at: op.at }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [token, userId]);

  const hydrate = useCallback(async () => {
    if (!token || !userId) return;

    const pending = readQueue().filter((op) => op.userId === userId);
    const remaining: Pending[] = [];
    for (const op of pending) {
      if (!(await send(op))) remaining.push(op);
    }
    writeQueue(remaining);

    try {
      const response = await fetch("/api/app/library", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { userId?: string; items?: RemoteRow[] };
      if (!payload.userId || payload.userId !== userId) return;
      const previousUser = window.localStorage.getItem(lastUserKey) || "";
      const markerKey = `bvs.library.sync.seeded.${payload.userId}.v1`;
      const seeded = window.localStorage.getItem(markerKey) === "1";
      const rows = Array.isArray(payload.items) ? payload.items : [];

      const remoteBySection = new Map<LibrarySection, DiscoveryItem[]>();
      for (const section of sections) remoteBySection.set(section, []);
      for (const row of rows) {
        if (!sections.includes(row.section as LibrarySection) || !row.item?.id) continue;
        remoteBySection.get(row.section as LibrarySection)?.push(row.item);
      }

      if (!seeded && (!previousUser || previousUser === payload.userId)) {
        const batch: Array<{ section: LibrarySection; item: DiscoveryItem; saved: true }> = [];
        for (const section of sections) {
          const merged = mergeItems(readLibrary(section), remoteBySection.get(section) || [], section);
          writeLibrary(section, merged, "remote");
          batch.push(...merged.map((item) => ({ section, item, saved: true as const })));
        }
        if (batch.length) {
          await fetch("/api/app/library", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ items: batch }),
          }).catch(() => null);
        }
        window.localStorage.setItem(markerKey, "1");
      } else {
        for (const section of sections) writeLibrary(section, remoteBySection.get(section) || [], "remote");
      }
      setLibraryCacheOwner(payload.userId);
      window.localStorage.setItem(lastUserKey, payload.userId);
    } catch {
      // Local library remains fully usable when sync is unavailable.
    }
  }, [send, token, userId]);

  useEffect(() => {
    if (loading) return;

    if (!signedIn || !userId) {
      const previousUser = window.localStorage.getItem(lastUserKey) || "";
      if (getLibraryCacheOwner() || previousUser) clearLibraryCache();
      writeQueue([]);
      window.localStorage.removeItem(lastUserKey);
      return;
    }

    const owner = getLibraryCacheOwner();
    const previousUser = window.localStorage.getItem(lastUserKey) || "";
    if ((owner && owner !== userId) || (!owner && previousUser && previousUser !== userId)) {
      clearLibraryCache();
    }
    setLibraryCacheOwner(userId);
    window.localStorage.setItem(lastUserKey, userId);
  }, [loading, signedIn, userId]);

  useEffect(() => {
    if (loading || !signedIn || !token || !userId) return;
    void hydrate();
    const resume = () => void hydrate();
    window.addEventListener("bvs:app-resume", resume);
    return () => window.removeEventListener("bvs:app-resume", resume);
  }, [hydrate, loading, signedIn, token, userId]);

  useEffect(() => {
    if (!signedIn || !token || !userId) return;
    const mutation = (raw: Event) => {
      const event = raw as CustomEvent<{ section?: LibrarySection; item?: DiscoveryItem; saved?: boolean }>;
      const detail = event.detail;
      if (!detail?.item?.id || !detail.section || !sections.includes(detail.section)) return;
      const op: Pending = {
        section: detail.section,
        item: detail.item,
        saved: detail.saved !== false,
        at: new Date().toISOString(),
        userId,
      };
      void send(op).then((ok) => { if (!ok) enqueue(op); });
    };
    window.addEventListener("bvs:library-mutation", mutation);
    return () => window.removeEventListener("bvs:library-mutation", mutation);
  }, [send, signedIn, token, userId]);

  return null;
}
