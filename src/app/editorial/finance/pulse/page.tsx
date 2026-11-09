"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { FINANCE_QUARTER_TARGETS, PULSE_LINES, buildPulseNotes, formatPulseValue, summariseLine, type PulseBucket, type PulseEvent, type PulsePeriod, type PulseSnapshot, type PulseStatus, type PulseSummary } from "@/lib/finance-pulse";

type Payload = { generatedAt: string; today: string; quarter: string; snapshot: PulseSnapshot; lines: Record<string, { available: boolean; events: PulseEvent[] }> };

const PERIODS: Array<[PulsePeriod, string, string]> = [[7, "7 days", "in the last 7 days"], [30, "30 days", "in the last 30 days"], [90, "90 days", "in the last 90 days"], ["all", "All time", "since launch"]];
const GROUPS: Array<["money" | "creators" | "audience", string, string]> = [["money", "Money", "What people pay for, and where they stop"], ["creators", "Creators", "The supply that everything else depends on"], ["audience", "Audience", "Whether people are showing up"]];
const STATUS: Record<PulseStatus, { icon: string; label: string; className: string }> = {
  growing: { icon: "▲", label: "Growing", className: "text-brand" },
  new: { icon: "✦", label: "New activity", className: "text-brand" },
  steady: { icon: "→", label: "Steady", className: "text-text-secondary" },
  attention: { icon: "▼", label: "Needs attention", className: "text-amber-200" },
  quiet: { icon: "○", label: "No activity", className: "text-text-secondary" },
  thin: { icon: "·", label: "Too little data", className: "text-text-secondary" },
  all_time: { icon: "", label: "Since launch", className: "text-text-secondary" },
};

async function token() {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token || "";
}

function StatusLabel({ status }: { status: PulseStatus }) {
  const item = STATUS[status];
  return <span className={`text-xs font-semibold ${item.className}`}>{item.icon ? <span aria-hidden="true">{item.icon} </span> : null}{item.label}</span>;
}

function Bars({ buckets, unit, height, onHover }: { buckets: PulseBucket[]; unit: PulseSummary["line"]["unit"]; height: number; onHover?: (bucket: PulseBucket | null) => void }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));
  return (
    <div className="flex items-end" style={{ height, gap: buckets.length > 40 ? 1 : 2 }} onMouseLeave={() => onHover?.(null)}>
      {buckets.map((bucket) => (
        <div key={bucket.key} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => onHover?.(bucket)} onClick={() => onHover?.(bucket)} title={onHover ? undefined : `${bucket.label}: ${formatPulseValue(bucket.value, unit)}`}>
          <div className={`w-full ${bucket.value ? "bg-brand" : "bg-white/10"}`} style={{ height: bucket.value ? `${Math.max(4, (bucket.value / max) * 100)}%` : 2, borderRadius: "4px 4px 0 0" }} />
        </div>
      ))}
    </div>
  );
}

function Goal({ label, value, target, unit }: { label: string; value: number; target: number; unit: "money" | "count" }) {
  const share = Math.min(100, (value / target) * 100);
  return (
    <div>
      <div className="flex justify-between gap-3 text-sm"><span>{label}</span><span className="text-text-secondary">{formatPulseValue(value, unit)} of {formatPulseValue(target, unit)}</span></div>
      <div className="mt-1.5 h-2 rounded-full bg-white/10" role="img" aria-label={`${label}: ${Math.round(share)}% of goal`}><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(share, 1)}%` }} /></div>
    </div>
  );
}

export default function BusinessPulsePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<PulsePeriod>(30);
  const [selected, setSelected] = useState("unfinished");
  const [hover, setHover] = useState<PulseBucket | null>(null);
  const [showTable, setShowTable] = useState(false);
  const detailRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/editorial/finance/pulse", { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The business pulse could not load.");
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The business pulse could not load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const periodLabel = PERIODS.find(([value]) => value === period)?.[2] || "";
  const summaries = useMemo(() => (data ? PULSE_LINES.map((line) => summariseLine(line, data.lines[line.id]?.events || [], period, data.today)) : []), [data, period]);
  const notes = useMemo(() => (data ? buildPulseNotes(summaries, data.snapshot, periodLabel) : { attention: [], growing: [] }), [data, summaries, periodLabel]);
  const active = summaries.find((summary) => summary.line.id === selected);
  const target = data ? FINANCE_QUARTER_TARGETS.find((item) => item.quarter === data.quarter) : null;
  const monthSales = useMemo(() => {
    if (!data) return 0;
    const month = data.today.slice(0, 7);
    return ["music", "beats", "products", "services"].reduce((sum, id) => sum + (data.lines[id]?.events || []).filter((event) => event[0].startsWith(month)).reduce((total, event) => total + event[2], 0), 0);
  }, [data]);
  const newsletterTotal = data?.lines.newsletter?.events.reduce((sum, event) => sum + event[1], 0) || 0;

  const open = (id: string) => {
    setSelected(id);
    setHover(null);
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  };

  const comparison = active?.previous === null || !active ? "No earlier period to compare" : active.changePct === null ? `Previous period: ${formatPulseValue(active.previous, active.line.unit)}` : `${active.changePct > 0 ? "+" : ""}${active.changePct}% vs previous period (${formatPulseValue(active.previous, active.line.unit)})`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link href="/editorial/finance" className="inline-flex min-h-11 items-center text-sm text-brand">← Editorial Finance</Link>
      <p className="mt-3 text-xs uppercase tracking-[.2em] text-brand">Business pulse</p>
      <h1 className="mt-2 text-4xl font-semibold">What’s growing, and what needs attention</h1>
      <p className="mt-2 max-w-3xl text-text-secondary">Pick a period, then open any part of the business to see the trend and what’s behind it. Sales are before tax and show what customers paid, not BVS’s profit.</p>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Period">
        {PERIODS.map(([value, label]) => <button key={label} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`min-h-11 rounded-full border px-4 text-sm ${period === value ? "border-brand bg-brand/10 text-brand" : "border-white/10 text-text-secondary"}`}>{label}</button>)}
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-full border border-white/10 px-4 text-sm text-text-secondary">Refresh</button>
      </div>

      {error ? <div role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-5"><p className="font-semibold">The pulse did not load</p><p className="mt-1 text-sm text-text-secondary">{error}</p><button type="button" onClick={() => void load()} className="mt-3 min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">Retry</button></div> : null}
      {!data && !error ? <p role="status" className="mt-8 text-sm text-text-secondary">Loading the numbers…</p> : null}

      {data ? (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-semibold">Customer recurring income</h2>
              <p className="mt-2 text-4xl font-semibold">{formatPulseValue(data.snapshot.monthlyRecurring, "money")}<span className="text-base font-normal text-text-secondary"> a month</span></p>
              <p className="mt-2 text-sm text-text-secondary">{data.snapshot.payingMemberships} paying {data.snapshot.payingMemberships === 1 ? "customer" : "customers"}.{data.snapshot.staffPayingMemberships ? ` ${data.snapshot.staffPayingMemberships} staff ${data.snapshot.staffPayingMemberships === 1 ? "account pays" : "accounts pay"} ${formatPulseValue(data.snapshot.staffMonthlyRecurring, "money")} a month, left out here.` : ""} {data.snapshot.nonPayingMemberships} more are benefits, prizes or seeded records and bring in no money.</p>
              <p className="mt-2 text-xs text-text-secondary">Hosting, staff and marketing aren’t recorded yet, so profit can’t be shown.</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-semibold">Needs attention</h2>
              {notes.attention.length ? <ol className="mt-2 space-y-1">{notes.attention.slice(0, 5).map((note) => <li key={note.text}><button type="button" onClick={() => open(note.lineId)} className="min-h-11 w-full py-1 text-left text-sm hover:text-brand">{note.text}</button></li>)}</ol> : <p className="mt-2 text-sm text-text-secondary">Nothing stands out in this period.</p>}
              {data.snapshot.staffTestCheckouts ? <p className="mt-2 text-xs text-text-secondary">{data.snapshot.staffTestCheckouts} staff test checkouts are left out of these numbers.</p> : null}
            </div>
            <div className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-semibold">Growing</h2>
              {notes.growing.length ? <ol className="mt-2 space-y-1">{notes.growing.slice(0, 5).map((note) => <li key={note.text}><button type="button" onClick={() => open(note.lineId)} className="min-h-11 w-full py-1 text-left text-sm hover:text-brand">{note.text}</button></li>)}</ol> : <p className="mt-2 text-sm text-text-secondary">Nothing is clearly growing in this period.</p>}
              {target && target.artists ? <div className="mt-4 space-y-3 border-t border-white/10 pt-4"><p className="text-xs uppercase tracking-[.16em] text-text-secondary">{data.quarter} goals</p><Goal label="Paying customers" value={data.snapshot.payingMemberships} target={target.artists} unit="count" /><Goal label="Sales this month" value={monthSales} target={target.gmv as number} unit="money" /><Goal label="Newsletter" value={newsletterTotal} target={target.newsletter as number} unit="count" /></div> : null}
            </div>
          </section>

          {active ? (
            <section ref={detailRef} aria-labelledby="pulse-detail" className="mt-6 scroll-mt-24 rounded-2xl border border-brand/30 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="pulse-detail" className="text-2xl font-semibold">{active.line.label}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-text-secondary">{active.line.meaning}</p>
                </div>
                <div className="text-right"><p className="text-3xl font-semibold">{formatPulseValue(active.current, active.line.unit)}</p><StatusLabel status={active.status} /><p className="mt-1 text-xs text-text-secondary">{comparison}</p></div>
              </div>
              {data.lines[active.line.id]?.available === false ? <p role="status" className="mt-3 text-sm text-amber-100">This data source isn’t available right now.</p> : null}
              <div className="mt-5 grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div>
                  <p aria-live="polite" className="h-5 text-sm text-text-secondary">{hover ? `${hover.label}: ${formatPulseValue(hover.value, active.line.unit)}` : "Hover or tap a bar for its value"}</p>
                  <div className="mt-2 border-b border-white/20"><Bars buckets={active.buckets} unit={active.line.unit} height={170} onHover={setHover} /></div>
                  <div className="mt-1 flex justify-between text-xs text-text-secondary"><span>{active.buckets[0]?.label}</span><span>{active.buckets.at(-1)?.label}</span></div>
                  <button type="button" aria-expanded={showTable} onClick={() => setShowTable((value) => !value)} className="mt-2 min-h-11 text-sm text-brand">{showTable ? "Hide table" : "Show as table"}</button>
                  {showTable ? <div className="max-h-64 overflow-y-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-text-secondary"><th className="py-1 font-medium">Period</th><th className="py-1 text-right font-medium">Value</th></tr></thead><tbody>{active.buckets.map((bucket) => <tr key={bucket.key} className="border-t border-white/10"><td className="py-1.5">{bucket.label}</td><td className="py-1.5 text-right">{formatPulseValue(bucket.value, active.line.unit)}</td></tr>)}</tbody></table></div> : null}
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Biggest contributors</h3>
                  {active.top.length ? <ul className="mt-2 space-y-2">{active.top.map((row) => <li key={row.label}><div className="flex justify-between gap-3 text-sm"><span className="truncate">{row.label}</span><span className="text-text-secondary">{formatPulseValue(row.value, active.line.unit)}</span></div><div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.max(2, (row.value / active.top[0].value) * 100)}%` }} /></div></li>)}</ul> : <p className="mt-2 text-sm text-text-secondary">Nothing recorded {periodLabel}.</p>}
                  <Link href={active.line.actHref} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand">{active.line.actLabel} →</Link>
                </div>
              </div>
            </section>
          ) : null}

          {GROUPS.map(([group, title, sub]) => (
            <section key={group} className="mt-8">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-sm text-text-secondary">{sub}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summaries.filter((summary) => summary.line.group === group).map((summary) => (
                  <button key={summary.line.id} type="button" aria-pressed={selected === summary.line.id} onClick={() => open(summary.line.id)} className={`rounded-2xl border p-4 text-left ${selected === summary.line.id ? "border-brand" : "border-white/10 hover:border-white/30"}`}>
                    <span className="block text-sm text-text-secondary">{summary.line.label}</span>
                    <span className="mt-1 block text-2xl font-semibold">{formatPulseValue(summary.current, summary.line.unit)}</span>
                    <StatusLabel status={summary.status} />
                    <span className="mt-3 block" aria-hidden="true"><Bars buckets={summary.buckets} unit={summary.line.unit} height={32} /></span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <p className="mt-8 text-xs text-text-secondary">Updated {new Date(data.generatedAt).toLocaleString("en-GB")}. Dates use UTC. Only actual records are counted, and nothing here is estimated.</p>
        </>
      ) : null}
    </main>
  );
}
