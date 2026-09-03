"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { useStationPlayer } from "@/components/StationPlayer";
import {
  listOffline,
  offlineLicenseValid,
  offlineMediaAvailable,
  offlinePlaybackSource,
  removeOffline,
  renewOffline,
  type OfflineItem,
  type OfflineManifest,
} from "@/lib/app-offline-native";
import { emitAppTelemetry } from "@/lib/app-telemetry";
import { recordListening } from "@/lib/library";

export default function AppOfflineDownloads({ surface }: { surface: AppSurface }) {
  const { token, signedIn } = useAppSession();
  const player = useStationPlayer();
  const [items, setItems] = useState<OfflineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [playingId, setPlayingId] = useState("");

  const refresh = useCallback(async () => {
    setItems(await listOffline());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const sync = () => void refresh();
    window.addEventListener("bvs:offline-change", sync);
    window.addEventListener("bvs:app-resume", sync);
    return () => {
      window.removeEventListener("bvs:offline-change", sync);
      window.removeEventListener("bvs:app-resume", sync);
    };
  }, [refresh]);

  async function play(item: OfflineItem) {
    if (!offlineLicenseValid(item)) return setNotice("Renew this recording's offline rights before playback.");
    setPlayingId(item.trackId);
    setNotice("Opening private offline media…");
    try {
      const source = await offlinePlaybackSource(item.trackId);
      const track = {
        id: item.trackId,
        title: item.title,
        artist: item.artist,
        src: source.src,
        artwork: item.artworkUrl || undefined,
        project: "Offline Downloads",
        offline: true,
      };
      player.playNow(track, { from: "Offline Downloads" });
      player.setQueueOpen(false);
      player.openNowPlaying();
      recordListening({ id: item.trackId, kind: "track", title: item.title, subtitle: item.artist, href: "/radio", image: item.artworkUrl || undefined });
      emitAppTelemetry("offline_playback_start", surface, { state: "ready" });
      setNotice("Playing from this device.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Offline playback could not start.";
      emitAppTelemetry("offline_playback_failure", surface, { reason: message.slice(0, 120) });
      setNotice(message);
      await refresh();
    } finally {
      setPlayingId("");
    }
  }

  async function remove(trackId: string) {
    try {
      await removeOffline(trackId);
      emitAppTelemetry("offline_download_remove", surface);
      setNotice("Download removed from this device.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Download could not be removed.");
    }
  }

  async function renew(item: OfflineItem) {
    if (!token) return;
    setNotice("Checking rights…");
    try {
      const response = await fetch(`/api/app/offline/manifest?trackId=${encodeURIComponent(item.trackId)}&surface=${surface}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({})) as { manifest?: OfflineManifest; error?: string };
      if (!response.ok || !payload.manifest) throw new Error(payload.error || "Rights could not be renewed.");
      await renewOffline(payload.manifest);
      emitAppTelemetry("offline_download_renew", surface, { state: "ready" });
      setNotice("Offline rights renewed.");
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rights could not be renewed.";
      emitAppTelemetry("offline_download_failure", surface, { reason: message.slice(0, 120), state: "renew" });
      setNotice(message);
    }
  }

  if (!signedIn) return null;
  return (
    <section className="mt-9">
      <p className="text-xs uppercase tracking-[.18em] text-brand">Offline</p>
      <h2 className="mt-1 text-2xl font-semibold">Downloads on this device</h2>
      <p className="mt-2 max-w-2xl text-sm text-text-secondary">Only recordings with explicit {surface === "ios" ? "iOS" : "Android"} clearance can be stored. Files stay inside BVS, periodically revalidate their rights and can play without a network connection while the licence is valid.</p>
      {!offlineMediaAvailable() ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] p-4 text-sm text-text-secondary">Offline storage activates in the installed BVS app. Web previews never pretend a file is downloaded.</div>
      ) : loading ? (
        <div className="mt-4 h-20 animate-pulse rounded-2xl bg-white/[.04]" />
      ) : items.length ? (
        <div className="mt-4 space-y-2">
          {items.map((item) => {
            const valid = offlineLicenseValid(item);
            return (
              <article key={item.trackId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{item.title}</h3>
                  <p className="truncate text-sm text-text-secondary">{item.artist}</p>
                  <p className={`mt-1 text-xs ${valid ? "text-emerald-200" : "text-amber-200"}`}>{valid ? `Available offline until ${new Date(item.licenseValidUntil).toLocaleDateString()}` : "Rights need revalidation before offline playback."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {valid ? <button type="button" disabled={playingId === item.trackId} onClick={() => void play(item)} className="min-h-10 rounded-full bg-brand px-4 text-xs font-semibold text-black disabled:opacity-50">{playingId === item.trackId ? "Opening…" : "▶ Play offline"}</button> : <button type="button" onClick={() => void renew(item)} className="min-h-10 rounded-full border border-brand/40 px-3 text-xs font-semibold text-brand">Renew</button>}
                  <button type="button" onClick={() => void remove(item.trackId)} className="min-h-10 rounded-full border border-white/10 px-3 text-xs text-text-secondary">Remove</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-text-secondary">No offline recordings yet. Cleared tracks show a Download action in Explore.</div>
      )}
      {notice ? <p role="status" className="mt-3 text-xs text-brand">{notice}</p> : null}
    </section>
  );
}
