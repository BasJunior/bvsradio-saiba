"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Row = Record<string, unknown>;
export default function MarketplaceReview() {
  const [data, setData] = useState<{
      canReview: boolean;
      profiles: Row[];
      listings: Row[];
      serviceOrders: Row[];
    } | null>(null),
    [error, setError] = useState(""),
    [notes, setNotes] = useState<Record<string, string>>({});
  const token = async () => {
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token || "";
  };
  const load = useCallback(async () => {
    const t = await token();
    const r = await fetch("/api/admin/editorial/marketplace", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const p = await r.json();
    if (!r.ok) throw new Error(p.error);
    setData(p);
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load().catch((e) => setError(e.message)));
  }, [load]);
  const act = async (
    entity: string,
    id: string,
    decision: string,
    extra: Record<string, unknown> = {},
  ) => {
    const t = await token();
    const r = await fetch("/api/admin/editorial/marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({
        entity,
        id,
        decision,
        notes: notes[id] || "",
        ...extra,
      }),
    });
    const p = await r.json();
    if (!r.ok) {
      setError(p.error);
      return;
    }
    await load();
  };
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/editorial" className="text-brand">
        ← Editorial
      </Link>
      <p className="mt-5 text-xs uppercase tracking-[.2em] text-brand">
        Creator Marketplace moderation
      </p>
      <h1 className="mt-2 text-4xl">Profiles, listings &amp; claims</h1>
      <p className="mt-3 text-text-secondary">
        Verify identity consistency, rights, evidence, service scope, licence
        clarity and fulfilment before publishing.
      </p>
      {error ? (
        <p className="mt-5 rounded-xl border border-red-400/30 p-4 text-red-200">
          {error}
        </p>
      ) : null}
      <section className="mt-10">
        <h2 className="text-2xl">Creator profiles</h2>
        <div className="mt-4 grid gap-4">
          {data?.profiles.map((row) => {
            const id = String(row.user_id);
            const p = row.profiles as Row | undefined;
            const claims = Array.isArray(row.accomplishments)
              ? (row.accomplishments as Row[])
              : [];
            return (
              <article
                key={id}
                className="rounded-2xl border border-white/10 p-5"
              >
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {String(
                        p?.creator_public_name ||
                          p?.display_name ||
                          p?.username ||
                          id,
                      )}
                    </h3>
                    <p className="text-xs text-brand">
                      {((row.roles as string[]) || []).join(" · ")} ·{" "}
                      {String(row.status)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-text-secondary">
                  {String(row.headline || row.bio || "")}
                </p>
                <p className="mt-2 text-xs text-text-secondary">
                  Experience: {String(row.experience || "not provided")} ·
                  Equipment:{" "}
                  {((row.equipment as string[]) || []).join(", ") ||
                    "not provided"}{" "}
                  · Software:{" "}
                  {((row.software as string[]) || []).join(", ") ||
                    "not provided"}
                </p>
                <div className="mt-3 space-y-2">
                  {claims.map((claim, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-white/10 p-3 text-xs"
                    >
                      <p>
                        {String(claim.title || "Claim")} ·{" "}
                        <span className="text-brand">
                          {String(
                            claim.verification || "self declared",
                          ).replaceAll("_", " ")}
                        </span>
                      </p>
                      {Boolean(claim.evidenceUrl) && (
                        <p className="mt-1 break-all text-text-secondary">
                          Evidence: {String(claim.evidenceUrl)}
                        </p>
                      )}
                      {data.canReview && (
                        <button
                          onClick={() =>
                            void act(
                              "profile",
                              id,
                              claim.verification === "verified"
                                ? "unverify_claim"
                                : "verify_claim",
                              { claimIndex: index },
                            )
                          }
                          className="mt-2 rounded-full border border-white/20 px-3 py-1"
                        >
                          {claim.verification === "verified"
                            ? "Remove verification"
                            : "Mark BVS verified"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <textarea
                  value={notes[id] || ""}
                  onChange={(e) => setNotes({ ...notes, [id]: e.target.value })}
                  placeholder="Review notes / evidence required"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
                />
                {data.canReview ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => void act("profile", id, "approve")}
                      className="rounded-full bg-emerald-400 px-4 py-2 text-xs text-black"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        void act("profile", id, "changes_requested")
                      }
                      className="rounded-full border border-amber-300 px-4 py-2 text-xs"
                    >
                      Request changes
                    </button>
                    <button
                      onClick={() => void act("profile", id, "reject")}
                      className="rounded-full border border-red-300 px-4 py-2 text-xs"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
      <section className="mt-12">
        <h2 className="text-2xl">Service order oversight</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Monitor delivery, revision, cancellation and dispute states. Refunds
          remain controlled through the verified payment-provider and Finance
          reconciliation paths.
        </p>
        <div className="mt-4 grid gap-4">
          {data?.serviceOrders?.length ? (
            data.serviceOrders.map((order) => (
              <article
                key={String(order.id)}
                className="rounded-2xl border border-white/10 p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-semibold">
                    {String(order.title_snapshot)}
                  </h3>
                  <span className="text-brand">
                    {String(order.status).replaceAll("_", " ")} · $
                    {Number(order.amount_usd).toFixed(2)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {String(order.order_reference)} · revisions{" "}
                  {Number(order.revisions_used)}/
                  {Number(order.revisions_included)}
                </p>
                <p className="mt-3 text-sm text-text-secondary">
                  {String(order.brief)}
                </p>
                {["disputed", "cancel_requested"].includes(
                  String(order.status),
                ) ? (
                  <p className="mt-3 rounded-xl border border-amber-300/30 p-3 text-xs text-amber-100">
                    Staff attention required. Confirm the provider outcome
                    before changing money in Finance or the payment provider.
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">
              No creator-service orders yet.
            </p>
          )}
        </div>
      </section>
      <section className="mt-12">
        <h2 className="text-2xl">Listings</h2>
        <div className="mt-4 grid gap-4">
          {data?.listings.map((row) => {
            const id = String(row.id);
            return (
              <article
                key={id}
                className="rounded-2xl border border-white/10 p-5"
              >
                <div className="flex justify-between">
                  <h3 className="font-semibold">{String(row.title)}</h3>
                  <span className="text-brand">
                    ${Number(row.price_usd).toFixed(2)} · {String(row.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  {String(row.listing_type).replaceAll("_", " ")} ·{" "}
                  {String(row.category).replaceAll("_", " ")}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  {String(row.description || "")}
                </p>
                <p className="mt-2 text-xs">
                  Rights/claims:{" "}
                  {row.rights_confirmed ? "confirmed" : "missing"} ·
                  Asset/package:{" "}
                  {row.listing_type === "service"
                    ? Array.isArray(row.packages) && row.packages.length
                      ? "present"
                      : "missing"
                    : row.asset_path
                      ? "present"
                      : "missing"}{" "}
                  · Licence/turnaround:{" "}
                  {row.listing_type === "service"
                    ? row.turnaround_days
                      ? `${row.turnaround_days} days`
                      : "missing"
                    : row.licence_summary
                      ? "present"
                      : "missing"}
                </p>
                <textarea
                  value={notes[id] || ""}
                  onChange={(e) => setNotes({ ...notes, [id]: e.target.value })}
                  placeholder="Review notes"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
                />
                {data.canReview ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void act("listing", id, "approve")}
                      className="rounded-full border border-emerald-300 px-4 py-2 text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void act("listing", id, "publish")}
                      className="rounded-full bg-brand px-4 py-2 text-xs text-black"
                    >
                      Publish listing
                    </button>
                    <button
                      onClick={() =>
                        void act("listing", id, "changes_requested")
                      }
                      className="rounded-full border border-amber-300 px-4 py-2 text-xs"
                    >
                      Request changes
                    </button>
                    <button
                      onClick={() => void act("listing", id, "reject")}
                      className="rounded-full border border-red-300 px-4 py-2 text-xs"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
