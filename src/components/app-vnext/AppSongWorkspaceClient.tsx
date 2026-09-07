"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

type Workspace = {
  id: string;
  songTitle: string;
  lyrics: string;
  notes: string;
  status: "draft" | "ready_to_release" | "released";
  workspaceKind: "blank" | "licensed";
  hasAttachedBeat: boolean;
  beatTitle: string;
  producerName: string;
  licenceCode: string;
  licenceSummary: string;
  licenceTermsVersion?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  genre?: string | null;
  audioUrl?: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";
const lyricSections = ["Intro", "Verse", "Pre-Chorus", "Chorus", "Bridge", "Outro"];

export default function AppSongWorkspaceClient({ id, surface }: { id: string; surface: AppSurface }) {
  const router = useRouter();
  const { token, loading: sessionLoading } = useAppSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [songTitle, setSongTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const loadedIdRef = useRef("");

  useEffect(() => {
    if (sessionLoading || !token || loadedIdRef.current === id) return;
    let cancelled = false;
    loadedIdRef.current = id;
    fetch(`/api/creator/song-workspaces/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not open Song Workspace.");
        if (cancelled) return;
        const next = payload.workspace as Workspace;
        setWorkspace(next);
        setSongTitle(next.songTitle || "");
        setLyrics(next.lyrics || "");
        setNotes(next.notes || "");
        setSaveState("saved");
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not open Song Workspace.");
      });
    return () => { cancelled = true; };
  }, [id, sessionLoading, token]);

  const save = useCallback(async (nextStatus?: "draft" | "ready_to_release") => {
    if (!token || !workspace) return false;
    setSaveState("saving");
    setError("");
    const response = await fetch(`/api/creator/song-workspaces/${encodeURIComponent(workspace.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ songTitle, lyrics, notes, ...(nextStatus ? { status: nextStatus } : {}) }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = await response?.json().catch(() => ({}));
      setError(payload?.error || "Could not save your writing.");
      setSaveState("error");
      return false;
    }
    const payload = await response.json().catch(() => ({}));
    if (payload.workspace) {
      setWorkspace((current) => current ? { ...current, ...(payload.workspace as Workspace), audioUrl: current.audioUrl } : payload.workspace as Workspace);
    }
    setDirty(false);
    setSaveState("saved");
    return true;
  }, [lyrics, notes, songTitle, token, workspace]);

  useEffect(() => {
    if (!dirty || !workspace || !token) return;
    const timer = window.setTimeout(() => void save(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, save, token, workspace]);

  const markDirty = () => {
    setDirty(true);
    setSaveState("idle");
  };

  const appendSection = (label: string) => {
    setLyrics((current) => `${current}${current.trim() ? "\n\n" : ""}[${label}]\n`);
    markDirty();
  };

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.replace(`/app/${surface}/library`);
  };

  const visibleError = error || (!sessionLoading && !token ? "Sign in to open your private Lyrics Pad." : "");

  if (!workspace) return <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Song Workspace</p>
    <h1 className="mt-3 text-3xl font-semibold">{visibleError ? "Workspace unavailable" : "Opening your lyrics…"}</h1>
    {visibleError ? <><p className="mt-4 text-sm text-text-secondary">{visibleError}</p><button type="button" onClick={() => router.replace(`/app/${surface}/library`)} className="mt-6 min-h-11 rounded-full border border-white/15 px-5 text-sm">Back to Library</button></> : null}
  </div>;

  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "error" ? "Save needs attention" : dirty ? "Unsaved changes" : "Saved privately";
  return <div className="mx-auto max-w-5xl px-4 pb-12 pt-5 sm:px-6">
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={goBack} aria-label="Back to Library" className="min-h-11 rounded-full border border-white/10 px-4 text-sm text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">← Library</button>
      <div className="flex items-center gap-2 text-xs text-text-secondary"><span aria-live="polite">{saveLabel}</span><span className="rounded-full border border-white/10 px-3 py-1">Private</span></div>
    </div>

    <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Song Workspace · Lyrics Pad</p>
        <label className="mt-3 block"><span className="sr-only">Song title</span><input value={songTitle} onChange={(event) => { setSongTitle(event.target.value); markDirty(); }} placeholder="Name your song" className="min-h-12 w-full border-0 bg-transparent p-0 text-3xl font-semibold outline-none placeholder:text-white/25" /></label>
        <p className="mt-2 text-sm text-text-secondary">{workspace.hasAttachedBeat ? <>Writing to <strong className="text-white">{workspace.beatTitle}</strong> by {workspace.producerName}</> : "Your private blank page — no beat or purchase required."}</p>

        {workspace.audioUrl ? <section className="mt-5 rounded-3xl border border-brand/20 bg-brand/[.05] p-4" aria-label="Licensed beat player">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Attached beat</p><p className="mt-1 text-xs text-text-secondary">{[workspace.genre, workspace.bpm ? `${workspace.bpm} BPM` : null, workspace.musicalKey].filter(Boolean).join(" · ") || workspace.beatTitle}</p></div><span className="rounded-full border border-brand/25 px-3 py-1 text-xs text-brand">{workspace.licenceCode.replaceAll("_", " ")}</span></div>
          <audio controls preload="metadata" src={workspace.audioUrl} className="mt-4 w-full" aria-label={`Play ${workspace.beatTitle}`} />
        </section> : null}

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.02] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Lyrics</p><h2 className="mt-1 text-xl font-semibold">{workspace.hasAttachedBeat ? "Write while the beat plays" : "Shape your song"}</h2></div><div className="flex flex-wrap gap-1.5" aria-label="Insert song section">{lyricSections.map((section) => <button key={section} type="button" onClick={() => appendSection(section)} className="min-h-10 rounded-full border border-white/10 px-3 text-xs hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">+ {section}</button>)}</div></div>
          <label className="mt-5 block"><span className="sr-only">Lyrics</span><textarea value={lyrics} onChange={(event) => { setLyrics(event.target.value); markDirty(); }} placeholder={"[Verse]\nStart writing here…"} spellCheck className="min-h-[46vh] w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-5 text-base leading-8 outline-none focus:border-brand" /></label>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary"><span>{lyrics.trim() ? lyrics.trim().split(/\s+/).length : 0} words</span><button type="button" onClick={() => void save()} className="min-h-10 px-2 text-brand">Save now</button></div>
        </section>

        <details className="mt-5 rounded-3xl border border-white/10 bg-white/[.015] p-5"><summary className="min-h-10 cursor-pointer font-semibold">Song notes <span className="font-normal text-text-secondary">(private)</span></summary><label className="mt-3 block"><span className="sr-only">Private song notes</span><textarea value={notes} onChange={(event) => { setNotes(event.target.value); markDirty(); }} placeholder="Melody ideas, recording notes, ad-libs…" className="min-h-36 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 outline-none focus:border-brand" /></label></details>
        {error ? <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{error}</p> : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {workspace.hasAttachedBeat ? <section className="rounded-3xl border border-white/10 bg-white/[.02] p-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Licence attached</p><h2 className="mt-2 font-semibold">{workspace.beatTitle}</h2><p className="mt-1 text-sm text-text-secondary">{workspace.producerName}</p><p className="mt-4 text-sm leading-6 text-text-secondary">{workspace.licenceSummary}</p>{workspace.licenceTermsVersion ? <p className="mt-3 text-xs text-text-secondary">Terms {workspace.licenceTermsVersion}</p> : null}</section> : <section className="rounded-3xl border border-white/10 bg-white/[.02] p-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Included with BVS</p><h2 className="mt-2 font-semibold">Free private Lyrics Pad</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Write and autosave from any signed-in account. No purchase or beat licence is required.</p></section>}
        <section className="rounded-3xl border border-brand/20 bg-brand/[.05] p-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Writing status</p><h2 className="mt-2 text-xl font-semibold">{workspace.status === "ready_to_release" ? "Ready for your next step" : "Keep shaping the song"}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Lyrics and notes autosave privately to your BVS account.</p>{workspace.status !== "ready_to_release" ? <button type="button" onClick={() => void save("ready_to_release")} className="mt-5 min-h-11 w-full rounded-full bg-brand px-5 text-sm font-semibold text-black">Mark writing ready</button> : null}</section>
      </aside>
    </section>
  </div>;
}
