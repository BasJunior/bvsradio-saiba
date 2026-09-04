"use client";

import { useEffect, useRef } from "react";
import { useStationPlayer } from "@/components/StationPlayer";
import type { StationTrack } from "@/lib/station";

type OfflineTrack = StationTrack & { offline?: boolean };
type StationPayload = { tracks?: StationTrack[]; [key: string]: unknown };
type CachedStation = {
  at: number;
  payload: StationPayload;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
};

const SAVER_CACHE_MS = 2 * 60_000;
const OFFLINE_CACHE_MS = 5 * 60_000;

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function stationUrl(input: RequestInfo | URL) {
  try {
    const url = new URL(requestUrl(input), window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== "/api/station/tracks") return null;
    return url;
  } catch {
    return null;
  }
}

function safeHeaders(headers: Headers) {
  return Array.from(headers.entries()).filter(([name]) => {
    const lower = name.toLowerCase();
    return lower !== "content-length" && lower !== "content-encoding";
  });
}

function responseFromCache(cached: CachedStation, payload: StationPayload = cached.payload) {
  return new Response(JSON.stringify(payload), {
    status: cached.status,
    statusText: cached.statusText,
    headers: cached.headers,
  });
}

function shapeStationPayload(payload: StationPayload, saver: boolean) {
  const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
  return {
    ...payload,
    tracks: saver ? tracks.map((track) => ({ ...track, artwork: undefined })) : tracks,
  };
}

function withOfflineTrack(payload: StationPayload, offline: OfflineTrack | null) {
  if (!offline) return payload;
  const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
  const withoutDuplicate = tracks.filter((track) => (track.id || track.src) !== (offline.id || offline.src));
  return { ...payload, tracks: [offline, ...withoutDuplicate] };
}

function offlineFallback(): CachedStation {
  return {
    at: Date.now(),
    payload: { tracks: [] },
    status: 200,
    statusText: "OK",
    headers: [["content-type", "application/json"], ["cache-control", "no-store"]],
  };
}

/**
 * The global player refreshes the mobile station library every minute. In vNext,
 * that refresh must not evict a rights-checked private offline track and Data Saver
 * should not turn the one-minute poll into one-minute network traffic. Cached station
 * data never contains the private offline URI; it is injected only into the response
 * while that exact offline track remains active.
 */
export default function AppStationFetchBridge() {
  const player = useStationPlayer();
  const currentRef = useRef<OfflineTrack | null>(null);
  const saverRef = useRef(false);

  currentRef.current = (player.current as OfflineTrack | undefined)?.offline ? (player.current as OfflineTrack) : null;

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const cache = new Map<string, CachedStation>();

    const syncMode = (event?: Event) => {
      const eventMode = (event as CustomEvent<{ mode?: string }> | undefined)?.detail?.mode;
      saverRef.current = eventMode ? eventMode === "saver" : document.documentElement.dataset.bvsDataEffective === "saver";
    };
    syncMode();

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = stationUrl(input);
      const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (!url || method !== "GET") return originalFetch(input, init);

      const key = url.href;
      const offline = currentRef.current;
      const saver = saverRef.current;
      const cached = cache.get(key);
      const age = cached ? Date.now() - cached.at : Number.POSITIVE_INFINITY;

      if (offline && cached && age < OFFLINE_CACHE_MS) {
        return responseFromCache(cached, withOfflineTrack(shapeStationPayload(cached.payload, saver), offline));
      }
      if (saver && cached && age < SAVER_CACHE_MS) {
        return responseFromCache(cached, withOfflineTrack(shapeStationPayload(cached.payload, true), offline));
      }

      try {
        const response = await originalFetch(input, init);
        if (!response.ok) {
          if (!offline) return response;
          const fallback = offlineFallback();
          cache.set(key, fallback);
          return responseFromCache(fallback, withOfflineTrack(fallback.payload, offline));
        }

        const payload = await response.clone().json().catch(() => ({})) as StationPayload;
        // Only public/rights-cleared station data enters the cache. Never cache the
        // private file URI from a downloaded track.
        const basePayload = shapeStationPayload(payload, false);
        const next: CachedStation = {
          at: Date.now(),
          payload: basePayload,
          status: response.status,
          statusText: response.statusText,
          headers: safeHeaders(response.headers),
        };
        cache.set(key, next);

        if (offline || saver) {
          const outgoing = withOfflineTrack(shapeStationPayload(basePayload, saver), offline);
          return responseFromCache(next, outgoing);
        }
        return response;
      } catch (error) {
        if (!offline) throw error;
        const fallback = offlineFallback();
        cache.set(key, fallback);
        return responseFromCache(fallback, withOfflineTrack(fallback.payload, offline));
      }
    };

    window.addEventListener("bvs:app-data-effective", syncMode);
    return () => {
      window.removeEventListener("bvs:app-data-effective", syncMode);
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
