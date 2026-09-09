"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STORE_GENRES,
  STORE_LANGUAGES,
  TRACK_ORIGINS,
  TRACK_VERSIONS,
  formatStoreSendSheet,
  type PackIssue,
  type StoreDeliveryPack,
} from "@/lib/store-delivery-pack";
import { publicDistributionStatusLabel } from "@/lib/distribution-path";

type Payload = {
  release: { id: string; title: string; editorialStatus: string; isPublic: boolean };
  premium: boolean;
  job: { id: string; status: string; packComplete: boolean; notes?: string | null } | null;
  pack: StoreDeliveryPack;
  complete: boolean;
  issues: PackIssue[];
  sendSheet: string;
};

const field =
  "w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand";

export default function StoreDeliveryPackForm({
  token,
  releaseId,
  staff = false,
}: {
  token: string;
  releaseId: string;
  staff?: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [pack, setPack] = useState<StoreDeliveryPack | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/creator/store-delivery?releaseId=${encodeURIComponent(releaseId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load store details.");
    setData(payload);
    setPack(payload.pack);
  }, [releaseId, token]);

  useEffect(() => {
    if (!token || !releaseId) return;
    load().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load store details."));
  }, [load, releaseId, token]);

  const save = async (requestSend = false) => {
    if (!pack) return;
    setBusy(requestSend ? "send" : "save");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/creator/store-delivery", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId, pack, requestSend }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save store details.");
      setData((current) => current ? { ...current, ...payload, issues: payload.issues || [] } : payload);
      setPack(payload.pack);
      setMessage(
        requestSend
          ? "BVS has the store details and will send this next. It is not on Spotify yet."
          : payload.complete
            ? "Store details saved. You can ask BVS to send this to stores."
            : "Saved. Finish the remaining fields before BVS can send this.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save store details.");
    } finally {
      setBusy("");
    }
  };

  const copySheet = async () => {
    if (!pack) return;
    const sheet = formatStoreSendSheet(pack);
    try {
      await navigator.clipboard.writeText(sheet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the store sheet.");
    }
  };

  if (error && !pack) {
    return <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>;
  }
  if (!pack || !data) {
    return <p className="text-sm text-text-secondary">Loading store details…</p>;
  }

  const locked = ["submitted", "live_on_dsp"].includes(String(data.job?.status || ""));
  const updateTrack = (index: number, patch: Partial<StoreDeliveryPack["tracks"][number]>) => {
    setPack({
      ...pack,
      tracks: pack.tracks.map((track, trackIndex) => (trackIndex === index ? { ...track, ...patch } : track)),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">
          {staff ? "Store send pack" : "How this should appear on stores"}
        </p>
        <h3 className="mt-1 text-xl font-semibold">{data.release.title}</h3>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {staff
            ? "These are the values BVS will use when sending this Premium release to stores. Artists never see the private partner name."
            : "Tell BVS the title, credits and dates stores should show. After you save a complete pack, ask BVS to send it. Stores — not BVS — decide when it goes live."}
        </p>
        <p className="mt-2 text-xs text-brand">{publicDistributionStatusLabel(data.job?.status)}</p>
      </div>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {message && <p className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm text-brand">{message}</p>}
      {data.issues.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-amber-100">
          {data.issues.map((issue) => (
            <li key={issue.field}>{issue.message}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-text-secondary">Release title
          <input disabled={locked} value={pack.releaseTitle} onChange={(event) => setPack({ ...pack, releaseTitle: event.target.value })} className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-text-secondary">Release type
          <select disabled={locked} value={pack.releaseType} onChange={(event) => setPack({ ...pack, releaseType: event.target.value as StoreDeliveryPack["releaseType"] })} className={`${field} mt-1`}>
            <option value="single">Single</option>
            <option value="ep">EP</option>
            <option value="album">Album</option>
          </select>
        </label>
        <label className="text-xs text-text-secondary">Main artist name
          <input disabled={locked} value={pack.primaryArtist} onChange={(event) => setPack({ ...pack, primaryArtist: event.target.value })} className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-text-secondary">Featured artists
          <input disabled={locked} value={pack.featuredArtists} onChange={(event) => setPack({ ...pack, featuredArtists: event.target.value })} placeholder="Optional" className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-text-secondary">Genre
          <select disabled={locked} value={pack.genre} onChange={(event) => setPack({ ...pack, genre: event.target.value })} className={`${field} mt-1`}>
            <option value="">Select genre</option>
            {STORE_GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
            {pack.genre && !(STORE_GENRES as readonly string[]).includes(pack.genre) ? <option value={pack.genre}>{pack.genre}</option> : null}
          </select>
        </label>
        <label className="text-xs text-text-secondary">Release label
          <input disabled={locked} value={pack.labelName} onChange={(event) => setPack({ ...pack, labelName: event.target.value })} className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-text-secondary">Lyric language
          <select disabled={locked} value={pack.language} onChange={(event) => setPack({ ...pack, language: event.target.value })} className={`${field} mt-1`}>
            {STORE_LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
          </select>
        </label>
        <label className="text-xs text-text-secondary">Store date
          <input disabled={locked} type="date" value={pack.releaseDate} onChange={(event) => setPack({ ...pack, releaseDate: event.target.value })} className={`${field} mt-1`} />
          <span className="mt-1 block text-[11px]">Pick at least 7 days from today so stores can review it.</span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" disabled={locked} checked={pack.explicit} onChange={(event) => setPack({ ...pack, explicit: event.target.checked })} />
        This release has explicit lyrics
      </label>
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" disabled={locked} checked={pack.alreadyReleased} onChange={(event) => setPack({ ...pack, alreadyReleased: event.target.checked })} />
        This recording was already live on stores
      </label>
      {pack.alreadyReleased && (
        <label className="text-xs text-text-secondary">Existing UPC
          <input disabled={locked} value={pack.upc} onChange={(event) => setPack({ ...pack, upc: event.target.value })} placeholder="Leave blank if this is a first release" className={`${field} mt-1`} />
        </label>
      )}

      <div className="space-y-3">
        {pack.tracks.map((track, index) => (
          <article key={track.releaseTrackId || track.trackId || index} className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs uppercase tracking-[.16em] text-brand">Track {index + 1}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-text-secondary sm:col-span-2">Track title
                <input disabled={locked} value={track.title} onChange={(event) => updateTrack(index, { title: event.target.value })} className={`${field} mt-1`} />
              </label>
              <label className="text-xs text-text-secondary">Version
                <select disabled={locked} value={track.version} onChange={(event) => updateTrack(index, { version: event.target.value })} className={`${field} mt-1`}>
                  {TRACK_VERSIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-text-secondary">Origin
                <select disabled={locked} value={track.origin} onChange={(event) => updateTrack(index, { origin: event.target.value })} className={`${field} mt-1`}>
                  {TRACK_ORIGINS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-text-secondary">Recording year
                <input disabled={locked} inputMode="numeric" value={track.recordingYear} onChange={(event) => updateTrack(index, { recordingYear: event.target.value })} className={`${field} mt-1`} />
              </label>
              <label className="text-xs text-text-secondary">Existing ISRC
                <input disabled={locked} value={track.isrc} onChange={(event) => updateTrack(index, { isrc: event.target.value })} placeholder="Leave blank for a new recording" className={`${field} mt-1`} />
              </label>
              <label className="text-xs text-text-secondary">Songwriter(s)
                <input disabled={locked} value={track.songwriters} onChange={(event) => updateTrack(index, { songwriters: event.target.value })} className={`${field} mt-1`} />
              </label>
              <label className="text-xs text-text-secondary">Producer(s)
                <input disabled={locked} value={track.producers} onChange={(event) => updateTrack(index, { producers: event.target.value })} className={`${field} mt-1`} />
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary sm:col-span-2">
                <input type="checkbox" disabled={locked} checked={track.explicit} onChange={(event) => updateTrack(index, { explicit: event.target.checked })} />
                Explicit
              </label>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy) || locked} onClick={() => void save(false)} className="rounded-full border border-white/20 px-5 py-2 text-sm disabled:opacity-40">
          {busy === "save" ? "Saving…" : "Save store details"}
        </button>
        <button type="button" disabled={Boolean(busy) || locked || !data.premium} onClick={() => void save(true)} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black disabled:opacity-40">
          {busy === "send" ? "Sending…" : "Ask BVS to send to stores"}
        </button>
        {staff && (
          <button type="button" onClick={() => void copySheet()} className="rounded-full border border-brand/40 px-5 py-2 text-sm text-brand">
            {copied ? "Copied" : "Copy store send sheet"}
          </button>
        )}
      </div>
    </div>
  );
}
