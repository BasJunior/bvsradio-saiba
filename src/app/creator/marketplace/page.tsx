"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

const roleOptions = [
  "artist",
  "producer",
  "engineer",
  "studio",
  "songwriter",
  "vocalist",
  "designer",
  "label_team",
];
const productCategories = [
  "drum_kit",
  "sample_pack",
  "preset",
  "loop_pack",
  "midi_pack",
  "stems",
  "template",
  "other",
];
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

export default function CreatorMarketplaceDesk({
  accessToken = "",
  embedded = false,
}: { accessToken?: string; embedded?: boolean } = {}) {
  const [token, setToken] = useState(accessToken),
    [message, setMessage] = useState(""),
    [mine, setMine] = useState<{
      profile?: { status?: string };
      listings?: Array<{ id: string; title: string; status: string }>;
      entitlements?: {
        planId: string;
        productListingLimit: number | null;
        serviceListingLimit: number | null;
        servicePackageLimit: number;
      };
    }>({});
  const [profile, setProfile] = useState({
    roles: ["producer"],
    headline: "",
    bio: "",
    experience: "",
    skills: "",
    genres: "",
    equipment: "",
    software: "",
    accomplishment: "",
    evidenceUrl: "",
    portfolioUrl: "",
    credit: "",
  });
  const [listing, setListing] = useState({
    title: "",
    category: "drum_kit",
    description: "",
    priceUsd: "",
    compatibility: "",
    licenceSummary:
      "Commercial use allowed; redistribution or resale of source files prohibited.",
    licenceTerms: "",
    rightsConfirmed: false,
  });
  const [serviceListing, setServiceListing] = useState({
    title: "",
    category: "mixing",
    description: "",
    priceUsd: "",
    packageName: "Standard",
    packageDescription: "",
    turnaroundDays: "7",
    revisionsIncluded: "1",
    rightsConfirmed: false,
  });
  const [asset, setAsset] = useState<File | null>(null),
    [artwork, setArtwork] = useState<File | null>(null);
  const load = async (t: string) => {
    const r = await fetch("/api/marketplace?scope=mine", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    if (r.ok) setMine(await r.json());
  };
  useEffect(() => {
    if (accessToken) {
      setToken(accessToken);
      void load(accessToken);
      return;
    }
    if (!isSupabaseConfigured()) return;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        const t = data.session?.access_token || "";
        setToken(t);
        if (t) void load(t);
      });
  }, [accessToken]);
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const p = await r.json();
    if (!r.ok) throw new Error(p.error || "Marketplace request failed.");
    return p;
  };
  const saveProfile = async (e: FormEvent, submit: boolean) => {
    e.preventDefault();
    setMessage("");
    try {
      await post({
        action: "save_profile",
        roles: profile.roles,
        headline: profile.headline,
        bio: profile.bio,
        experience: profile.experience,
        skills: profile.skills.split(","),
        genres: profile.genres.split(","),
        equipment: profile.equipment.split(","),
        software: profile.software.split(","),
        portfolio: profile.portfolioUrl
          ? [{ title: "Portfolio", url: profile.portfolioUrl }]
          : [],
        credits: profile.credit ? [{ title: profile.credit }] : [],
        accomplishments: profile.accomplishment
          ? [
              {
                title: profile.accomplishment,
                evidenceUrl: profile.evidenceUrl,
              },
            ]
          : [],
        submit,
      });
      setMessage(submit ? "Profile sent to Editorial." : "Draft saved.");
      await load(token);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not save profile.",
      );
    }
  };
  const upload = async (files: Array<{ kind: string; file: File | null }>) => {
    const chosen = files.filter((x): x is { kind: string; file: File } =>
      Boolean(x.file),
    );
    if (!chosen.length) return {} as Record<string, string>;
    const prep = await fetch("/api/marketplace/upload/prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        files: chosen.map((x) => ({
          kind: x.kind,
          name: x.file.name,
          type: x.file.type,
          size: x.file.size,
        })),
      }),
    });
    const payload = await prep.json();
    if (!prep.ok)
      throw new Error(payload.error || "Could not prepare uploads.");
    const paths: Record<string, string> = {};
    for (const slot of payload.slots) {
      const file = chosen.find((x) => x.kind === slot.kind)?.file;
      if (!file) continue;
      const put = await fetch(slot.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": slot.contentType },
        body: file,
      });
      if (!put.ok) throw new Error(`Could not upload ${slot.kind}.`);
      paths[`${slot.kind}Path`] = slot.path;
    }
    return paths;
  };
  const saveListing = async (e: FormEvent, submit: boolean) => {
    e.preventDefault();
    setMessage("");
    try {
      const paths = await upload([
        { kind: "asset", file: asset },
        { kind: "artwork", file: artwork },
      ]);
      await post({
        action: "save_listing",
        listingType: "digital_product",
        ...listing,
        ...paths,
        submit,
      });
      setMessage(
        submit ? "Product sent to Editorial." : "Product draft saved.",
      );
      await load(token);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not save product.",
      );
    }
  };
  const saveService = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      await post({
        action: "save_listing",
        listingType: "service",
        title: serviceListing.title,
        category: serviceListing.category,
        description: serviceListing.description,
        priceUsd: serviceListing.priceUsd,
        rightsConfirmed: serviceListing.rightsConfirmed,
        packages: [
          {
            name: serviceListing.packageName,
            description: serviceListing.packageDescription,
            priceUsd: serviceListing.priceUsd,
          },
        ],
        turnaroundDays: serviceListing.turnaroundDays,
        revisionsIncluded: serviceListing.revisionsIncluded,
        submit: true,
      });
      setMessage("Service sent to Editorial.");
      await load(token);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not save service.",
      );
    }
  };
  if (!token)
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl">Creator Marketplace desk</h1>
        <p className="mt-4 text-text-secondary">
          Sign in to build your creator business profile.
        </p>
        <Link
          href="/auth/login?next=/creator/marketplace"
          className="mt-6 inline-block rounded-full bg-brand px-5 py-2 font-semibold text-black"
        >
          Sign in
        </Link>
      </main>
    );
  const field =
    "w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm";
  return (
    <section className={embedded ? "pt-4" : "mx-auto max-w-5xl px-6 py-12"}>
      <Link href="/marketplace" className="text-sm text-brand">
        View Creator Marketplace →
      </Link>
      <h1
        className={
          embedded
            ? "mt-4 text-2xl font-semibold"
            : "mt-5 text-4xl font-semibold"
        }
      >
        {embedded
          ? "Marketplace profile and listings"
          : "Build your music business on BVS"}
      </h1>
      <p className="mt-3 text-text-secondary">
        One approved profile can represent several professional roles.
        Individual accomplishments are verified separately when evidence is
        available.
      </p>
      {mine.entitlements && (
        <p className="mt-3 text-xs text-brand">
          {mine.entitlements.planId.replaceAll("_", " ")} · product limit{" "}
          {mine.entitlements.productListingLimit ?? "fair use"} · service limit{" "}
          {mine.entitlements.serviceListingLimit ?? "fair use"} ·{" "}
          {mine.entitlements.servicePackageLimit} service package(s)
        </p>
      )}
      {message ? (
        <p className="mt-5 rounded-xl border border-brand/30 p-4 text-sm">
          {message}
        </p>
      ) : null}
      <form
        onSubmit={(e) => void saveProfile(e, true)}
        className="mt-8 rounded-2xl border border-white/10 p-6"
      >
        <div className="flex justify-between">
          <h2 className="text-2xl">Professional creator profile</h2>
          <span className="text-sm text-brand">
            {mine.profile?.status || "new"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {roleOptions.map((role) => (
            <label
              key={role}
              className="rounded-full border border-white/10 px-3 py-2 text-xs"
            >
              <input
                type="checkbox"
                checked={profile.roles.includes(role)}
                onChange={() =>
                  setProfile((v) => ({
                    ...v,
                    roles: v.roles.includes(role)
                      ? v.roles.filter((x) => x !== role)
                      : [...v.roles, role],
                  }))
                }
                className="mr-2"
              />
              {role.replaceAll("_", " ")}
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className={field}
            value={profile.headline}
            onChange={(e) =>
              setProfile({ ...profile, headline: e.target.value })
            }
            placeholder="Professional headline"
          />
          <input
            className={field}
            value={profile.skills}
            onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
            placeholder="Skills, comma separated"
          />
          <input
            className={field}
            value={profile.genres}
            onChange={(e) => setProfile({ ...profile, genres: e.target.value })}
            placeholder="Genres, comma separated"
          />
          <input
            className={field}
            value={profile.equipment}
            onChange={(e) =>
              setProfile({ ...profile, equipment: e.target.value })
            }
            placeholder="Equipment, comma separated"
          />
          <input
            className={field}
            value={profile.software}
            onChange={(e) =>
              setProfile({ ...profile, software: e.target.value })
            }
            placeholder="Software, comma separated"
          />
          <input
            className={field}
            value={profile.portfolioUrl}
            onChange={(e) =>
              setProfile({ ...profile, portfolioUrl: e.target.value })
            }
            placeholder="Portfolio URL"
          />
          <input
            className={field}
            value={profile.credit}
            onChange={(e) => setProfile({ ...profile, credit: e.target.value })}
            placeholder="Credit or collaboration"
          />
          <input
            className={field}
            value={profile.accomplishment}
            onChange={(e) =>
              setProfile({ ...profile, accomplishment: e.target.value })
            }
            placeholder="Accomplishment"
          />
          <input
            className={field}
            value={profile.evidenceUrl}
            onChange={(e) =>
              setProfile({ ...profile, evidenceUrl: e.target.value })
            }
            placeholder="Evidence link for accomplishment"
          />
          <textarea
            className={`${field} md:col-span-2`}
            rows={3}
            value={profile.experience}
            onChange={(e) =>
              setProfile({ ...profile, experience: e.target.value })
            }
            placeholder="Professional experience"
          />
          <textarea
            className={`${field} md:col-span-2`}
            rows={4}
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Biography and creative work"
          />
        </div>
        <button className="mt-4 rounded-full bg-brand px-5 py-2 font-semibold text-black">
          Submit profile for approval
        </button>
      </form>
      <form
        onSubmit={(e) => void saveListing(e, true)}
        className="mt-8 rounded-2xl border border-white/10 p-6"
      >
        <h2 className="text-2xl">Digital product</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Phase 1 supports production assets after your marketplace profile is
          approved. Products stay private until Editorial verifies rights,
          licence and fulfilment.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className={field}
            value={listing.title}
            onChange={(e) => setListing({ ...listing, title: e.target.value })}
            placeholder="Product title"
          />
          <select
            className={field}
            value={listing.category}
            onChange={(e) =>
              setListing({ ...listing, category: e.target.value })
            }
          >
            {productCategories.map((x) => (
              <option key={x} value={x}>
                {x.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <input
            className={field}
            type="number"
            min="1"
            step=".01"
            value={listing.priceUsd}
            onChange={(e) =>
              setListing({ ...listing, priceUsd: e.target.value })
            }
            placeholder="Price USD"
          />
          <input
            className={field}
            value={listing.compatibility}
            onChange={(e) =>
              setListing({ ...listing, compatibility: e.target.value })
            }
            placeholder="Software/version compatibility"
          />
          <textarea
            className={`${field} md:col-span-2`}
            value={listing.description}
            onChange={(e) =>
              setListing({ ...listing, description: e.target.value })
            }
            placeholder="Description"
          />
          <textarea
            className={field}
            value={listing.licenceSummary}
            onChange={(e) =>
              setListing({ ...listing, licenceSummary: e.target.value })
            }
            placeholder="Licence summary"
          />
          <textarea
            className={field}
            value={listing.licenceTerms}
            onChange={(e) =>
              setListing({ ...listing, licenceTerms: e.target.value })
            }
            placeholder="Full licence terms"
          />
          <label className="text-sm text-text-secondary">
            Private product file
            <input
              type="file"
              onChange={(e) => setAsset(e.target.files?.[0] || null)}
              className="mt-2 block"
            />
          </label>
          <label className="text-sm text-text-secondary">
            Artwork
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setArtwork(e.target.files?.[0] || null)}
              className="mt-2 block"
            />
          </label>
        </div>
        <label className="mt-4 flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={listing.rightsConfirmed}
            onChange={(e) =>
              setListing({ ...listing, rightsConfirmed: e.target.checked })
            }
          />
          I own or control the rights and all claims in this listing.
        </label>
        <button className="mt-4 rounded-full bg-brand px-5 py-2 font-semibold text-black">
          Submit product for review
        </button>
      </form>
      <form
        onSubmit={(e) => void saveService(e)}
        className="mt-8 rounded-2xl border border-white/10 p-6"
      >
        <h2 className="text-2xl">Professional service</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Offer a clearly scoped service. Customer payment is held until
          delivery is accepted; cancellations and disputes require review.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className={field}
            value={serviceListing.title}
            onChange={(e) =>
              setServiceListing({ ...serviceListing, title: e.target.value })
            }
            placeholder="Service title"
          />
          <select
            className={field}
            value={serviceListing.category}
            onChange={(e) =>
              setServiceListing({ ...serviceListing, category: e.target.value })
            }
          >
            {serviceCategories.map((x) => (
              <option key={x} value={x}>
                {x.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <input
            className={field}
            value={serviceListing.packageName}
            onChange={(e) =>
              setServiceListing({
                ...serviceListing,
                packageName: e.target.value,
              })
            }
            placeholder="Package name"
          />
          <input
            className={field}
            type="number"
            min="1"
            step=".01"
            value={serviceListing.priceUsd}
            onChange={(e) =>
              setServiceListing({ ...serviceListing, priceUsd: e.target.value })
            }
            placeholder="Price USD"
          />
          <input
            className={field}
            type="number"
            min="1"
            max="120"
            value={serviceListing.turnaroundDays}
            onChange={(e) =>
              setServiceListing({
                ...serviceListing,
                turnaroundDays: e.target.value,
              })
            }
            placeholder="Turnaround days"
          />
          <input
            className={field}
            type="number"
            min="0"
            max="20"
            value={serviceListing.revisionsIncluded}
            onChange={(e) =>
              setServiceListing({
                ...serviceListing,
                revisionsIncluded: e.target.value,
              })
            }
            placeholder="Included revisions"
          />
          <textarea
            className={`${field} md:col-span-2`}
            value={serviceListing.description}
            onChange={(e) =>
              setServiceListing({
                ...serviceListing,
                description: e.target.value,
              })
            }
            placeholder="Service description, requirements and deliverables"
          />
          <textarea
            className={`${field} md:col-span-2`}
            value={serviceListing.packageDescription}
            onChange={(e) =>
              setServiceListing({
                ...serviceListing,
                packageDescription: e.target.value,
              })
            }
            placeholder="What this package includes"
          />
        </div>
        <label className="mt-4 flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={serviceListing.rightsConfirmed}
            onChange={(e) =>
              setServiceListing({
                ...serviceListing,
                rightsConfirmed: e.target.checked,
              })
            }
          />
          I can provide this service and all profile/listing claims are
          accurate.
        </label>
        <button className="mt-4 rounded-full bg-brand px-5 py-2 font-semibold text-black">
          Submit service for review
        </button>
      </form>
      {mine.listings?.length ? (
        <section className="mt-8">
          <h2 className="text-2xl">Your listings</h2>
          <div className="mt-3 space-y-2">
            {mine.listings.map((x) => (
              <div
                key={x.id}
                className="flex justify-between rounded-xl border border-white/10 p-4"
              >
                <span>{x.title}</span>
                <span className="text-brand">{x.status}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
