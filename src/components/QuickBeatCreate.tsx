"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { isAllowedAudioFile } from "@/lib/audio-formats";
import { trackEvent } from "@/lib/analytics";

const field = "w-full rounded-xl border border-white/10 bg-black/20 p-3 text-base outline-none focus:border-brand";

type UploadSlot = { signedUrl: string; path: string; contentType?: string };

async function uploadSlot(slot: UploadSlot, file: File) {
  const response = await fetch(slot.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": slot.contentType || file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error(`Could not upload ${file.name}.`);
  return slot.path;
}

export default function QuickBeatCreate() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("29");
  const [preview, setPreview] = useState<File | null>(null);
  const [master, setMaster] = useState<File | null>(null);
  const [artwork, setArtwork] = useState<File | null>(null);
  const [genre, setGenre] = useState("Hip-Hop");
  const [mood, setMood] = useState("");
  const [bpm, setBpm] = useState("");
  const [description, setDescription] = useState("");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setDone(false);
    if (!title.trim()) return setError("Give the beat a title.");
    if (!preview) return setError("Choose the audio buyers will preview.");
    if (!rights) return setError("Confirm that you own or control the beat rights.");
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 1) return setError("Set a price of at least US$1.");
    const previewCheck = isAllowedAudioFile(preview);
    if (!previewCheck.ok) return setError(previewCheck.error || "Use MP3, WAV, M4A or OGG audio.");
    if (master) {
      const masterCheck = isAllowedAudioFile(master);
      if (!masterCheck.ok) return setError(masterCheck.error || "Use MP3, WAV, M4A or OGG audio.");
    }
    if (artwork && (!/\.(jpe?g|png|webp)$/i.test(artwork.name) || artwork.size > 8 * 1024 * 1024)) {
      return setError("Cover art must be JPG, PNG or WebP and 8MB or smaller.");
    }
    if (!isSupabaseConfigured()) return setError("Account service is unavailable.");

    setBusy(true);
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in before posting a beat.");

      setProgress("Preparing your upload…");
      const prepareResponse = await fetch("/api/beats/upload/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          preview: { name: preview.name, type: preview.type, size: preview.size },
          master: master ? { name: master.name, type: master.type, size: master.size } : undefined,
          artwork: artwork ? { name: artwork.name, type: artwork.type, size: artwork.size } : undefined,
        }),
      });
      const prepared = await prepareResponse.json().catch(() => ({}));
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare the upload.");

      setProgress("Uploading beat…");
      const previewPath = await uploadSlot(prepared.slots.preview, preview);
      const masterPath = master && prepared.slots.master ? await uploadSlot(prepared.slots.master, master) : null;
      const artworkPath = artwork && prepared.slots.artwork ? await uploadSlot(prepared.slots.artwork, artwork) : null;

      setProgress("Sending to BVS review…");
      const response = await fetch("/api/beats", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          description,
          genre,
          mood,
          bpm: bpm ? Number(bpm) : null,
          priceUsd: numericPrice,
          rightsConfirmed: true,
          previewPath,
          masterPath,
          artworkPath,
          submit: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not submit the beat.");
      trackEvent("create_submission_complete", { intent: "beat" });
      setDone(true);
      setTitle("");
      setPreview(null);
      setMaster(null);
      setArtwork(null);
      setMood("");
      setBpm("");
      setDescription("");
      setRights(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit the beat.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  if (done) {
    return (
      <section className="rounded-3xl border border-brand/30 bg-brand/[.06] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Sent</p>
        <h2 className="mt-2 text-2xl font-semibold">Your beat is with BVS</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary">
          Editorial will review it before it goes live. BVS has already created the Standard lease record behind the scenes, so you do not need to build a separate marketplace listing.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => setDone(false)} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Post another beat</button>
          <Link href="/creator/studio/manage#beatstore" className="rounded-full border border-white/15 px-5 py-2.5 text-sm">Track my beats</Link>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</p>}

      <section className="rounded-3xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">1 · Your beat</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-text-secondary sm:col-span-2">
            Beat title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Midnight Drive" className={`${field} mt-1`} required />
          </label>
          <label className="text-sm text-text-secondary sm:col-span-2">
            Preview audio
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" onChange={(event) => setPreview(event.target.files?.[0] || null)} className={`${field} mt-1`} required />
            <span className="mt-1 block text-xs">Use the tagged or watermarked version you want buyers to hear.</span>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">2 · Price</p>
        <label className="mt-4 block max-w-xs text-sm text-text-secondary">
          Standard lease price (USD)
          <input type="number" min="1" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className={`${field} mt-1`} required />
        </label>
        <p className="mt-3 text-xs leading-5 text-text-secondary">
          BVS creates the Standard lease listing for you. You can add more licence options later from your BeatStore management view.
        </p>
      </section>

      <details className="rounded-3xl border border-white/10 bg-white/[.015] p-5 sm:p-6">
        <summary className="cursor-pointer font-semibold">More details <span className="font-normal text-text-secondary">(optional)</span></summary>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-text-secondary">Genre<input value={genre} onChange={(event) => setGenre(event.target.value)} className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary">Mood<input value={mood} onChange={(event) => setMood(event.target.value)} placeholder="dark, soulful" className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary">BPM<input value={bpm} onChange={(event) => setBpm(event.target.value)} inputMode="numeric" className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary">Cover art<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => setArtwork(event.target.files?.[0] || null)} className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary sm:col-span-2">Private master / WAV<input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" onChange={(event) => setMaster(event.target.files?.[0] || null)} className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary sm:col-span-2">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${field} mt-1 min-h-24`} placeholder="Anything buyers should know" /></label>
        </div>
      </details>

      <section className="rounded-3xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">3 · Rights</p>
        <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-text-secondary">
          <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} className="mt-1.5" />
          <span>I own or control this beat and have the right to offer a Standard lease through BVS.</span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} className="min-h-11 rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-50">
          {busy ? "Working…" : "Send beat to BVS"}
        </button>
        <Link href="/creator/studio" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 py-3 text-sm">Cancel</Link>
        {progress && <span className="text-sm text-brand" role="status">{progress}</span>}
      </div>
    </form>
  );
}
