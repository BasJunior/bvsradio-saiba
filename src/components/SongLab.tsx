"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBrowserSession } from "@/lib/use-browser-session";
import {
  deleteLocalTake, listLocalTakes, renderSongLabDemo, saveLocalTake,
  type SongLabTake,
} from "@/lib/song-lab-audio";

type WorkspaceBrief = {
  id: string; songTitle?: string; beatTitle?: string | null;
  hasAttachedBeat?: boolean; updatedAt?: string;
};
type Workspace = WorkspaceBrief & {
  lyrics: string; notes?: string; audioUrl?: string | null;
  bpm?: number | null; musicalKey?: string | null;
  producerName?: string; licenceSummary?: string;
};
type Access = { allowed: boolean; devPreview?: boolean };

const panel = "border border-white/15 bg-[#17191c] p-5";
const field = "w-full min-h-11 border border-white/20 bg-[#0f1113] px-3 py-2 text-sm text-white outline-none focus:border-[#c1ff52]";
const button = "inline-flex min-h-11 items-center justify-center gap-2 border border-white/20 px-4 py-2 text-sm font-semibold hover:border-[#c1ff52]/50 disabled:cursor-not-allowed disabled:opacity-40";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 bg-[#c1ff52] px-4 py-2 text-sm font-semibold text-black hover:bg-[#d3ff89] disabled:cursor-not-allowed disabled:opacity-40";

function formatTime(value: number): string {
  const seconds = Math.max(0, Math.floor(value));
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

function safeFilename(value: string): string {
  return (value || "BVS-song-concept").replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").slice(0, 80) || "BVS-song-concept";
}

export default function SongLab({ initialWorkspaceId = "" }: { initialWorkspaceId?: string }) {
  const { session, loading: sessionLoading } = useBrowserSession();
  const token = session?.access_token || "";
  const [checking, setChecking] = useState(true);
  const [access, setAccess] = useState<Access>({ allowed: false });
  const [workspaces, setWorkspaces] = useState<WorkspaceBrief[]>([]);
  const [selectedId, setSelectedId] = useState(initialWorkspaceId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [lyricsDirty, setLyricsDirty] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Saved in Lyrics Pad");
  const [takes, setTakes] = useState<SongLabTake[]>([]);
  const [takeUrls, setTakeUrls] = useState<Record<string, string>>({});
  const [localBeat, setLocalBeat] = useState<File | null>(null);
  const [localBeatUrl, setLocalBeatUrl] = useState("");
  const [beatGain, setBeatGain] = useState(0.75);
  const [vocalGain, setVocalGain] = useState(1);
  const [polish, setPolish] = useState(true);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentBeatTime, setCurrentBeatTime] = useState(0);
  const beatRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const vocalPlayersRef = useRef<HTMLAudioElement[]>([]);
  const lyricsRevision = useRef(0);
  const selectionRef = useRef("");

  const beatUrl = localBeatUrl || workspace?.audioUrl || "";
  const licensedPreview = !localBeat && Boolean(workspace?.hasAttachedBeat && workspace?.audioUrl);
  const selectedName = workspace?.songTitle || workspace?.beatTitle || "Untitled song";

  useEffect(() => {
    if (sessionLoading) return;
    if (!token) {
      setChecking(false);
      setAccess({ allowed: false });
      return;
    }
    let live = true;
    setChecking(true);
    fetch("/api/creator/song-lab/access", {
      headers: { Authorization: "Bearer " + token }, cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw new Error("Could not verify your Studio access.");
      return response.json() as Promise<Access>;
    }).then((result) => {
      if (live) setAccess(result);
    }).catch((caught) => {
      if (live) { setAccess({ allowed: false }); setError(String(caught.message || caught)); }
    }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [sessionLoading, token]);

  useEffect(() => {
    if (!access.allowed || !token) return;
    let live = true;
    fetch("/api/creator/song-workspaces", {
      headers: { Authorization: "Bearer " + token }, cache: "no-store",
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load song projects.");
      if (live) setWorkspaces(Array.isArray(body.workspaces) ? body.workspaces : []);
    }).catch((caught) => { if (live) setError(String(caught.message || caught)); });
    return () => { live = false; };
  }, [access.allowed, token]);

  useEffect(() => {
    if (!access.allowed || !token || !selectedId) { setWorkspace(null); setTakes([]); return; }
    let live = true;
    selectionRef.current = selectedId;
    setWorkspace(null);
    setTakes([]);
    setLocalBeat(null);
    setError("");
    setNotice("");
    Promise.all([
      fetch("/api/creator/song-workspaces/" + encodeURIComponent(selectedId), {
        headers: { Authorization: "Bearer " + token }, cache: "no-store",
      }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Cannot open Song Workspace.");
        return data.workspace as Workspace;
      }),
      listLocalTakes(selectedId),
    ]).then(([project, localTakes]) => {
      if (!live || selectionRef.current !== selectedId) return;
      setWorkspace(project);
      setLyrics(project.lyrics || "");
      setLyricsDirty(false);
      lyricsRevision.current++;
      setTakes(localTakes);
      setSaveLabel("Saved in Lyrics Pad");
    }).catch((caught) => { if (live) setError(String(caught.message || caught)); });
    return () => { live = false; };
  }, [access.allowed, selectedId, token]);

  useEffect(() => {
    if (!localBeat) { setLocalBeatUrl(""); return; }
    const url = URL.createObjectURL(localBeat);
    setLocalBeatUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localBeat]);

  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const take of takes) urls[take.id] = URL.createObjectURL(take.blob);
    setTakeUrls(urls);
    return () => { Object.values(urls).forEach((url) => URL.revokeObjectURL(url)); };
  }, [takes]);

  const saveLyrics = useCallback(async () => {
    if (!workspace || !token || !lyricsDirty) return;
    const revision = lyricsRevision.current;
    setSaveLabel("Saving...");
    try {
      const response = await fetch("/api/creator/song-workspaces/" + encodeURIComponent(workspace.id), {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save lyrics.");
      if (lyricsRevision.current === revision) {
        setLyricsDirty(false);
        setSaveLabel("Saved in Lyrics Pad");
      }
    } catch {
      setSaveLabel("Save failed — retry");
    }
  }, [lyrics, lyricsDirty, token, workspace]);

  useEffect(() => {
    if (!lyricsDirty) return;
    const timer = setTimeout(() => { void saveLyrics(); }, 1000);
    return () => clearTimeout(timer);
  }, [lyricsDirty, lyrics, saveLyrics]);

  function changeLyrics(value: string) {
    lyricsRevision.current++;
    setLyrics(value);
    setLyricsDirty(true);
    setSaveLabel("Unsaved changes");
  }

  const stopPlayback = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    vocalPlayersRef.current.forEach((player) => { player.pause(); player.currentTime = 0; });
    vocalPlayersRef.current = [];
    const beat = beatRef.current;
    if (beat) beat.pause();
    setPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      vocalPlayersRef.current.forEach((player) => player.pause());
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function playConcept() {
    if (!beatRef.current || !beatUrl || recording) return;
    stopPlayback();
    const beat = beatRef.current;
    beat.currentTime = 0;
    beat.volume = beatGain;
    try {
      // Monitoring is a rough browser preview; the offline WAV renderer
      // uses a shared audio timeline for a more accurate bounce.
      await beat.play();
      for (const take of takes) {
        if (take.muted || !takeUrls[take.id]) continue;
        const player = new Audio(takeUrls[take.id]);
        player.volume = Math.min(1, take.gain * vocalGain);
        vocalPlayersRef.current.push(player);
        const timer = setTimeout(() => { void player.play().catch(() => {}); }, take.startSec * 1000);
        timersRef.current.push(timer);
      }
      setPlaying(true);
    } catch {
      setError("Could not start playback. Try clicking Play again.");
    }
  }

  async function startRecording() {
    if (!workspace || !beatRef.current || !beatUrl) {
      setError("Select a project and load a beat before recording.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser does not support microphone recording.");
      return;
    }
    try {
      setError("");
      setNotice("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const beat = beatRef.current;
      if (beat.paused) {
        stopPlayback();
        beat.currentTime = 0;
        beat.volume = beatGain;
        await beat.play();
        setPlaying(true);
      }
      const startSec = beat.currentTime;
      const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => setError("Recording encountered an error. Please try again.");
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const take: SongLabTake = {
          id: crypto.randomUUID(), workspaceId: workspace.id,
          label: "Vocal " + (takes.length + 1), startSec,
          createdAt: Date.now(), blob, gain: 1, muted: false, transcript: "",
        };
        void saveLocalTake(take).then(() => {
          setTakes((current) => [...current, take]);
          setNotice("Take saved in this browser. Use Transcribe to send this take to Lyrics Pad.");
        }).catch(() => setError("Could not save the take in this browser. Check storage permissions."));
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError("Microphone permission or recording start failed. Use headphones and allow microphone access.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (beatRef.current) beatRef.current.pause();
    setPlaying(false);
  }

  async function updateTake(take: SongLabTake) {
    try {
      await saveLocalTake(take);
      setTakes((current) => current.map((item) => item.id === take.id ? take : item));
    } catch {
      setError("Could not update this take.");
    }
  }

  async function removeTake(take: SongLabTake) {
    if (recording || busy) return;
    try {
      await deleteLocalTake(take.id);
      setTakes((current) => current.filter((item) => item.id !== take.id));
    } catch {
      setError("Could not remove this take.");
    }
  }

  async function transcribe(take: SongLabTake) {
    if (!token || !workspace || busy) return;
    if (take.blob.size > 12 * 1024 * 1024) {
      setError("This take exceeds the 12 MB transcription limit. Record a shorter take.");
      return;
    }
    setBusy(take.id);
    setError("");
    try {
      const form = new FormData();
      const mime = take.blob.type.split(";")[0];
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : "webm";
      form.append("audio", new File([take.blob], "take." + ext, { type: mime }));
      const response = await fetch("/api/creator/song-lab/transcribe", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not transcribe recording.");
      const transcript = String(result.text || "").trim();
      if (!transcript) throw new Error("No words were detected. You can type lyrics manually.");
      await updateTake({ ...take, transcript });
      changeLyrics(lyrics + (lyrics.trim() ? "\n\n" : "") + "[" + take.label + " at " + formatTime(take.startSec) + "]\n" + transcript);
      setNotice("Transcript added to Lyrics Pad. Review the wording: sung and rapped lyrics may need correction.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not transcribe this take.");
    } finally {
      setBusy("");
    }
  }

  async function exportDemo() {
    if (!workspace || !beatUrl || busy) return;
    setBusy("export");
    setError("");
    setNotice("");
    try {
      const beatBlob = localBeat || await fetch(beatUrl).then((response) => {
        if (!response.ok) throw new Error("Could not load the licensed preview audio for exporting.");
        return response.blob();
      });
      const wav = await renderSongLabDemo({ beat: beatBlob, takes, beatGain, vocalGain, polish });
      const url = URL.createObjectURL(wav);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeFilename(selectedName) + "-BVS-demo.wav";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setNotice("Demo WAV rendered locally. This is a concept mix, not a commercial master.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not render the demo.");
    } finally {
      setBusy("");
    }
  }

  const timeline = useMemo(() => takes.map((take) => ({
    ...take,
    bar: Math.round(take.startSec / (workspace?.bpm ? 240 / workspace.bpm : 2)) + 1,
  })), [takes, workspace?.bpm]);

  if (sessionLoading || checking) return (
    <main className="mx-auto max-w-5xl px-6 py-16 text-sm text-white/60">Opening AI Song Lab...</main>
  );
  if (!token) return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-bold">AI Song Lab</h1>
      <p className="mt-4 text-white/60">Sign in to open your private song concepts.</p>
      <Link href="/auth/login?next=%2Fcreator%2Fstudio%2Fai-song-lab" className={primary + " mt-6"}>Sign in</Link>
    </main>
  );
  if (!access.allowed) return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-xs font-bold uppercase tracking-widest text-[#c1ff52]">Creator Studio / Premium</p>
      <h1 className="mt-3 text-3xl font-bold">AI Song Lab</h1>
      <p className="mt-4 text-white/60">The assisted production workspace is available to eligible Artist Premium accounts. Your existing Lyrics Pad projects stay accessible.</p>
      <Link href="/premium" className={primary + " mt-6"}>View Premium</Link>
      <Link href="/lyrics" className={button + " ml-3 mt-6"}>Lyrics Pad</Link>
    </main>
  );

  return (
    <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-6 sm:px-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.24em] text-[#c1ff52]">BVS Creator Studio / Premium</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">AI Song Lab</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Record the idea. Capture the lyrics. Shape a demo — without opening a full DAW.</p>
        </div>
        <Link href="/creator/studio" className={button}>Back to Studio</Link>
      </header>

      {access.devPreview ? <p className="mt-4 border border-[#c1ff52]/25 bg-[#c1ff52]/5 p-3 text-xs text-[#c1ff52]">Local development access is active. This never grants production Premium access.</p> : null}
      {error ? <p role="alert" className="mt-4 border border-red-400/35 bg-red-950/25 p-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 border border-[#c1ff52]/25 p-3 text-sm text-[#c1ff52]">{notice}</p> : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="min-w-0 space-y-5">
          <section className={panel} aria-label="Project and beat">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs uppercase tracking-widest text-white/50">Project</p><h2 className="mt-1 text-xl font-semibold">{selectedName}</h2></div>
              <Link href="/lyrics" className="text-xs text-[#c1ff52] hover:underline">Create project in Lyrics Pad</Link>
            </div>
            <label htmlFor="song-lab-project" className="mt-5 block text-xs text-white/60">Choose your private Song Workspace</label>
            <select id="song-lab-project" className={field + " mt-2"} value={selectedId} onChange={(event) => { stopPlayback(); setSelectedId(event.target.value); }}>
              <option value="">Select a song concept...</option>
              {workspaces.map((item) => <option key={item.id} value={item.id}>{item.songTitle || item.beatTitle || "Untitled song"}{item.hasAttachedBeat ? " (licensed beat)" : ""}</option>)}
            </select>
            {selectedId && !workspace ? <p className="mt-3 text-xs text-white/50">Loading project...</p> : null}
            {workspace ? <>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/55">
                <span>{workspace.hasAttachedBeat ? "Licensed beat" : "Blank writing project"}</span>
                {workspace.bpm ? <span>{workspace.bpm} BPM</span> : null}
                {workspace.musicalKey ? <span>{workspace.musicalKey}</span> : null}
                {workspace.producerName ? <span>{workspace.producerName}</span> : null}
              </div>
              {beatUrl ? <audio ref={beatRef} controls preload="metadata" src={beatUrl} onEnded={stopPlayback} onTimeUpdate={(event) => setCurrentBeatTime(event.currentTarget.currentTime)} className="mt-4 w-full" /> : null}
              <label htmlFor="song-lab-beat" className="mt-4 block text-xs text-white/60">Optional: use your own licensed, full-quality instrumental for local recording and demo export</label>
              <input id="song-lab-beat" type="file" accept="audio/*" className="mt-2 block w-full text-xs text-white/60 file:mr-4 file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white" onChange={(event) => { stopPlayback(); setLocalBeat(event.target.files?.[0] || null); }} />
              {licensedPreview ? <p className="mt-2 text-xs text-amber-200/80">BVS currently supplies the licensed beat preview, not its full production master. Demo exports may include the preview treatment.</p> : null}
              {!beatUrl ? <p className="mt-3 text-xs text-amber-200">No beat audio attached. Choose a local file to start recording.</p> : null}
            </> : null}
          </section>

          <section className={panel} aria-label="Recording and transport">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="text-xs uppercase tracking-widest text-white/50">Capture</p><h2 className="mt-1 text-xl font-semibold">Vocal recorder</h2></div>
              <span className="font-mono text-xl tabular-nums text-[#c1ff52]">{formatTime(currentBeatTime)}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={button} disabled={!beatUrl || recording} onClick={() => void playConcept()}>▶ Play concept</button>
              <button type="button" className={button} disabled={!playing && !recording} onClick={() => { if (recording) stopRecording(); stopPlayback(); }}>■ Stop</button>
              <button type="button" className={recording ? "min-h-11 border border-red-400 bg-red-500/20 px-5 text-sm font-bold text-red-200" : primary} disabled={!workspace || !beatUrl} onClick={() => { if (recording) stopRecording(); else void startRecording(); }}>
                {recording ? "● Stop recording" : "● Record vocal"}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-white/50">Use headphones to prevent beat bleed. Microphone permission is requested when you press Record. Your raw takes are saved in this browser.</p>
          </section>

          <section className={panel} aria-label="Multitrack timeline">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs uppercase tracking-widest text-white/50">Arrange</p><h2 className="mt-1 text-xl font-semibold">Song timeline</h2></div>
              <span className="text-xs text-white/50">{takes.length} vocal {takes.length === 1 ? "take" : "takes"}</span>
            </div>
            <div className="mt-5 grid grid-cols-[84px_repeat(4,minmax(0,1fr))] gap-px border border-white/10 bg-white/10 text-xs">
              <div className="bg-[#17191c] p-2 text-white/45">Track</div>
              {["Intro", "Verse", "Hook", "Outro"].map((part) => <div key={part} className="bg-[#17191c] p-2 text-center text-white/45">{part}</div>)}
              <div className="bg-[#17191c] p-3 font-semibold text-[#c1ff52]">Beat</div>
              <div className="col-span-4 bg-[#31491b] p-3 text-center text-[#d9ffad]">{beatUrl ? "Instrumental loaded" : "Choose a beat"}</div>
              {timeline.map((take) => <div key={take.id} className="contents">
                <div className="truncate bg-[#17191c] p-3 font-semibold">{take.label}</div>
                <div className="col-span-4 flex items-center bg-[#192a37] px-2 py-2">
                  <span className="block min-w-0 truncate bg-[#496981] px-3 py-2 text-xs text-white">Starts {formatTime(take.startSec)} · about bar {take.bar}{take.muted ? " · muted" : ""}</span>
                </div>
              </div>)}
            </div>
            {takes.length === 0 ? <p className="mt-4 text-sm text-white/50">Record a take to build your first vocal lane.</p> : null}
            <div className="mt-5 space-y-3">
              {takes.map((take) => <div key={take.id} className="border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input aria-label="Vocal take name" className={field + " max-w-40"} value={take.label} onChange={(event) => void updateTake({ ...take, label: event.target.value.slice(0, 40) })} />
                  <span className="text-xs text-white/50">At {formatTime(take.startSec)}</span>
                  <label className="flex items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={!take.muted} onChange={(event) => void updateTake({ ...take, muted: !event.target.checked })} /> Enabled</label>
                  <label className="flex items-center gap-2 text-xs text-white/65">Level <input aria-label={take.label + " gain"} type="range" min="0" max="1.5" step="0.05" value={take.gain} onChange={(event) => void updateTake({ ...take, gain: Number(event.target.value) })} /></label>
                  <button type="button" className="ml-auto text-xs text-red-300 hover:underline" onClick={() => void removeTake(take)}>Delete</button>
                </div>
                {takeUrls[take.id] ? <audio controls preload="metadata" src={takeUrls[take.id]} className="mt-3 h-10 w-full" /> : null}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" className={button} disabled={Boolean(busy)} onClick={() => void transcribe(take)}>{busy === take.id ? "Transcribing..." : take.transcript ? "Transcribe again" : "Transcribe → Lyrics Pad"}</button>
                  {take.transcript ? <p className="min-w-0 flex-1 text-xs leading-5 text-white/60">{take.transcript}</p> : <p className="text-xs text-white/45">No transcript yet</p>}
                </div>
              </div>)}
            </div>
          </section>

          <section className={panel} aria-label="Demo mix">
            <p className="text-xs uppercase tracking-widest text-white/50">Finish</p>
            <h2 className="mt-1 text-xl font-semibold">Assisted demo mix</h2>
            <p className="mt-2 text-sm text-white/60">A quick local vocal cleanup, balance and soft master limiting preset. This is an editable concept bounce, not AI mastering or a final commercial master.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-white/70">Beat level <input className="mt-2 block w-full" type="range" min="0" max="1.25" step="0.05" value={beatGain} onChange={(event) => setBeatGain(Number(event.target.value))} /></label>
              <label className="text-xs text-white/70">Vocal level <input className="mt-2 block w-full" type="range" min="0" max="1.5" step="0.05" value={vocalGain} onChange={(event) => setVocalGain(Number(event.target.value))} /></label>
            </div>
            <label className="mt-5 flex items-center gap-3 text-sm text-white/75"><input type="checkbox" checked={polish} onChange={(event) => setPolish(event.target.checked)} /> Clean vocal preset (high-pass + compression)</label>
            <button type="button" className={primary + " mt-5"} disabled={!beatUrl || Boolean(busy) || recording} onClick={() => void exportDemo()}>{busy === "export" ? "Rendering WAV..." : "Export concept demo WAV"}</button>
            <p className="mt-3 text-xs leading-5 text-white/45">WAV rendering runs in your browser. Confirm the producer's actual licence and use a full-quality beat before any release.</p>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className={panel + " xl:sticky xl:top-24"}>
            <div className="flex items-center justify-between gap-2">
              <div><p className="text-xs uppercase tracking-widest text-[#c1ff52]">Lyrics Pad</p><h2 className="mt-1 text-xl font-semibold">Words alongside the beat</h2></div>
              {workspace ? <Link href={"/creator/studio/songs/" + encodeURIComponent(workspace.id)} className="text-xs text-[#c1ff52] hover:underline">Full pad</Link> : null}
            </div>
            <textarea aria-label="Song lyrics" disabled={!workspace} value={lyrics} onChange={(event) => changeLyrics(event.target.value)} placeholder="Your verse, hooks and ad-libs appear here. You can also type freely." className="mt-4 min-h-[380px] w-full resize-y border border-white/15 bg-black/20 p-4 text-sm leading-7 text-white outline-none focus:border-[#c1ff52] disabled:opacity-50" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-white/50">{saveLabel}</span>
              <button type="button" className="text-xs font-semibold text-[#c1ff52]" disabled={!lyricsDirty} onClick={() => void saveLyrics()}>Save lyrics</button>
            </div>
          </section>
          <section className={panel}>
            <p className="text-xs uppercase tracking-widest text-white/50">Arrangement guide</p>
            <h2 className="mt-2 text-lg font-semibold">A simple starting structure</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">Intro 4 bars → Verse 16 bars → Hook 8 bars → Verse 16 bars → Hook 8 bars → Outro. A rule-of-thumb suggestion, not an AI-generated arrangement.</p>
            {workspace?.bpm ? <p className="mt-3 text-xs text-[#c1ff52]">At {workspace.bpm} BPM, 4 bars in 4/4 are approximately {Math.round(960 / workspace.bpm)} seconds.</p> : null}
          </section>
          <section className={panel}>
            <p className="text-xs uppercase tracking-widest text-white/50">Project safety</p>
            <h2 className="mt-2 text-lg font-semibold">Private work in progress</h2>
            <p className="mt-2 text-xs leading-6 text-white/60">Lyrics autosave to your BVS account. Vocal takes are stored only in this browser, not yet synced to the cloud. Export or back up anything important before clearing browser data or changing devices.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
