"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Profile = { id: string; username: string | null; displayName: string; avatarUrl: string | null };
type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
  reviewedAt: string | null;
  reporter: Profile;
  reported: Profile | null;
  reviewOwner: Profile | null;
  thread: { id: string; thread_type: string; author_user_id?: string | null; object_owner_user_id?: string | null; object_title?: string | null; status: string } | null;
  message: { id: string; thread_id: string; author_user_id?: string | null; body: string; status: string; message_kind: string } | null;
};

type Action = "review" | "hide" | "restore" | "lock" | "unlock" | "delete" | "resolve_report" | "dismiss_report";

function age(iso: string) {
  const minutes = Math.floor(Math.max(0, Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export default function ParticipationModerationPage() {
  const configured = isSupabaseConfigured();
  const [token, setToken] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"active" | "closed">("active");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState(configured ? "" : "Supabase is not configured.");

  const load = useCallback(async (accessToken: string, mode: "active" | "closed") => {
    const status = mode === "active" ? "open,reviewing" : "resolved,dismissed";
    const response = await fetch(`/api/admin/participation/moderation?status=${status}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { reports?: Report[]; error?: string } : {};
    if (!response?.ok) throw new Error(payload.error || "Could not load participation reports.");
    setReports(payload.reports || []);
  }, []);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    void createClient().auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const accessToken = data.session?.access_token || "";
      setToken(accessToken);
      if (!accessToken) {
        setLoading(false);
        setError("Sign in with an editorial/admin account to review participation reports.");
        return;
      }
      try {
        await load(accessToken, filter);
        if (active) setError("");
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load reports.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [configured, filter, load]);

  const counts = useMemo(() => ({
    open: reports.filter((report) => report.status === "open").length,
    reviewing: reports.filter((report) => report.status === "reviewing").length,
  }), [reports]);

  async function act(report: Report, action: Action) {
    if (!token || busy) return;
    const note = String(notes[report.id] || "").trim();
    if (action !== "review" && !note) {
      setError("Add a moderation note before taking a content or report action.");
      return;
    }
    setBusy(`${report.id}:${action}`);
    setError("");
    const response = await fetch("/api/admin/participation/moderation", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: report.id, action, reason: note }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { error?: string } : {};
    if (!response?.ok) {
      setError(payload.error || "Moderation action failed.");
      setBusy("");
      return;
    }
    try {
      await load(token, filter);
      setNotes((current) => ({ ...current, [report.id]: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action saved, but the queue could not refresh.");
    }
    setBusy("");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#ff9a92]">BVS Safety</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Participation moderation</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/42">Reports, conversation controls and immutable staff audit actions for the public BVS participation layer.</p>
        </div>
        <Link href="/admin/editorial" className="min-h-10 rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white">← Editorial</Link>
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter("active")} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${filter === "active" ? "border-[#ff9a92]/45 bg-[#ff7a70]/10 text-[#ffb0aa]" : "border-white/10 text-white/45"}`}>Active queue {filter === "active" ? `· ${reports.length}` : ""}</button>
        <button type="button" onClick={() => setFilter("closed")} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${filter === "closed" ? "border-[#78e6bb]/40 bg-[#58d6a7]/8 text-[#78e6bb]" : "border-white/10 text-white/45"}`}>Resolved history</button>
        {filter === "active" ? <span className="self-center text-xs text-white/30">{counts.open} open · {counts.reviewing} reviewing</span> : null}
      </div>

      {error ? <p className="mt-5 rounded-2xl border border-[#ff7a70]/20 bg-[#ff7a70]/[.055] p-4 text-sm text-[#ffb0aa]">{error}</p> : null}
      {loading ? <div className="mt-7 h-44 animate-pulse rounded-[1.7rem] bg-white/[.035]" /> : null}

      <div className="mt-7 space-y-4">
        {!loading && reports.map((report) => (
          <article key={report.id} className="rounded-[1.6rem] border border-white/[.08] bg-white/[.022] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em] ${report.status === "open" ? "border-[#ff7a70]/30 text-[#ff9a92]" : report.status === "reviewing" ? "border-[#929DE0]/30 text-[#c2c9ff]" : "border-[#58d6a7]/25 text-[#78e6bb]"}`}>{report.status}</span>
                  <span className="text-xs text-white/28">{age(report.createdAt)}</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold capitalize">{report.reason.replaceAll("_", " ")}</h2>
                {report.details ? <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-white/48">{report.details}</p> : null}
              </div>
              <div className="text-right text-xs text-white/35">
                <p>Reported by {report.reporter.displayName}</p>
                {report.reported ? <p className="mt-1">Account: {report.reported.displayName}</p> : null}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/[.06] bg-black/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/30">Reported content</p>
              {report.message ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">{report.message.body}</p> : <p className="mt-2 text-sm text-white/55">{report.thread?.object_title || `${report.thread?.thread_type || "Conversation"} thread`}</p>}
              <p className="mt-2 text-[11px] text-white/28">Thread {report.thread?.status || "unknown"}{report.message ? ` · message ${report.message.status}` : ""}</p>
            </div>

            {filter === "active" ? <>
              <textarea value={notes[report.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value.slice(0, 500) }))} rows={2} placeholder="Moderation note (required for content/closure actions)" className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-[#929DE0]/45" />
              <div className="mt-3 flex flex-wrap gap-2">
                {report.status === "open" ? <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, "review")} className="min-h-9 rounded-full border border-[#929DE0]/30 px-3 text-xs font-semibold text-[#c2c9ff] disabled:opacity-40">Claim review</button> : null}
                <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, "hide")} className="min-h-9 rounded-full border border-[#ff7a70]/25 px-3 text-xs font-semibold text-[#ff9a92] disabled:opacity-40">Hide content</button>
                {report.thread?.status === "locked" ? <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, "unlock")} className="min-h-9 rounded-full border border-white/12 px-3 text-xs text-white/55 disabled:opacity-40">Unlock thread</button> : <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, "lock")} className="min-h-9 rounded-full border border-white/12 px-3 text-xs text-white/55 disabled:opacity-40">Lock thread</button>}
                <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, "delete")} className="min-h-9 rounded-full border border-[#ff7a70]/25 px-3 text-xs text-[#ff9a92] disabled:opacity-40">Delete</button>
                <span className="grow" />
                <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, "dismiss_report")} className="min-h-9 rounded-full border border-white/10 px-3 text-xs text-white/48 disabled:opacity-40">Dismiss report</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void act(report, "resolve_report")} className="min-h-9 rounded-full bg-[#58d6a7] px-4 text-xs font-bold text-black disabled:opacity-40">Resolve</button>
              </div>
            </> : null}
          </article>
        ))}
      </div>

      {!loading && !reports.length && !error ? <div className="mt-8 rounded-[1.5rem] border border-dashed border-white/12 p-10 text-center"><h2 className="text-xl font-semibold">Queue clear.</h2><p className="mt-2 text-sm text-white/38">No reports match this view.</p></div> : null}
    </main>
  );
}
