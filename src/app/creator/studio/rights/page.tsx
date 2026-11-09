"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SocietyDeclarationFields, { EMPTY_SOCIETY_DECLARATION, societyDeclarationError } from "@/components/SocietyDeclarationFields";
import { useBrowserSession } from "@/lib/use-browser-session";

type Item = { kind: "release" | "track"; id: string; title: string; trackCount: number; inRotation: boolean; societyStatus: string; societyName: string | null; grantAccepted: boolean };
type Payload = { available: boolean; items: Item[]; needsAnswer: number };

const keyOf = (item: Item) => `${item.kind}:${item.id}`;
const unanswered = (item: Item) => item.societyStatus === "not_declared" || !item.grantAccepted;

function statusLabel(item: Item) {
  if (unanswered(item)) return "Needs your answer";
  if (item.societyStatus === "none") return "Answered · not in a society";
  if (item.societyStatus === "member") return `Answered · in a society${item.societyName ? ` (${item.societyName})` : ""}`;
  return "Answered · not sure";
}

export default function StudioRightsPage() {
  const { session, loading } = useBrowserSession();
  const token = session?.access_token || "";
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [declaration, setDeclaration] = useState(EMPTY_SOCIETY_DECLARATION);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch("/api/creator/rights", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Your music could not load.");
      setData(payload);
      setSelected((payload as Payload).items.filter(unanswered).map(keyOf));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your music could not load.");
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]));

  const submit = async () => {
    const problem = societyDeclarationError(declaration);
    if (problem) { setError(problem); return; }
    if (!data) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const items = data.items.filter((item) => selected.includes(keyOf(item))).map(({ kind, id }) => ({ kind, id }));
      const response = await fetch("/api/creator/rights", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items, societyStatus: declaration.status, societyName: declaration.name.trim(), grantAccepted: declaration.grantAccepted }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Your answer could not be saved.");
      setNotice("Thanks, your answer is saved. Nothing about your music changes today. If a society affects how it plays on BVS, we’ll tell you first.");
      setDeclaration(EMPTY_SOCIETY_DECLARATION);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your answer could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const allSelected = Boolean(data?.items.length) && selected.length === data?.items.length;

  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <Link href="/creator/studio" className="inline-flex min-h-11 items-center text-sm text-brand">← Studio</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Studio · Music rights</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Confirm your music</h1>
      <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">Tell us whether anyone who wrote your music belongs to a collecting society, so we know what can play on BVS. Joined one since you posted? Update your answer here.</p>

      {!loading && !session ? <p className="mt-6 rounded-xl border border-white/10 p-4 text-sm"><Link href="/login" className="text-brand underline">Sign in</Link> to confirm your music.</p> : null}
      {error ? <p role="alert" className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm">{error}</p> : null}
      {notice ? <p role="status" className="mt-6 rounded-xl border border-brand/30 bg-brand/10 p-4 text-sm">{notice}</p> : null}
      {data && !data.available ? <p role="status" className="mt-6 rounded-xl border border-amber-300/30 p-4 text-sm text-amber-100">Music confirmations aren’t open yet. You can look through your music, but answers can’t be saved for now.</p> : null}

      {data && !data.items.length ? <p className="mt-8 rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">You don’t have any approved music yet. We’ll ask about societies when you upload.</p> : null}

      {data?.items.length ? (
        <>
          <section className="mt-8" aria-labelledby="your-music">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="your-music" className="text-xl font-semibold">Your music</h2>
              <button type="button" onClick={() => setSelected(allSelected ? [] : data.items.map(keyOf))} className="min-h-11 text-sm text-brand">{allSelected ? "Clear all" : "Select all"}</button>
            </div>
            <ul className="mt-3 space-y-2">
              {data.items.map((item) => (
                <li key={keyOf(item)}>
                  <label className="flex min-h-11 items-start gap-3 rounded-xl border border-white/10 p-3 text-sm">
                    <input type="checkbox" checked={selected.includes(keyOf(item))} onChange={() => toggle(keyOf(item))} className="mt-1 accent-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{item.title}</span>
                      <span className="block text-xs text-text-secondary">{item.kind === "release" ? `Release · ${item.trackCount} ${item.trackCount === 1 ? "track" : "tracks"}` : "Single track"}{item.inRotation ? " · On BVS rotation" : ""}</span>
                      <span className={`mt-1 block text-xs ${unanswered(item) ? "text-amber-200" : "text-brand"}`}>{statusLabel(item)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 space-y-4">
            <p className="text-sm text-text-secondary">Your answer applies to everything ticked above. If some music is different, confirm it separately.</p>
            <SocietyDeclarationFields value={declaration} onChange={setDeclaration} />
            <button type="button" disabled={busy || !selected.length || !data.available} onClick={() => void submit()} className="min-h-11 rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-40">
              {busy ? "Saving…" : `Confirm ${selected.length} ${selected.length === 1 ? "item" : "items"}`}
            </button>
          </section>
        </>
      ) : null}
    </main>
  );
}
