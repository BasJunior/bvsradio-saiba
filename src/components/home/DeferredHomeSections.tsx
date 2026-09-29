"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

const HomeEngagementHub = dynamic(() => import("@/components/home/HomeEngagementHub"), { ssr: false });
const PublishedArtistsShelf = dynamic(() => import("@/components/PublishedArtistsShelf"), { ssr: false });
const PublishedAlbumsShelf = dynamic(() => import("@/components/PublishedAlbumsShelf"), { ssr: false });
const HomeBeatRail = dynamic(() => import("@/components/flow/HomeBeatRail"), { ssr: false });
const HomePublicPlaylistRail = dynamic(() => import("@/components/home/HomePublicPlaylistRail"), { ssr: false });

function DeferredMount({
  children,
  name,
}: {
  children: ReactNode;
  name: string;
}) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const marker = markerRef.current;
    if (!marker) return;

    if (!("IntersectionObserver" in window)) {
      const timer = window.setTimeout(() => setReady(true), 1200);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "900px 0px" },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div ref={markerRef} data-home-deferred={name} className="min-h-px">
      {ready ? children : null}
    </div>
  );
}

export function DeferredHomeEngagementHub() {
  return (
    <DeferredMount name="engagement">
      <HomeEngagementHub />
    </DeferredMount>
  );
}

export function DeferredPublishedArtistsShelf({ limit = 6 }: { limit?: number }) {
  return (
    <DeferredMount name="artists">
      <PublishedArtistsShelf limit={limit} />
    </DeferredMount>
  );
}

export function DeferredPublishedAlbumsShelf() {
  return (
    <DeferredMount name="releases">
      <PublishedAlbumsShelf />
    </DeferredMount>
  );
}

export function DeferredHomeBeatRail() {
  return (
    <DeferredMount name="beats">
      <HomeBeatRail />
    </DeferredMount>
  );
}

export function DeferredHomePublicPlaylistRail() {
  return (
    <DeferredMount name="playlists">
      <HomePublicPlaylistRail />
    </DeferredMount>
  );
}
