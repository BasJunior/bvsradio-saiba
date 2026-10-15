"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Settings = { enabled: boolean; voiceId: string; minGap: number; maxGap: number; hostStopped: boolean; revision: number };
type HostSession = { id: string; name: string; hostName: string; voiceId: string; startsMinute: number; endsMinute: number; revision: number };
type Pronunciation = { artistKey: string; artistName: string; spokenForm: string; status: string; asWritten: boolean; revision: number };
type Segment = {
  id: string; kind: string; status: string; script: string; trackId: string | null; artistName: string | null;
  durationSeconds: number | null; audioKey: string | null; revision: number; error: string | null; voiceId?: string | null;
};
type Item = { id: string; position: number; kind: string; status: string; title: string; artistName: string; skipReason: string | null };
type Desk = { settings: Settings; sessions: HostSession[]; activeSessionId: string; pronunciations: Pronunciation[]; segments: Segment[]; items: Item[]; undelivered: number; onAir: boolean; playoutConfigured: boolean; speechConfigured: boolean };

const VOICES = ["ara", "eve", "leo", "rex", "sal"];

function clockLabel(minute: number) {
  const hour = Math.floor(minute / 60) % 24;
  const rest = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export default function StationHostPage() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [artistName, setArtistName] = useState("");
  const [spokenForm, setSpokenForm] = useState("");
  const [trackId, setTrackId] = useState("");
  const [presenterScript, setPresenterScript] = useState("");
  const [presenterKind, setPresenterKind] = useState<"human_voice" | "guest">("human_voice");
  const token = useCallback(async () => {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    const value = (await createClient().auth.getSession()).data.session?.access_token;
    if (!value) throw new Error("Sign in with a BVS editorial account.");
    return value;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/station-host", {
          headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store", signal: controller.signal,
        });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(body.error || "Could not load the station host.");
        setDesk(body);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Could not load the station host.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [refresh, token]);
  const act = async (values: Record<string, unknown>) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/station-host", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      if (!response.ok && response.status !== 202) throw new Error(body.error || "Could not save.");
      setMessage(body.error || body.speech || "Saved with editorial audit history.");
      setLoading(true); setRefresh((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally { setBusy(false); }
  };
  const upload = async (id: string, file: File, durationSeconds: string) => {
    const form = new FormData();
    form.set("file", file);
    form.set("durationSeconds", durationSeconds);
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/station-host/audio/${id}`, {
        method: "POST", headers: { Authorization: `Bearer ${await token()}` }, body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload failed.");
      setMessage("Presenter audio attached. Approve it before it can air.");
      setLoading(true); setRefresh((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally { setBusy(false); }
  };
  const settings = desk?.settings;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[.2em] text-brand">BVS Editorial · Station host</p>
      <h1 className="mt-2 text-4xl font-semibold">One shared programme.</h1>
      <p className="mt-3 max-w-2xl text-white/60">The host speaks only from approved lines, about every three to five tracks. Music continues if a voice fails. Listeners follow the station; they do not create First Spins.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/admin/signal" className="inline-flex min-h-11 items-center border border-white/15 px-4 text-sm">Signal desk →</Link>
        <button type="button" disabled={busy || loading} onClick={() => { setLoading(true); setError(""); setRefresh((value) => value + 1); }} className="min-h-11 border border-white/15 px-4 text-sm disabled:opacity-40">Refresh desk</button>
      </div>
      {error && <p role="alert" className="mt-5 border border-red-300/30 p-4 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-5 text-sm text-brand">{message}</p>}
      {loading || !settings ? <p className="mt-8 text-white/50">Loading station host…</p> : (
        <>
          <section className="mt-8 border border-white/15 bg-white/[.025] p-5">
            <h2 className="text-xl font-semibold">{settings.hostStopped ? "Host stopped" : settings.enabled ? "Host enabled" : "Host disabled"}</h2>
            <p className="mt-2 text-sm text-white/55">{desk.onAir ? "The programme clock is live." : "No fresh engine heartbeat. Listeners stay on the browser rotation, which cannot prove a First Spin."} {desk.undelivered ? `${desk.undelivered} acknowledgement${desk.undelivered === 1 ? "" : "s"} still waiting.` : "No acknowledgements waiting."}</p>
            <p className="mt-2 text-xs text-white/45">{desk.playoutConfigured ? "Signed playout ingress is configured." : "Playout proof is not configured, so airings cannot become First Spins yet."} {desk.speechConfigured ? "Speech generation is configured." : "Speech key is missing. Grounded scripts can still be saved, but they cannot air without audio."} Gap {settings.minGap}–{settings.maxGap} tracks.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void act({ action: "set_host", enabled: !settings.enabled, stop: null, revision: settings.revision })} className="min-h-11 bg-brand px-4 text-sm font-semibold text-black disabled:opacity-40">{settings.enabled ? "Disable host" : "Enable host"}</button>
              <button type="button" disabled={busy || settings.hostStopped} onClick={() => void act({ action: "set_host", enabled: null, stop: true, revision: settings.revision })} className="min-h-11 border border-red-300/40 px-4 text-sm text-red-100 disabled:opacity-40">Stop host now</button>
              <button type="button" disabled={busy || !settings.hostStopped} onClick={() => void act({ action: "set_host", enabled: null, stop: false, revision: settings.revision })} className="min-h-11 border border-white/20 px-4 text-sm disabled:opacity-40">Resume host</button>
            </div>
          </section>
          <section className="mt-6 border border-white/15 p-5">
            <h2 className="text-xl font-semibold">Host roster</h2>
            <p className="mt-2 text-sm text-white/55">Zimbabwe time. One host stays with a session. New lines are generated for whoever is on the clock, then previewed and approved here. Until that host has an approved line, the station keeps the clips it already has.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(desk.sessions || []).map((session) => (
                <SessionCard key={session.id} session={session} active={session.id === desk.activeSessionId} busy={busy} act={act} />
              ))}
            </div>
          </section>
          <section className="mt-6 border border-white/15 p-5">
            <h2 className="text-xl font-semibold">Pronunciation</h2>
            <p className="mt-2 text-sm text-white/55">Approve how the host says an artist name before that name can air. As written means the display name is already the spoken form.</p>
            <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); const known = desk.pronunciations.find((row) => row.artistName.toLowerCase() === artistName.trim().toLowerCase()); void act({ action: "save_pronunciation", artistName, spokenForm, asWritten: spokenForm.trim() === artistName.trim(), revision: known?.revision || 0 }); }}>
              <input value={artistName} onChange={(event) => setArtistName(event.target.value)} placeholder="Artist name" className="min-h-11 border border-white/15 bg-black/20 px-3 text-sm" />
              <input value={spokenForm} onChange={(event) => setSpokenForm(event.target.value)} placeholder="Spoken form" className="min-h-11 border border-white/15 bg-black/20 px-3 text-sm" />
              <button type="submit" disabled={busy || !artistName.trim() || !spokenForm.trim()} className="min-h-11 bg-brand px-4 text-sm font-semibold text-black disabled:opacity-40">Save pronunciation</button>
            </form>
            <ul className="mt-4 space-y-3">
              {desk.pronunciations.map((row) => (
                <li key={row.artistKey} className="border border-white/10 p-3 text-sm">
                  <p><strong>{row.artistName}</strong> · {row.spokenForm}</p>
                  <p className="text-white/50">{row.status}{row.asWritten ? " · as written" : ""}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void act({ action: "review_pronunciation", artistKey: row.artistKey, decision: "approved", revision: row.revision })} className="min-h-10 border border-white/20 px-3 text-xs">Approve</button>
                    <button type="button" disabled={busy} onClick={() => void act({ action: "review_pronunciation", artistKey: row.artistKey, decision: "rejected", revision: row.revision })} className="min-h-10 border border-white/20 px-3 text-xs">Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-6 border border-white/15 p-5">
            <h2 className="text-xl font-semibold">Host lines</h2>
            <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void act({ action: "generate", trackId }); }}>
              <input value={trackId} onChange={(event) => setTrackId(event.target.value)} placeholder="Rotation track id" className="min-h-11 min-w-72 border border-white/15 bg-black/20 px-3 text-sm" />
              <button type="submit" disabled={busy || !trackId.trim()} className="min-h-11 bg-brand px-4 text-sm font-semibold text-black disabled:opacity-40">Generate line</button>
            </form>
            <div className="mt-6 grid gap-4">
              {desk.segments.map((segment) => <SegmentCard key={`${segment.id}:${segment.revision}`} segment={segment} busy={busy} act={act} upload={upload} token={token} />)}
            </div>
          </section>
          <section className="mt-6 border border-white/15 p-5">
            <h2 className="text-xl font-semibold">Presenter or guest</h2>
            <p className="mt-2 text-sm text-white/55">Same playout clock as the AI host. Upload the finished audio, then approve it. A failed or stopped segment never blocks the next record.</p>
            <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); void act({ action: "save_human", kind: presenterKind, script: presenterScript, trackId: trackId || null }); }}>
              <select value={presenterKind} onChange={(event) => setPresenterKind(event.target.value as "human_voice" | "guest")} className="min-h-11 border border-white/15 bg-black/20 px-3 text-sm">
                <option value="human_voice">Presenter</option>
                <option value="guest">Guest</option>
              </select>
              <textarea value={presenterScript} onChange={(event) => setPresenterScript(event.target.value)} placeholder="What will they say?" className="min-h-24 border border-white/15 bg-black/20 p-3 text-sm" />
              <button type="submit" disabled={busy || presenterScript.trim().length < 2} className="min-h-11 justify-self-start border border-white/20 px-4 text-sm disabled:opacity-40">Save presenter script</button>
            </form>
          </section>
          <section className="mt-6 border border-white/15 p-5">
            <h2 className="text-xl font-semibold">Recent playout</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {desk.items.map((item) => <li key={item.id}>{item.position}. {item.kind} · {item.status} · {item.title}{item.skipReason ? ` · ${item.skipReason}` : ""}</li>)}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function SessionCard({ session, active, busy, act }: {
  session: HostSession; active: boolean; busy: boolean;
  act: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [hostName, setHostName] = useState(session.hostName);
  const [voiceId, setVoiceId] = useState(session.voiceId);
  const voices = VOICES.includes(voiceId) ? VOICES : [voiceId, ...VOICES];
  return (
    <form className="border border-white/10 p-3" onSubmit={(event) => {
      event.preventDefault();
      void act({ action: "set_session_voice", sessionId: session.id, hostName, voiceId, revision: session.revision });
    }}>
      <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-brand">{active ? "On the clock" : "Session"}</p>
      <h3 className="mt-1 font-semibold">{session.name}</h3>
      <p className="text-xs text-white/45">{clockLabel(session.startsMinute)}–{clockLabel(session.endsMinute)}</p>
      <label className="mt-3 block text-xs text-white/55">
        Name listeners see
        <input value={hostName} onChange={(event) => setHostName(event.target.value)} className="mt-1 min-h-10 w-full border border-white/15 bg-black/20 px-2 text-sm" />
      </label>
      <label className="mt-2 block text-xs text-white/55">
        Voice
        <select value={voiceId} onChange={(event) => setVoiceId(event.target.value)} className="mt-1 min-h-10 w-full border border-white/15 bg-black/20 px-2 text-sm">
          {voices.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
        </select>
      </label>
      <button type="submit" disabled={busy || (hostName === session.hostName && voiceId === session.voiceId)} className="mt-3 min-h-10 border border-white/20 px-3 text-xs disabled:opacity-40">Save host</button>
    </form>
  );
}

function SegmentCard({ segment, busy, act, upload, token }: {
  segment: Segment; busy: boolean;
  act: (values: Record<string, unknown>) => Promise<void>;
  upload: (id: string, file: File, durationSeconds: string) => Promise<void>;
  token: () => Promise<string>;
}) {
  const [script, setScript] = useState(segment.script);
  const [duration, setDuration] = useState(segment.durationSeconds ? String(segment.durationSeconds) : "");
  const preview = async () => {
    const response = await fetch(`/api/admin/station-host/audio/${segment.id}`, { headers: { Authorization: `Bearer ${await token()}` } });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    const audio = new Audio(url);
    void audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  };
  return (
    <article className="border border-white/10 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-brand">{segment.kind} · {segment.status}</p>
      <p className="mt-1 text-sm text-white/55">{segment.artistName || "BVS"} {segment.voiceId ? `· ${segment.voiceId}` : ""} {segment.durationSeconds ? `· ${segment.durationSeconds}s` : ""}</p>
      {segment.kind === "ai_voice" ? (
        <textarea value={script} onChange={(event) => setScript(event.target.value)} className="mt-3 min-h-24 w-full border border-white/15 bg-black/20 p-3 text-sm" />
      ) : <p className="mt-3 text-sm">{segment.script}</p>}
      {segment.error && <p className="mt-2 text-xs text-amber-100">{segment.error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {segment.kind === "ai_voice" && <button type="button" disabled={busy || script === segment.script} onClick={() => void act({ action: "save_segment", id: segment.id, script, revision: segment.revision })} className="min-h-10 border border-white/20 px-3 text-xs">Save edit</button>}
        <button type="button" disabled={busy || !segment.audioKey} onClick={() => void preview()} className="min-h-10 border border-white/20 px-3 text-xs">Preview</button>
        <button type="button" disabled={busy || segment.status === "approved"} onClick={() => void act({ action: "set_segment_status", id: segment.id, status: "approved", revision: segment.revision })} className="min-h-10 bg-brand px-3 text-xs font-semibold text-black disabled:opacity-40">Approve</button>
        <button type="button" disabled={busy || segment.status === "disabled"} onClick={() => void act({ action: "set_segment_status", id: segment.id, status: "disabled", revision: segment.revision })} className="min-h-10 border border-white/20 px-3 text-xs">Disable</button>
      </div>
      {segment.kind !== "ai_voice" && segment.status !== "approved" && (
        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("audio");
          const file = input instanceof HTMLInputElement ? input.files?.[0] : null;
          if (file) void upload(segment.id, file, duration);
        }}>
          <input name="audio" type="file" accept="audio/mpeg,audio/wav,audio/mp4,.mp3,.wav,.m4a" className="text-xs" />
          <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Seconds" className="min-h-10 w-24 border border-white/15 bg-black/20 px-2 text-xs" />
          <button type="submit" disabled={busy} className="min-h-10 border border-white/20 px-3 text-xs">Upload audio</button>
        </form>
      )}
    </article>
  );
}
