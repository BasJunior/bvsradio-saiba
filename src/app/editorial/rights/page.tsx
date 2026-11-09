"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { CLEARANCE_BASES, societySearchLinks } from "@/lib/rights-declarations";

type Row = { id: string; title: string; artist: string; linkedCreator: boolean; societyStatus: string; societyName: string | null; grantAccepted: boolean; spotCheck: string | null; spotCheckNote: string | null; clearance: string | null; clearanceReference: string | null; cleared: boolean };
type Payload = { available: boolean; enforcing: boolean; tracks: Row[]; countries: Array<{ country: string; plays: number }> };
type Filter = "all" | "unanswered" | "society" | "cleared";

const FILTERS: Array<[Filter, string]> = [["all", "All"], ["unanswered", "No answer yet"], ["society", "Society or unsure"], ["cleared", "Cleared"]];
const STATUS: Record<string, string> = { none: "Not in a society", member: "Society member", unsure: "Not sure", not_declared: "No answer yet" };

async function token() {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token || "";
}

function ClearanceControl({ row, onSave }: { row: Row; onSave: (trackId: string, clearance: string, reference: string) => Promise<void> }) {
  const [basis, setBasis] = useState<string>(CLEARANCE_BASES[0][0]);
  const [reference, setReference] = useState("");
  const label = CLEARANCE_BASES.find(([value]) => value === row.clearance)?.[1];
  if (row.clearance) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <p className="text-text-secondary">{label || row.clearance}{row.clearanceReference ? ` · ${row.clearanceReference}` : ""}</p>
        <button type="button" onClick={() => void onSave(row.id, "remove", "")} className="min-h-11 rounded-full border border-white/10 px-4 text-text-secondary">Remove</button>
      </div>
    );
  }
  return (
    <details className="mt-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-2 text-text-secondary">Consent or licence on file</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        <select aria-label="What is on file" value={basis} onChange={(event) => setBasis(event.target.value)} className="min-h-11 rounded-xl border border-white/15 bg-black/30 px-3">
          {CLEARANCE_BASES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
        <input aria-label="Where it is kept" value={reference} maxLength={300} onChange={(event) => setReference(event.target.value)} placeholder="Where it’s kept, e.g. GEMA letter in Rights folder" className="min-h-11 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 sm:min-w-72" />
        <button type="button" disabled={!reference.trim()} onClick={() => void onSave(row.id, basis, reference)} className="min-h-11 rounded-full border border-brand px-4 text-brand disabled:opacity-40">Save</button>
      </div>
      {!row.grantAccepted ? <p className="mt-2 text-xs text-amber-200">The artist still needs to confirm this music in Studio before it counts as cleared.</p> : null}
    </details>
  );
}

export default function EditorialRightsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("unanswered");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/editorial/rights", { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Rights data could not load.");
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rights data could not load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const record = async (trackId: string, result: string) => {
    setNotice("");
    const response = await fetch("/api/admin/editorial/rights", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ trackId, result }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(payload.error || "The spot check could not be saved."); return; }
    setNotice("Spot check saved.");
    await load();
  };

  const saveClearance = async (trackId: string, clearance: string, reference: string) => {
    setNotice("");
    const response = await fetch("/api/admin/editorial/rights", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ trackId, clearance, reference }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(payload.error || "That could not be saved."); return; }
    setNotice(clearance === "remove" ? "Removed." : "Saved.");
    await load();
  };

  const openSearch = async (title: string, link: ReturnType<typeof societySearchLinks>[number]) => {
    if (link.copyFirst) await navigator.clipboard.writeText(title).catch(() => null);
    window.open(link.href, "_blank", "noopener,noreferrer");
  };

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.tracks || []).filter((row) => {
      const inView = filter === "all" || (filter === "unanswered" && row.societyStatus === "not_declared") || (filter === "society" && ["member", "unsure"].includes(row.societyStatus)) || (filter === "cleared" && row.cleared);
      return inView && (!needle || `${row.title} ${row.artist}`.toLowerCase().includes(needle));
    });
  }, [data, filter, search]);

  const tally = useMemo(() => {
    const tracks = data?.tracks || [];
    return {
      total: tracks.length,
      answered: tracks.filter((row) => row.societyStatus !== "not_declared").length,
      society: tracks.filter((row) => ["member", "unsure"].includes(row.societyStatus)).length,
      unreachable: tracks.filter((row) => row.societyStatus === "not_declared" && !row.linkedCreator).length,
      found: tracks.filter((row) => row.spotCheck === "found").length,
    };
  }, [data]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[.18em] text-brand">Music rights</p>
      <h1 className="mt-2 text-4xl font-semibold">Rotation rights check</h1>
      <p className="mt-2 max-w-3xl text-text-secondary">See who has answered the society question. Search opens the society’s own site; a title is copied for sites that need it pasted. A search with no match doesn’t prove a song is clear.</p>

      {error ? (
        <div role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-5">
          <p className="font-semibold">Rights data did not load</p>
          <p className="mt-1 text-sm text-text-secondary">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-3 min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">Retry</button>
        </div>
      ) : null}
      {data && !data.available ? <p role="status" className="mt-6 rounded-xl border border-amber-300/30 p-4 text-sm text-amber-100">The rights tables aren’t set up yet, so answers can’t be saved or shown until the migration is applied.</p> : null}
      {data ? <p role="status" className="mt-6 text-sm text-text-secondary">{data.enforcing ? "Enforcement is on: only cleared tracks play in rotation." : "Enforcement is off: this list doesn’t change what plays."}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-brand">{notice}</p> : null}
      {data ? (
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Artists answered", `${tally.answered} of ${tally.total}`], ["Society or unsure", tally.society], ["Found by our search", tally.found], ["No account to ask", tally.unreachable]].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-text-secondary">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>
          ))}
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-full border px-4 text-sm ${filter === value ? "border-brand bg-brand/10 text-brand" : "border-white/10 text-text-secondary"}`}>{label}</button>)}
        <input type="search" aria-label="Search rotation tracks" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or artist" className="min-h-11 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-sm sm:min-w-64 sm:flex-none" />
      </div>
      {data ? <p role="status" className="mt-4 text-xs text-text-secondary">{rows.length} of {data.tracks.length} rotation tracks</p> : null}

      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{row.title}</h2>
                <p className="text-sm text-text-secondary">{row.artist}{row.linkedCreator ? "" : " · no linked creator"}</p>
                <p className="mt-1 text-xs text-text-secondary">{STATUS[row.societyStatus] || row.societyStatus}{row.societyName ? ` · ${row.societyName}` : ""}{row.grantAccepted ? " · grant signed" : " · no grant"}{row.spotCheck ? ` · spot check: ${row.spotCheck}` : ""}</p>
              </div>
              <span className={`text-xs font-semibold ${row.cleared ? "text-brand" : "text-amber-200"}`}>{row.cleared ? "Cleared" : "Not cleared"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {societySearchLinks(row.title).map((link) => <button key={link.label} type="button" onClick={() => void openSearch(row.title, link)} className="min-h-11 rounded-full border border-white/15 px-4 text-sm">Search {link.label} ↗</button>)}
              {[["clear", "No match"], ["found", "Found in society"], ["unclear", "Unclear"]].map(([result, label]) => <button key={result} type="button" onClick={() => void record(row.id, result)} className={`min-h-11 rounded-full border px-4 text-sm ${row.spotCheck === result ? "border-brand text-brand" : "border-white/10 text-text-secondary"}`}>{label}</button>)}
            </div>
            <ClearanceControl row={row} onSave={saveClearance} />
          </li>
        ))}
      </ul>
      {data && !rows.length ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">No tracks in this view.</p> : null}

      {data ? (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Plays by country, last 30 days</h2>
          {data.countries.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-3">{data.countries.slice(0, 18).map((row) => <li key={row.country} className="flex justify-between rounded-xl border border-white/10 p-3 text-sm"><span>{row.country}</span><span className="text-text-secondary">{row.plays}</span></li>)}</ul> : <p className="mt-3 text-sm text-text-secondary">No country data yet.</p>}
        </section>
      ) : null}
    </main>
  );
}
