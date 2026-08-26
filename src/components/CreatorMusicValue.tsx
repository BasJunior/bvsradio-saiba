"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type IncomeEntry = {
  id?: string;
  source_category?: string;
  provider_name?: string;
  net_amount?: number | string;
  gross_amount?: number | string;
  fees_amount?: number | string;
  currency?: string;
  status?: string;
  external_reference?: string | null;
  occurred_at?: string;
};

type IncomePayload = {
  schemaReady?: boolean;
  entries?: IncomeEntry[];
  totals?: {
    bySource?: Record<string, number>;
    byCurrency?: Record<string, number>;
    byStatus?: Record<string, number>;
    usdTotal?: number;
  };
  rights?: {
    totalReleases?: number;
    passportReady?: number;
    fullyDocumented?: number;
    releases?: Array<{
      id: string;
      title: string;
      releaseType?: string;
      preflightStatus?: string;
      passportReady?: boolean;
      completionPercent?: number;
      rightsConfirmed?: boolean;
      masterOwnerRecorded?: boolean;
      compositionOwnersRecorded?: boolean;
      primaryArtistConfirmed?: boolean;
      songwriterConfirmed?: boolean;
      producerConfirmed?: boolean;
    }>;
  };
};

type WalletPayload = {
  sources?: {
    marketplaceEarnings?: number | string;
    radioEarnings?: number | string;
    foundingBonus?: number | string;
    otherCreditsAndAdjustments?: number | string;
  };
};

type SourceKey =
  | "streaming_master"
  | "publishing"
  | "neighbouring_rights"
  | "direct_fan"
  | "beat_licence"
  | "performance"
  | "sync"
  | "studio_service"
  | "other";

const SOURCE_LABELS: Record<SourceKey, string> = {
  streaming_master: "Streaming / master",
  publishing: "Publishing",
  neighbouring_rights: "Neighbouring rights",
  direct_fan: "Direct fan income",
  beat_licence: "Beat licences",
  performance: "Performance",
  sync: "Sync",
  studio_service: "Studio services",
  other: "Other music income",
};

const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS) as Array<[SourceKey, string]>;

function usd(value: number | string | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalisedCsvEntries(text: string) {
  const rows = csvRows(text);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one income row.");
  const headers = rows[0].map((item) => item.toLowerCase().replaceAll(" ", "_"));
  const pick = (record: Record<string, string>, ...keys: string[]) => keys.map((key) => record[key]).find((value) => value != null && value !== "") || "";
  return rows.slice(1).map((values) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    return {
      sourceCategory: pick(record, "source_category", "source"),
      providerName: pick(record, "provider_name", "provider", "service", "payer"),
      netAmount: pick(record, "net_amount", "net", "amount"),
      grossAmount: pick(record, "gross_amount", "gross"),
      feesAmount: pick(record, "fees_amount", "fees"),
      currency: pick(record, "currency") || "USD",
      status: pick(record, "status") || "received",
      externalReference: pick(record, "external_reference", "reference", "transaction_id"),
      periodStart: pick(record, "period_start"),
      periodEnd: pick(record, "period_end"),
      occurredAt: pick(record, "occurred_at", "date"),
      territory: pick(record, "territory", "country"),
      statementName: pick(record, "statement_name", "statement"),
    };
  });
}

export default function CreatorMusicValue({ token, embedded = false }: { token: string; embedded?: boolean }) {
  const [income, setIncome] = useState<IncomePayload | null>(null);
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sourceCategory: "streaming_master" as SourceKey,
    providerName: "",
    netAmount: "",
    currency: "USD",
    status: "received",
    externalReference: "",
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [incomeRes, walletRes] = await Promise.all([
        fetch("/api/creator/income", { headers, cache: "no-store" }),
        fetch("/api/artist/wallet", { headers, cache: "no-store" }),
      ]);
      const [incomeBody, walletBody] = await Promise.all([incomeRes.json(), walletRes.json()]);
      if (!incomeRes.ok) throw new Error(incomeBody.error || "Could not load Rights + Money.");
      if (!walletRes.ok) throw new Error(walletBody.error || "Could not load BVS wallet.");
      setIncome(incomeBody);
      setWallet(walletBody);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Rights + Money.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const external = useMemo(() => income?.entries || [], [income]);
  const externalUsdReceived = useMemo(
    () => external
      .filter((entry) => String(entry.currency || "USD").toUpperCase() === "USD" && ["received", "paid"].includes(String(entry.status || "")))
      .reduce((total, entry) => total + (Number(entry.net_amount) || 0), 0),
    [external],
  );
  const externalUsdTracked = Number(income?.totals?.usdTotal || 0);
  const marketplace = Number(wallet?.sources?.marketplaceEarnings || 0);
  const radio = Number(wallet?.sources?.radioEarnings || 0);
  const receivedMusicValue = externalUsdReceived + marketplace + radio;
  const trackedMusicValue = externalUsdTracked + marketplace + radio;
  const pendingOrReported = Math.max(0, trackedMusicValue - receivedMusicValue);

  const sourceCards = useMemo(() => {
    const totals = income?.totals?.bySource || {};
    return [
      ["Streaming / master", totals.streaming_master || 0],
      ["Publishing", totals.publishing || 0],
      ["Neighbouring rights", totals.neighbouring_rights || 0],
      ["BVS marketplace", marketplace],
      ["BVS Radio", radio],
      ["Direct / licences / services", (totals.direct_fan || 0) + (totals.beat_licence || 0) + (totals.performance || 0) + (totals.sync || 0) + (totals.studio_service || 0)],
    ] as const;
  }, [income, marketplace, radio]);

  async function postEntries(entries: Array<Record<string, unknown>>) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/creator/income", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(entries.length === 1 ? entries[0] : { entries }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not record income.");
      setMessage(entries.length === 1 ? "Income recorded." : `${payload.imported ?? entries.length} income rows imported.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record income.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await postEntries([form]);
    setForm((current) => ({ ...current, providerName: "", netAmount: "", externalReference: "" }));
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const entries = normalisedCsvEntries(await file.text());
      if (entries.length > 250) throw new Error("Import a maximum of 250 rows at a time.");
      await postEntries(entries);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read CSV.");
    }
  }

  if (loading) return <p className="py-8 text-sm text-text-secondary">Loading Rights + Money…</p>;

  return (
    <div className={embedded ? "space-y-7 py-2" : "space-y-8"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Rights + Money</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Your music generated {usd(trackedMusicValue)}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
            One view for music value across BVS and outside partners. BVS keeps the rights record and earnings history; the delivery provider can change without becoming your identity.
          </p>
        </div>
        {!embedded && <Link href="/creator/studio" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand">Back to Studio</Link>}
      </div>

      {error && <p className="rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">{error}</p>}
      {message && <p className="rounded-xl border border-brand/25 bg-brand/10 p-4 text-sm text-brand">{message}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand/25 bg-brand/[.06] p-5">
          <p className="text-xs uppercase tracking-wider text-text-secondary">Tracked music value</p>
          <p className="mt-2 text-3xl font-semibold text-brand">{usd(trackedMusicValue)}</p>
          <p className="mt-2 text-xs text-text-secondary">USD records + BVS marketplace and radio credits.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-wider text-text-secondary">Received / credited</p>
          <p className="mt-2 text-3xl font-semibold">{usd(receivedMusicValue)}</p>
          <p className="mt-2 text-xs text-text-secondary">Money marked received/paid externally plus posted BVS music earnings.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-wider text-text-secondary">Reported / expected</p>
          <p className="mt-2 text-3xl font-semibold">{usd(pendingOrReported)}</p>
          <p className="mt-2 text-xs text-text-secondary">Tracked value not yet marked received or paid.</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Where the value came from</h3>
            <p className="mt-1 text-sm text-text-secondary">Streaming is one line, not the whole music business.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sourceCards.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 p-4">
              <p className="text-xs text-text-secondary">{label}</p>
              <p className="mt-1 text-xl font-semibold">{usd(value)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-white/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Rights Passport coverage</h3>
              <p className="mt-1 text-sm text-text-secondary">The record BVS owns even when the distributor changes.</p>
            </div>
            <span className="rounded-full border border-brand/30 px-3 py-1 text-xs text-brand">
              {income?.rights?.passportReady || 0}/{income?.rights?.totalReleases || 0} release-ready
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {(income?.rights?.releases || []).slice(0, 6).map((release) => (
              <div key={release.id} className="rounded-xl bg-white/[.03] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{release.title}</p>
                    <p className="mt-1 text-xs text-text-secondary capitalize">{release.releaseType} · {String(release.preflightStatus || "not checked").replaceAll("_", " ")}</p>
                  </div>
                  <strong className="text-brand">{release.completionPercent ?? 0}%</strong>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, release.completionPercent || 0)}%` }} />
                </div>
              </div>
            ))}
            {!income?.rights?.totalReleases && (
              <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-text-secondary">No release passport yet. Submit a release in Studio to start the permanent rights record.</p>
            )}
          </div>
          <Link href="/creator/studio#release-path" className="mt-4 inline-flex text-sm font-medium text-brand hover:underline">Open release path →</Link>
        </section>

        <section className="rounded-2xl border border-white/10 p-5">
          <h3 className="text-lg font-semibold">Record outside income</h3>
          <p className="mt-1 text-sm text-text-secondary">Only add money reported or paid outside BVS. Marketplace and BVS Radio income are already counted automatically.</p>
          {!income?.schemaReady ? (
            <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
              External statement storage is not enabled on this environment yet. BVS wallet and Rights Passport data are still available.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <select className="w-full rounded-xl border border-white/10 bg-black/20 p-3" value={form.sourceCategory} onChange={(event) => setForm({ ...form, sourceCategory: event.target.value as SourceKey })}>
                {SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input required className="w-full rounded-xl border border-white/10 bg-black/20 p-3" placeholder="Provider / payer — e.g. Amuse, ZIMURA" value={form.providerName} onChange={(event) => setForm({ ...form, providerName: event.target.value })} />
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <input required inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/20 p-3" placeholder="Net amount" value={form.netAmount} onChange={(event) => setForm({ ...form, netAmount: event.target.value })} />
                <input required maxLength={3} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 uppercase" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="rounded-xl border border-white/10 bg-black/20 p-3" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="received">Received</option>
                  <option value="paid">Paid</option>
                  <option value="reported">Reported</option>
                  <option value="expected">Expected</option>
                </select>
                <input type="date" className="rounded-xl border border-white/10 bg-black/20 p-3" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })} />
              </div>
              <input className="w-full rounded-xl border border-white/10 bg-black/20 p-3" placeholder="Statement / transaction reference (optional)" value={form.externalReference} onChange={(event) => setForm({ ...form, externalReference: event.target.value })} />
              <button disabled={saving} className="w-full rounded-full bg-brand px-5 py-3 font-semibold text-black disabled:opacity-60">{saving ? "Saving…" : "Record income"}</button>
            </form>
          )}
        </section>
      </div>

      {income?.schemaReady && (
        <section className="rounded-2xl border border-white/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Import a statement</h3>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                BVS v1 accepts a normalized CSV so the data stays provider-independent. Required columns: source_category, provider_name, net_amount. Optional: currency, status, date, reference, territory, gross_amount and fees_amount.
              </p>
            </div>
            <label className="cursor-pointer rounded-full border border-brand/40 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/10">
              {saving ? "Importing…" : "Import CSV"}
              <input type="file" accept=".csv,text/csv" className="hidden" disabled={saving} onChange={importCsv} />
            </label>
          </div>
          <p className="mt-3 text-xs text-text-secondary">Raw provider-specific mappings can be added later without changing the BVS ledger. This is deliberate: provider = pipe, BVS = source of truth.</p>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Recent outside income</h3>
            <p className="mt-1 text-sm text-text-secondary">BVS does not infer missing royalties. Only reported records appear here.</p>
          </div>
          <span className="text-xs text-text-secondary">{external.length} record{external.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-4 divide-y divide-white/10">
          {external.slice(0, 12).map((entry) => (
            <div key={entry.id || `${entry.provider_name}-${entry.occurred_at}-${entry.net_amount}`} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{entry.provider_name || "Provider"}</p>
                <p className="truncate text-xs text-text-secondary">{SOURCE_LABELS[(entry.source_category || "other") as SourceKey] || "Other music income"} · {String(entry.status || "received").replaceAll("_", " ")}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{String(entry.currency || "USD").toUpperCase() === "USD" ? usd(entry.net_amount) : `${entry.currency} ${Number(entry.net_amount || 0).toFixed(2)}`}</p>
                {entry.occurred_at && <p className="text-xs text-text-secondary">{new Date(entry.occurred_at).toLocaleDateString()}</p>}
              </div>
            </div>
          ))}
          {!external.length && <p className="py-6 text-sm text-text-secondary">No outside income recorded yet. That is valid — BVS shows zero instead of inventing value.</p>}
        </div>
      </section>

      <p className="text-xs leading-5 text-text-secondary">
        “Music generated” is a tracking total, not a guaranteed payable balance. Currency conversion is not guessed; only USD entries are combined with the USD BVS wallet. Founding/promotional credits are excluded from music-generated value.
      </p>
    </div>
  );
}
