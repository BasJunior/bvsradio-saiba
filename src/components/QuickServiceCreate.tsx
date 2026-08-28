"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";

const field = "w-full rounded-xl border border-white/10 bg-black/20 p-3 text-base outline-none focus:border-brand";

const services = [
  ["mixing", "Mixing"],
  ["mastering", "Mastering"],
  ["production", "Music production"],
  ["songwriting", "Songwriting"],
  ["vocals", "Vocals"],
  ["vocal_tuning", "Vocal tuning"],
  ["recording", "Recording"],
  ["studio_session", "Studio session"],
  ["artwork", "Artwork"],
  ["podcast_editing", "Podcast editing"],
  ["other", "Other"],
] as const;

function roleForCategory(category: string) {
  if (["mixing", "mastering", "vocal_tuning", "recording", "studio_session", "podcast_editing"].includes(category)) return "engineer";
  if (category === "songwriting") return "songwriter";
  if (category === "vocals") return "vocalist";
  if (category === "artwork") return "designer";
  return "producer";
}

type Mine = {
  profile?: { status?: string } | null;
  entitlements?: { serviceListingLimit?: number | null; servicePackageLimit?: number };
};

export default function QuickServiceCreate() {
  const [token, setToken] = useState("");
  const [mine, setMine] = useState<Mine>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [category, setCategory] = useState("mixing");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("25");
  const [turnaround, setTurnaround] = useState("7");
  const [revisions, setRevisions] = useState("1");
  const [rights, setRights] = useState(false);

  const load = async (accessToken: string) => {
    const response = await fetch("/api/marketplace?scope=mine", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load your seller setup.");
    setMine(payload);
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Account service is unavailable.");
      setLoading(false);
      return;
    }
    void createClient()
      .auth.getSession()
      .then(async ({ data }) => {
        const accessToken = data.session?.access_token || "";
        if (!accessToken) {
          setError("Sign in before offering a service.");
          setLoading(false);
          return;
        }
        setToken(accessToken);
        await load(accessToken);
        setLoading(false);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not open service setup.");
        setLoading(false);
      });
  }, []);

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/marketplace", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not save this service.");
    return payload;
  };

  const submitSimpleProfile = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const selectedLabel = services.find(([value]) => value === category)?.[1] || "Music services";
      await post({
        action: "save_profile",
        roles: [roleForCategory(category)],
        headline: headline.trim() || selectedLabel,
        bio: bio.trim(),
        skills: [category],
        genres: [],
        equipment: [],
        software: [],
        portfolio: [],
        credits: [],
        accomplishments: [],
        submit: true,
      });
      setMessage("Your client-facing profile was sent to BVS for review. Once approved, this page will unlock your service listing form.");
      await load(token);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  const submitService = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const numericPrice = Number(price);
      if (!title.trim()) throw new Error("Give the service a title.");
      if (!Number.isFinite(numericPrice) || numericPrice < 1) throw new Error("Set a price of at least US$1.");
      if (!rights) throw new Error("Confirm that you can deliver and make the claims in this service listing.");
      await post({
        action: "save_listing",
        listingType: "service",
        title: title.trim(),
        category,
        description,
        priceUsd: numericPrice,
        rightsConfirmed: true,
        packages: [{ name: "Standard", description, priceUsd: numericPrice }],
        turnaroundDays: Number(turnaround) || 7,
        revisionsIncluded: Number(revisions) || 0,
        submit: true,
      });
      trackEvent("create_submission_complete", { intent: "service" });
      setMessage("Service sent to BVS for review.");
      setTitle("");
      setDescription("");
      setRights(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit the service.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="py-12 text-center text-text-secondary">Opening service setup…</p>;
  if (error && !token) {
    return (
      <section className="rounded-3xl border border-white/10 p-6 text-center">
        <p className="text-text-secondary">{error}</p>
        <Link href="/auth/login?next=/creator/studio/create/service" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Sign in</Link>
      </section>
    );
  }

  const profileStatus = mine.profile?.status || "new";
  const approved = profileStatus === "approved";

  return (
    <div className="space-y-5">
      {error && <p className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</p>}
      {message && <p className="rounded-2xl border border-brand/25 bg-brand/10 p-4 text-sm text-brand">{message}</p>}

      {!approved ? (
        <form onSubmit={submitSimpleProfile} className="rounded-3xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">One-time setup</p>
          <h2 className="mt-2 text-2xl font-semibold">How should clients see you?</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
            You do not need to build a full marketplace profile now. Give BVS the essentials and we will unlock service listings after review.
          </p>
          {profileStatus !== "new" && (
            <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-text-secondary">Current review status: {profileStatus.replaceAll("_", " ")}</p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-text-secondary">
              Main service
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={`${field} mt-1`}>
                {services.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm text-text-secondary">
              What should clients call you?
              <input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="e.g. Mixing engineer" className={`${field} mt-1`} />
            </label>
            <label className="text-sm text-text-secondary sm:col-span-2">
              Short intro <span className="text-xs">(optional)</span>
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A sentence or two about your work" className={`${field} mt-1 min-h-24`} />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button disabled={busy || profileStatus === "submitted" || profileStatus === "in_review"} className="min-h-11 rounded-full bg-brand px-5 py-2.5 font-semibold text-black disabled:opacity-50">
              {profileStatus === "submitted" || profileStatus === "in_review" ? "Waiting for BVS review" : busy ? "Sending…" : "Send setup to BVS"}
            </button>
            <Link href="/creator/marketplace" className="rounded-full border border-white/15 px-5 py-2.5 text-sm">Advanced profile</Link>
          </div>
        </form>
      ) : (
        <form onSubmit={submitService} className="rounded-3xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Your service</p>
          <h2 className="mt-2 text-2xl font-semibold">What are you offering?</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-text-secondary">Service type<select value={category} onChange={(event) => setCategory(event.target.value)} className={`${field} mt-1`}>{services.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm text-text-secondary">Listing title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Professional vocal mix" className={`${field} mt-1`} required /></label>
            <label className="text-sm text-text-secondary">Price (USD)<input type="number" min="1" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className={`${field} mt-1`} required /></label>
            <label className="text-sm text-text-secondary">Turnaround days<input type="number" min="1" max="120" value={turnaround} onChange={(event) => setTurnaround(event.target.value)} className={`${field} mt-1`} /></label>
            <label className="text-sm text-text-secondary">Revisions included<input type="number" min="0" max="20" value={revisions} onChange={(event) => setRevisions(event.target.value)} className={`${field} mt-1`} /></label>
            <label className="text-sm text-text-secondary sm:col-span-2">What does the client get?<textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${field} mt-1 min-h-28`} placeholder="Describe the deliverable, what you need from the client and what is included." /></label>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-text-secondary">
            <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} className="mt-1.5" />
            <span>I can deliver this service and control the claims, files and work I submit through BVS.</span>
          </label>
          <div className="mt-5 flex flex-wrap gap-3">
            <button disabled={busy} className="min-h-11 rounded-full bg-brand px-5 py-2.5 font-semibold text-black disabled:opacity-50">{busy ? "Sending…" : "Send service to BVS"}</button>
            <Link href="/creator/studio" className="rounded-full border border-white/15 px-5 py-2.5 text-sm">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}
