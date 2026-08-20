"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type PackageDraft = { name: string; description: string; priceUsd: string };
type AddonDraft = { name: string; description: string; priceUsd: string };
type Entitlements = {
  planId: string;
  serviceListingLimit: number | null;
  servicePackageLimit: number;
  addonsEnabled: boolean;
};

const serviceCategories = [
  "mixing",
  "mastering",
  "production",
  "songwriting",
  "vocals",
  "vocal_tuning",
  "artwork",
  "podcast_editing",
  "other",
];

const blankPackage = (): PackageDraft => ({ name: "", description: "", priceUsd: "" });
const blankAddon = (): AddonDraft => ({ name: "", description: "", priceUsd: "" });

export default function NewCreatorServicePage() {
  const [token, setToken] = useState("");
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [profileStatus, setProfileStatus] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "mixing",
    description: "",
    basePrice: "",
    turnaroundDays: "7",
    revisionsIncluded: "1",
    rightsConfirmed: false,
  });
  const [packages, setPackages] = useState<PackageDraft[]>([
    { name: "Standard", description: "", priceUsd: "" },
  ]);
  const [addons, setAddons] = useState<AddonDraft[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void createClient().auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token || "";
      setToken(accessToken);
      if (!accessToken) return;
      const response = await fetch("/api/marketplace?scope=mine", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json();
      setEntitlements(payload.entitlements || null);
      setProfileStatus(payload.profile?.status || "");
    });
  }, []);

  const packageLimit = Math.max(1, Number(entitlements?.servicePackageLimit || 1));
  const canAddPackage = packages.length < packageLimit;
  const canUseAddons = Boolean(entitlements?.addonsEnabled);
  const effectiveBasePrice = useMemo(() => {
    const first = Number(packages[0]?.priceUsd || form.basePrice);
    return Number.isFinite(first) && first > 0 ? first : 0;
  }, [packages, form.basePrice]);

  const updatePackage = (index: number, patch: Partial<PackageDraft>) =>
    setPackages((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const updateAddon = (index: number, patch: Partial<AddonDraft>) =>
    setAddons((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  async function submit() {
    if (!token) {
      setMessage("Sign in before creating a creator service.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const cleanPackages = packages
        .map((item) => ({
          name: item.name.trim(),
          description: item.description.trim(),
          priceUsd: Number(item.priceUsd || form.basePrice),
        }))
        .filter((item) => item.name && Number.isFinite(item.priceUsd) && item.priceUsd >= 1);
      if (!cleanPackages.length) throw new Error("Create at least one package with a price of US$1 or more.");
      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "save_listing",
          listingType: "service",
          title: form.title,
          category: form.category,
          description: form.description,
          priceUsd: effectiveBasePrice || cleanPackages[0].priceUsd,
          turnaroundDays: Number(form.turnaroundDays),
          revisionsIncluded: Number(form.revisionsIncluded),
          rightsConfirmed: form.rightsConfirmed,
          packages: cleanPackages,
          addons: canUseAddons
            ? addons
                .map((item) => ({
                  name: item.name.trim(),
                  description: item.description.trim(),
                  priceUsd: Number(item.priceUsd || 0),
                }))
                .filter((item) => item.name)
            : [],
          submit: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not submit service.");
      setMessage("Service sent to Editorial for review.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not submit service.");
    } finally {
      setBusy(false);
    }
  }

  if (!token)
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-semibold">Create a service</h1>
        <p className="mt-4 text-text-secondary">Sign in with your creator account to continue.</p>
        <Link href="/auth/login?next=/creator/marketplace/services/new" className="mt-6 inline-block rounded-full bg-brand px-5 py-2 font-semibold text-black">Sign in</Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/creator/studio#marketplace-desk" className="text-sm text-brand">← Creator Studio</Link>
      <p className="mt-8 text-xs uppercase tracking-[.2em] text-brand">Creator Marketplace</p>
      <h1 className="mt-2 text-4xl font-semibold">Create a professional service</h1>
      <p className="mt-4 max-w-3xl text-text-secondary">Free creators can earn after approval. Role-specific Premium expands listings, packages and selling tools; it never buys Editorial approval or ranking.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-4"><p className="text-xs text-text-secondary">Plan</p><strong className="mt-1 block">{entitlements?.planId?.replaceAll("_", " ") || "service free"}</strong></div>
        <div className="rounded-2xl border border-white/10 p-4"><p className="text-xs text-text-secondary">Service listings</p><strong className="mt-1 block">{entitlements?.serviceListingLimit ?? "fair use"}</strong></div>
        <div className="rounded-2xl border border-white/10 p-4"><p className="text-xs text-text-secondary">Packages per service</p><strong className="mt-1 block">{packageLimit}</strong></div>
      </div>

      {profileStatus !== "approved" ? <p className="mt-6 rounded-2xl border border-amber-400/30 p-4 text-sm text-amber-100">Your Creator Marketplace profile must be approved before a service can be submitted.</p> : null}
      {message ? <p className="mt-6 rounded-2xl border border-brand/30 p-4 text-sm">{message}</p> : null}

      <section className="mt-8 rounded-3xl border border-white/10 p-6">
        <h2 className="text-2xl font-semibold">Service details</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="rounded-xl border border-white/10 bg-black/20 p-3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Service title" />
          <select className="rounded-xl border border-white/10 bg-black/20 p-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{serviceCategories.map((category) => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}</select>
          <input className="rounded-xl border border-white/10 bg-black/20 p-3" type="number" min="1" step=".01" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} placeholder="Starting price USD" />
          <input className="rounded-xl border border-white/10 bg-black/20 p-3" type="number" min="1" max="120" value={form.turnaroundDays} onChange={(e) => setForm({ ...form, turnaroundDays: e.target.value })} placeholder="Turnaround days" />
          <input className="rounded-xl border border-white/10 bg-black/20 p-3" type="number" min="0" max="20" value={form.revisionsIncluded} onChange={(e) => setForm({ ...form, revisionsIncluded: e.target.value })} placeholder="Included revisions" />
          <textarea className="min-h-32 rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe scope, requirements and deliverables" />
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold">Packages</h2><p className="mt-1 text-sm text-text-secondary">Your current plan allows up to {packageLimit} package{packageLimit === 1 ? "" : "s"} per service.</p></div>{canAddPackage ? <button type="button" onClick={() => setPackages((items) => [...items, blankPackage()])} className="rounded-full border border-white/20 px-4 py-2 text-sm">Add package</button> : null}</div>
        <div className="mt-5 space-y-4">{packages.map((item, index) => <div key={index} className="rounded-2xl border border-white/10 p-4"><div className="grid gap-3 md:grid-cols-2"><input className="rounded-xl border border-white/10 bg-black/20 p-3" value={item.name} onChange={(e) => updatePackage(index, { name: e.target.value })} placeholder={`Package ${index + 1} name`} /><input className="rounded-xl border border-white/10 bg-black/20 p-3" type="number" min="1" step=".01" value={item.priceUsd} onChange={(e) => updatePackage(index, { priceUsd: e.target.value })} placeholder="Price USD" /><textarea className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2" value={item.description} onChange={(e) => updatePackage(index, { description: e.target.value })} placeholder="What this package includes" /></div>{packages.length > 1 ? <button type="button" onClick={() => setPackages((items) => items.filter((_, i) => i !== index))} className="mt-3 text-xs text-text-secondary">Remove package</button> : null}</div>)}</div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-semibold">Add-ons</h2><p className="mt-1 text-sm text-text-secondary">{canUseAddons ? "Your plan can attach optional service add-ons." : "Add-ons unlock with an eligible Service / Studio or Producer Premium entitlement."}</p></div>{canUseAddons ? <button type="button" onClick={() => setAddons((items) => [...items, blankAddon()])} className="rounded-full border border-white/20 px-4 py-2 text-sm">Add add-on</button> : null}</div>
        {canUseAddons && addons.length ? <div className="mt-5 space-y-4">{addons.map((item, index) => <div key={index} className="rounded-2xl border border-white/10 p-4"><div className="grid gap-3 md:grid-cols-2"><input className="rounded-xl border border-white/10 bg-black/20 p-3" value={item.name} onChange={(e) => updateAddon(index, { name: e.target.value })} placeholder="Add-on name" /><input className="rounded-xl border border-white/10 bg-black/20 p-3" type="number" min="0" step=".01" value={item.priceUsd} onChange={(e) => updateAddon(index, { priceUsd: e.target.value })} placeholder="Price USD" /><textarea className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2" value={item.description} onChange={(e) => updateAddon(index, { description: e.target.value })} placeholder="Add-on details" /></div><button type="button" onClick={() => setAddons((items) => items.filter((_, i) => i !== index))} className="mt-3 text-xs text-text-secondary">Remove add-on</button></div>)}</div> : null}
      </section>

      <label className="mt-8 flex gap-3 rounded-2xl border border-white/10 p-5 text-sm"><input type="checkbox" checked={form.rightsConfirmed} onChange={(e) => setForm({ ...form, rightsConfirmed: e.target.checked })} />I can provide this service and all profile, portfolio and listing claims are accurate.</label>
      <button type="button" disabled={busy || profileStatus !== "approved"} onClick={() => void submit()} className="mt-6 rounded-full bg-brand px-6 py-3 font-semibold text-black disabled:opacity-40">{busy ? "Submitting…" : "Submit service for review"}</button>
    </main>
  );
}
