"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Check = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

type Payload = {
  role: string;
  deployment?: Record<string, string | null>;
  schema?: {
    expectedPacks: Array<{ id: string; file: string; checksum: string }>;
    appliedVersion: string | null;
    appliedChecksum: string | null;
  };
  features: Record<string, boolean | string>;
  featureDetails?: {
    runtime: {
      effective: string;
      productionLocked: boolean;
      raw: Record<string, string | null>;
    };
    flags: Record<
      string,
      {
        raw: string | null;
        envName: string;
        publicEnvName: string;
        effective: boolean;
      }
    >;
  };
  checks: Check[];
  serviceOnlyTables?: Array<{
    table: string;
    classification: string;
    detail: string;
  }>;
  liveOps?: {
    ingest: Record<string, string | number | boolean | null>;
  };
  growthFunnel?: Record<string, number | null>;
  e2eMatrix?: Array<{
    id: string;
    label: string;
    stages: Array<{
      name: string;
      status: "not_run" | "pass" | "fail";
      detail: string;
    }>;
  }>;
  queues: Record<string, number | null>;
};

const statusClass: Record<Check["status"], string> = {
  pass: "border-emerald-300/30 text-emerald-100",
  warn: "border-amber-300/30 text-amber-100",
  fail: "border-red-300/30 text-red-100",
};

export default function BetaQaPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      queueMicrotask(() => setError("Supabase client is not configured."));
      return;
    }
    void createClient()
      .auth.getSession()
      .then(async ({ data: sessionData }) => {
        const token = sessionData.session?.access_token || "";
        const response = await fetch("/api/beta/qa", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "QA unavailable.");
        setData(payload);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "QA unavailable."),
      );
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 rounded-xl border border-amber-300/40 bg-amber-300/10 p-5 text-amber-100">
        <p className="text-sm font-semibold uppercase tracking-[.18em]">
          BETA / TEST MONEY / TEST BROADCAST
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          This cockpit is for staging operations only. Production remains locked
          while the Apple review line is isolated.
        </p>
      </div>
      <Link href="/editorial" className="text-brand">
        ← Editorial
      </Link>
      <p className="mt-5 text-xs uppercase tracking-[.2em] text-brand">
        Beta launch QA
      </p>
      <h1 className="mt-2 text-4xl font-semibold">
        Staging readiness cockpit
      </h1>
      <p className="mt-3 max-w-3xl text-text-secondary">
        Internal checks for beta-only marketplace, services, uploads, payments
        and BVS Live work before anything is considered for production.
      </p>

      {error ? (
        <p className="mt-6 rounded-xl border border-red-300/30 p-4 text-red-100">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            {data.checks.map((check) => (
              <article
                key={check.id}
                className={`rounded-xl border p-5 ${statusClass[check.status]}`}
              >
                <p className="text-xs uppercase tracking-[.16em]">
                  {check.status}
                </p>
                <h2 className="mt-2 font-semibold text-white">
                  {check.label}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {check.detail}
                </p>
              </article>
            ))}
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Deployment Identity</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(data.deployment || {}).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                    {key}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs">
                    {value || "not configured"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Schema Version</h2>
            <div className="mt-4 rounded-xl border border-white/10 p-5">
              <p className="text-sm text-text-secondary">
                Applied: {data.schema?.appliedVersion || "not reported"} ·{" "}
                checksum {data.schema?.appliedChecksum || "not reported"}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(data.schema?.expectedPacks || []).map((pack) => (
                  <div key={pack.id} className="rounded-lg border border-white/10 p-3">
                    <p className="font-mono text-xs">{pack.id}</p>
                    <p className="mt-1 text-xs text-text-secondary">{pack.file}</p>
                    <p className="mt-1 break-all text-[11px] text-text-secondary">
                      {pack.checksum}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Queues</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(data.queues).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl border border-white/10 p-4"
                >
                  <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                    {key.replace(/([A-Z])/g, " $1")}
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {value == null ? "?" : value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Feature Flags</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(data.featureDetails?.flags || data.features).map(([key, value]) => {
                const detail =
                  typeof value === "object" && value && "effective" in value
                    ? (value as {
                        raw: string | null;
                        envName: string;
                        publicEnvName: string;
                        effective: boolean;
                      })
                    : null;
                return (
                <div
                  key={key}
                  className="rounded-xl border border-white/10 p-4"
                >
                  <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                    {key}
                  </p>
                  {detail ? (
                    <>
                      <p className="mt-2 text-sm text-text-secondary">
                        Raw: {detail.raw ?? "not configured"}
                      </p>
                      <p className="mt-1 font-semibold">
                        Effective: {String(detail.effective)}
                      </p>
                      <p className="mt-2 break-all text-[11px] text-text-secondary">
                        {detail.envName} / {detail.publicEnvName}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 font-semibold">{String(value)}</p>
                  )}
                </div>
              )})}
            </div>
          </section>

          {data.featureDetails?.runtime ? (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold">Runtime Detection</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                    Effective
                  </p>
                  <p className="mt-2 font-semibold">
                    {data.featureDetails.runtime.effective}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Production locked:{" "}
                    {String(data.featureDetails.runtime.productionLocked)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                    Raw env hints
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-text-secondary">
                    {Object.entries(data.featureDetails.runtime.raw).map(
                      ([key, value]) => (
                        <p key={key} className="break-all">
                          {key}: {value ?? "not configured"}
                        </p>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">BVS Live Ops</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(data.liveOps?.ingest || {}).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                    {key}
                  </p>
                  <p className="mt-2 break-all text-sm">
                    {value == null ? "not seen" : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Premium Growth Funnel</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(data.growthFunnel || {}).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                    {key.replace(/([A-Z])/g, " $1")}
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {value == null ? "n/a" : value}
                    {key.includes("Percent") && value != null ? "%" : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">Service-Only Tables</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(data.serviceOnlyTables || []).map((item) => (
                <div key={item.table} className="rounded-xl border border-white/10 p-4">
                  <p className="font-mono text-sm">{item.table}</p>
                  <p className="mt-2 text-sm text-brand">{item.classification}</p>
                  <p className="mt-1 text-xs text-text-secondary">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold">E2E Beta Matrix</h2>
            <div className="mt-4 grid gap-4">
              {(data.e2eMatrix || []).map((flow) => (
                <article key={flow.id} className="rounded-xl border border-white/10 p-5">
                  <h3 className="font-semibold">{flow.label}</h3>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {flow.stages.map((stage) => (
                      <div key={stage.name} className="rounded-lg border border-white/10 p-3">
                        <p className="text-sm font-medium">{stage.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[.12em] text-text-secondary">
                          {stage.status}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">{stage.detail}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-4 md:grid-cols-2">
            <Link
              href="/editorial/marketplace"
              className="rounded-xl border border-brand/30 p-5 text-brand"
            >
              Marketplace moderation →
            </Link>
            <Link
              href="/creator/studio#marketplace-desk"
              className="rounded-xl border border-brand/30 p-5 text-brand"
            >
              Creator marketplace desk →
            </Link>
          </section>
        </>
      ) : null}
    </main>
  );
}
