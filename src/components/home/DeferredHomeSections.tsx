"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

const HomeEngagementHub = dynamic(() => import("@/components/home/HomeEngagementHub"), { ssr: false });
const PublishedArtistsShelf = dynamic(() => import("@/components/PublishedArtistsShelf"), { ssr: false });
const PublishedAlbumsShelf = dynamic(() => import("@/components/PublishedAlbumsShelf"), { ssr: false });
const HomeBeatRail = dynamic(() => import("@/components/flow/HomeBeatRail"), { ssr: false });
const HomePublicPlaylistRail = dynamic(() => import("@/components/home/HomePublicPlaylistRail"), { ssr: false });
const HomeCreatorBands = dynamic(() => import("@/components/home/HomeCreatorBands"), { ssr: false });

function DeferredMount({
  children,
  name,
  placeholderClassName = "",
}: {
  children: ReactNode;
  name: string;
  placeholderClassName?: string;
}) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const marker = markerRef.current;
    if (!marker) return;

    if (typeof IntersectionObserver === "undefined") {
      const timer = globalThis.setTimeout(() => setReady(true), 1200);
      return () => globalThis.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div
      ref={markerRef}
      data-home-deferred={name}
      className={ready ? "min-h-px" : `min-h-px ${placeholderClassName}`}
    >
      {ready ? children : null}
    </div>
  );
}

export function DeferredHomeEngagementHub() {
  return (
    <DeferredMount name="engagement" placeholderClassName="min-h-[24rem]">
      <HomeEngagementHub />
    </DeferredMount>
  );
}

export function DeferredHomeCreatorBands() {
  return <DeferredMount name="creator-bands" placeholderClassName="min-h-[36rem]"><HomeCreatorBands /></DeferredMount>;
}

export function DeferredPublishedArtistsShelf({ limit = 6 }: { limit?: number }) {
  return (
    <DeferredMount name="artists" placeholderClassName="min-h-[18rem]">
      <PublishedArtistsShelf limit={limit} />
    </DeferredMount>
  );
}

export function DeferredPublishedAlbumsShelf() {
  return (
    <DeferredMount name="releases" placeholderClassName="min-h-[20rem]">
      <PublishedAlbumsShelf />
    </DeferredMount>
  );
}

export function DeferredHomeBeatRail() {
  return (
    <DeferredMount name="beats" placeholderClassName="min-h-[28rem]">
      <HomeBeatRail />
    </DeferredMount>
  );
}

export function DeferredHomePublicPlaylistRail() {
  return (
    <DeferredMount name="playlists" placeholderClassName="min-h-[28rem]">
      <HomePublicPlaylistRail />
    </DeferredMount>
  );
}
