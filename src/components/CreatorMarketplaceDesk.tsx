"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import MarketplaceAvailabilityDesk from "@/components/MarketplaceAvailabilityDesk";
import { storefrontSlug } from "@/lib/marketplace-storefronts";
import s from "./marketplace/desk.module.css";

type Listing = {
  id: string;
  title: string;
  status: string;
  listing_type: string;
  category: string;
  description: string;
  price_usd: number;
  artwork_url?: string;
  artwork_path?: string;
  asset_path?: string;
  preview_path?: string;
  compatibility?: string;
  licence_summary?: string;
  licence_terms?: string;
  packages?: Array<{ name: string; description: string; priceUsd: number }>;
  addons?: unknown[];
  turnaround_days?: number;
  revisions_included?: number;
  review_notes?: string;
  rights_confirmed?: boolean;
};
type Profile = {
  status?: string;
  roles?: string[];
  headline?: string;
  bio?: string;
  experience?: string;
  skills?: string[];
  genres?: string[];
  equipment?: string[];
  software?: string[];
  portfolio?: Array<Record<string, unknown>>;
  credits?: Array<Record<string, unknown>>;
  accomplishments?: Array<Record<string, unknown>>;
  avatar_url?: string;
  banner_url?: string;
  review_notes?: string;
};
type Mine = {
  profile?: Profile;
  listings?: Listing[];
  seller?: {
    username?: string;
    display_name?: string;
    creator_public_name?: string;
  };
  entitlements?: {
    planId: string;
    productListingLimit: number | null;
    serviceListingLimit: number | null;
    servicePackageLimit: number;
  };
};
type UploadState = {
  file: File;
  preview?: string;
  progress: number;
  path?: string;
  error?: string;
};
type Editor = ReturnType<typeof emptyListing>;
const roles = [
  "artist",
  "producer",
  "engineer",
  "studio",
  "songwriter",
  "vocalist",
  "designer",
  "label_team",
];
const products = [
  "drum_kit",
  "sample_pack",
  "preset",
  "loop_pack",
  "midi_pack",
  "stems",
  "template",
  "other",
];
const services = [
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
const human = (x: string) => x.replaceAll("_", " ");
const emptyProfile = () => ({
  roles: ["producer"],
  headline: "",
  bio: "",
  experience: "",
  skills: "",
  genres: "",
  equipment: "",
  software: "",
  portfolioUrl: "",
  credit: "",
  accomplishment: "",
  evidenceUrl: "",
});
function accountKey(token: string) {
  try {
    return (
      JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).sub || token
    );
  } catch {
    return token;
  }
}
function emptyListing(type = "digital_product") {
  return {
    id: "",
    listingType: type,
    title: "",
    category: type === "service" ? "mixing" : "drum_kit",
    description: "",
    priceUsd: "",
    compatibility: "",
    licenceSummary:
      "Commercial use allowed; redistribution or resale of source files prohibited.",
    licenceTerms: "",
    rightsConfirmed: false,
    packageName: "Standard",
    packageDescription: "",
    turnaroundDays: "7",
    revisionsIncluded: "1",
  };
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`${s.label} ${wide ? s.wide : ""}`}>
      {label}
      {children}
    </label>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={s.badge} data-status={value}>
      {value === "published" ? "Live" : human(value)}
    </span>
  );
}

export function CreatorMarketplaceDesk({
  accessToken = "",
  embedded = false,
  surface = null,
}: {
  accessToken?: string;
  embedded?: boolean;
  surface?: "ios" | "android" | null;
} = {}) {
  const [token, setToken] = useState(accessToken),
    [authReady, setAuthReady] = useState(!!accessToken),
    [mine, setMine] = useState<Mine>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview"),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [editor, setEditor] = useState<Editor | null>(null),
    [step, setStep] = useState(0),
    [profile, setProfile] = useState(emptyProfile),
    [profileDirty, setProfileDirty] = useState(false),
    [listingDirty, setListingDirty] = useState(false),
    [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const uploadRef = useRef(uploads);
  uploadRef.current = uploads;
  const sessionRef = useRef(token);
  sessionRef.current = token;
  const account = accountKey(token);
  const busyRef = useRef(false);
  const base = surface ? `/app/${surface}` : "";
  const listings = mine.listings || [];
  const dirty = profileDirty || listingDirty;
  const hydrate = useCallback(
    (p?: Profile) =>
      setProfile({
        roles: p?.roles?.length ? p.roles : ["producer"],
        headline: p?.headline || "",
        bio: p?.bio || "",
        experience: p?.experience || "",
        skills: p?.skills?.join(", ") || "",
        genres: p?.genres?.join(", ") || "",
        equipment: p?.equipment?.join(", ") || "",
        software: p?.software?.join(", ") || "",
        portfolioUrl: String(
          p?.portfolio?.find((item) => !item.kind)?.url || "",
        ),
        credit: String(p?.credits?.[0]?.title || ""),
        accomplishment: String(p?.accomplishments?.[0]?.title || ""),
        evidenceUrl: String(p?.accomplishments?.[0]?.evidenceUrl || ""),
      }),
    [],
  );
  const load = useCallback(
    async (t: string, reset = false) => {
      const r = await fetch("/api/marketplace?scope=mine", {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      const p = await r.json();
      if (!r.ok)
        throw new Error(
          p.error || "Your workspace could not load. Please retry.",
        );
      if (accountKey(sessionRef.current) !== accountKey(t)) return;
      setMine(p);
      if (reset) hydrate(p.profile);
    },
    [hydrate],
  );
  useEffect(() => {
    if (accessToken) {
      setToken(accessToken);
      setAuthReady(true);
      return;
    }
    if (!isSupabaseConfigured()) {
      setAuthReady(true);
      setLoading(false);
      return;
    }
    const client = createClient();
    void client.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || "");
      setAuthReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || "");
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [accessToken]);
  useEffect(() => {
    const t = sessionRef.current;
    setMine({});
    setEditor(null);
    setProfile(emptyProfile());
    setProfileDirty(false);
    setListingDirty(false);
    Object.values(uploadRef.current).forEach((x) => {
      if (x.preview) URL.revokeObjectURL(x.preview);
    });
    setUploads({});
    setError("");
    setNotice("");
    if (!t) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load(t, true)
      .catch((e) => {
        if (accountKey(sessionRef.current) === accountKey(t))
          setError(e.message);
      })
      .finally(() => {
        if (accountKey(sessionRef.current) === accountKey(t)) setLoading(false);
      });
  }, [account, load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(
    () => () => {
      Object.values(uploadRef.current).forEach((x) => {
        if (x.preview) URL.revokeObjectURL(x.preview);
      });
    },
    [],
  );
  const request = async (body: Record<string, unknown>) => {
    if (accountKey(sessionRef.current) !== account)
      throw new Error("Your account changed. Please try again.");
    const r = await fetch("/api/marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const p = await r.json();
    if (accountKey(sessionRef.current) !== account)
      throw new Error("Your account changed. Please try again.");
    if (!r.ok)
      throw new Error(
        p.error || "Could not save. Your changes are still here.",
      );
    return p;
  };
  const choose = (kind: string, file?: File) => {
    if (!file) return;
    const image = kind !== "asset";
    const max = image ? 10 : 250;
    if (file.size > max * 1024 * 1024 || file.size === 0) {
      setError(`Choose a file between 1 byte and ${max} MB.`);
      return;
    }
    if (image && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    const previous = uploadRef.current[kind];
    if (previous?.preview) URL.revokeObjectURL(previous.preview);
    setUploads((v) => ({
      ...v,
      [kind]: {
        file,
        preview: image ? URL.createObjectURL(file) : undefined,
        progress: 0,
      },
    }));
    kind.startsWith("storefront")
      ? setProfileDirty(true)
      : setListingDirty(true);
    setError("");
  };
  const uploadFiles = async (kinds: string[]) => {
    const paths: Record<string, string> = {};
    for (const kind of kinds) {
      if (accountKey(sessionRef.current) !== account)
        throw new Error("Your account changed.");
      const item = uploadRef.current[kind];
      if (!item) continue;
      if (item.path) {
        paths[`${kind}Path`] = item.path;
        continue;
      }
      setUploads((v) => ({
        ...v,
        [kind]: { ...v[kind], error: undefined, progress: 0 },
      }));
      try {
        const r = await fetch("/api/marketplace/upload/prepare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            files: [
              {
                kind,
                name: item.file.name,
                type: item.file.type,
                size: item.file.size,
              },
            ],
          }),
        });
        const p = await r.json();
        if (!r.ok) throw new Error(p.error || "Could not prepare upload.");
        if (accountKey(sessionRef.current) !== account)
          throw new Error("Your account changed.");
        const slot = p.slots?.[0];
        if (!slot?.signedUrl)
          throw new Error("Upload unavailable. Please retry.");
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", slot.signedUrl);
          xhr.setRequestHeader("Content-Type", slot.contentType);
          xhr.timeout = 180000;
          xhr.upload.onprogress = (e) => {
            if (
              e.lengthComputable &&
              accountKey(sessionRef.current) === account
            )
              setUploads((v) => ({
                ...v,
                [kind]: {
                  ...v[kind],
                  progress: Math.round((e.loaded / e.total) * 100),
                },
              }));
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error("Upload failed. Retry to continue."));
          xhr.onerror = () =>
            reject(new Error("Connection interrupted. Retry to continue."));
          xhr.ontimeout = () =>
            reject(new Error("Upload timed out. Retry to continue."));
          xhr.send(item.file);
        });
        if (accountKey(sessionRef.current) !== account)
          throw new Error("Your account changed.");
        setUploads((v) => ({
          ...v,
          [kind]: { ...v[kind], path: slot.path, progress: 100 },
        }));
        paths[`${kind}Path`] = slot.path;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Upload failed.";
        if (accountKey(sessionRef.current) === account)
          setUploads((v) => ({ ...v, [kind]: { ...v[kind], error: message } }));
        throw new Error(`${item.file.name}: ${message}`);
      }
    }
    return paths;
  };
  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (accountKey(sessionRef.current) === account)
        setError(
          e instanceof Error
            ? e.message
            : "Something went wrong. Please retry.",
        );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const clearListingUploads = () =>
    setUploads((v) => {
      const next = { ...v };
      for (const k of ["asset", "artwork"]) {
        if (next[k]?.preview) URL.revokeObjectURL(next[k].preview!);
        delete next[k];
      }
      return next;
    });
  const openListing = (type: string, item?: Listing) => {
    if (busyRef.current) return;
    if (listingDirty && !window.confirm("Discard the unsaved listing changes?"))
      return;
    clearListingUploads();
    setEditor(
      item
        ? {
            id: item.id,
            listingType: item.listing_type,
            title: item.title,
            category: item.category,
            description: item.description || "",
            priceUsd: String(item.price_usd),
            compatibility: item.compatibility || "",
            licenceSummary: item.licence_summary || "",
            licenceTerms: item.licence_terms || "",
            rightsConfirmed: false,
            packageName: item.packages?.[0]?.name || "Standard",
            packageDescription: item.packages?.[0]?.description || "",
            turnaroundDays: String(item.turnaround_days || 7),
            revisionsIncluded: String(item.revisions_included ?? 1),
          }
        : emptyListing(type),
    );
    setListingDirty(false);
    setStep(0);
    setTab("listings");
    setError("");
  };
  const edit = (key: keyof Editor, value: string | boolean) => {
    setEditor((v) => (v ? { ...v, [key]: value } : v));
    setListingDirty(true);
  };
  const saveListing = (submit: boolean) =>
    run(async () => {
      if (!editor) return;
      if (
        !editor.title.trim() ||
        Number(editor.priceUsd) < 1 ||
        !Number.isFinite(Number(editor.priceUsd))
      )
        throw new Error("Add a title and a price of at least US$1.");
      if (submit && !editor.rightsConfirmed)
        throw new Error(
          "Confirm the rights and listing claims before submitting.",
        );
      const paths = await uploadFiles(["asset", "artwork"]);
      const old = listings.find((x) => x.id === editor.id);
      const p = await request({
        action: "save_listing",
        ...editor,
        ...paths,
        packages:
          editor.listingType === "service"
            ? [
                {
                  name: editor.packageName,
                  description: editor.packageDescription,
                  priceUsd: editor.priceUsd,
                },
                ...(old?.packages?.slice(1) || []),
              ]
            : [],
        ...(old?.addons ? { addons: old.addons } : {}),
        submit,
      });
      setEditor((v) => (v ? { ...v, id: p.listing.id } : v));
      setListingDirty(false);
      await load(token);
      setNotice(
        submit
          ? "Sent to Editorial. You can track the review in Your listings."
          : "Draft saved. Come back whenever you are ready.",
      );
      if (submit) setEditor(null);
    });
  const saveProfile = (submit: boolean) =>
    run(async () => {
      const paths = await uploadFiles([
        "storefront_avatar",
        "storefront_banner",
      ]);
      await request({
        action: "save_profile",
        ...profile,
        ...(profile.portfolioUrl !==
        String(mine.profile?.portfolio?.find((item) => !item.kind)?.url || "")
          ? {
              portfolio: [
                ...(profile.portfolioUrl
                  ? [{ title: "Portfolio", url: profile.portfolioUrl }]
                  : []),
                ...(mine.profile?.portfolio
                  ?.filter((item) => !item.kind)
                  .slice(1) || []),
              ],
            }
          : {}),
        ...(profile.credit !== String(mine.profile?.credits?.[0]?.title || "")
          ? {
              credits: [
                ...(profile.credit ? [{ title: profile.credit }] : []),
                ...(mine.profile?.credits?.slice(1) || []),
              ],
            }
          : {}),
        ...(profile.accomplishment !==
          String(mine.profile?.accomplishments?.[0]?.title || "") ||
        profile.evidenceUrl !==
          String(mine.profile?.accomplishments?.[0]?.evidenceUrl || "")
          ? {
              accomplishments: [
                ...(profile.accomplishment
                  ? [
                      {
                        title: profile.accomplishment,
                        evidenceUrl: profile.evidenceUrl,
                      },
                    ]
                  : []),
                ...(mine.profile?.accomplishments?.slice(1) || []),
              ],
            }
          : {}),
        ...Object.fromEntries(
          ["skills", "genres", "equipment", "software"].map((k) => [
            k,
            profile[k as keyof typeof profile]
              .toString()
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          ]),
        ),
        ...(paths.storefront_avatarPath
          ? { avatarPath: paths.storefront_avatarPath }
          : {}),
        ...(paths.storefront_bannerPath
          ? { bannerPath: paths.storefront_bannerPath }
          : {}),
        submit,
      });
      setProfileDirty(false);
      await load(token, true);
      setNotice(
        submit
          ? "Storefront sent to Editorial for approval."
          : "Storefront saved.",
      );
    });
  const uploadBox = (kind: string, label: string, existing?: string) => {
    const item = uploads[kind];
    return (
      <div className={s.upload}>
        {(item?.preview || existing) && (
          <img
            className={s.preview}
            src={item?.preview || existing}
            alt={`${label} preview`}
          />
        )}
        <label className={s.label}>
          {label}
          <span className={`block ${s.muted}`}>
            {kind === "asset"
              ? "Private customer download · up to 250 MB"
              : "JPG, PNG or WebP · up to 10 MB"}
          </span>
          <input
            disabled={busy}
            type="file"
            accept={
              kind === "asset" ? undefined : "image/jpeg,image/png,image/webp"
            }
            onChange={(e) => {
              choose(kind, e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {item && (
          <div className={s.section}>
            <p className={s.muted}>
              {item.file.name} · {(item.file.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <progress
              className={s.progress}
              value={item.progress}
              max={100}
              aria-label={`${label} upload progress`}
            />
            <p className={s.muted}>
              {item.error ||
                (item.path
                  ? "Uploaded — ready to save"
                  : busy
                    ? `${item.progress}% uploaded`
                    : "Ready to upload when you save")}
            </p>
            {item.error && (
              <button
                type="button"
                className={s.button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await uploadFiles([kind]);
                    setNotice("Upload complete. Save your changes to finish.");
                  })
                }
              >
                Retry upload
              </button>
            )}
          </div>
        )}
      </div>
    );
  };
  if (!authReady || loading)
    return (
      <section className="mx-auto max-w-5xl px-6 py-12" aria-busy="true">
        <p className={s.eyebrow}>Creator workspace</p>
        <h1 className={s.title}>Opening your marketplace…</h1>
      </section>
    );
  if (!token)
    return (
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className={s.title}>Your creative business, in one place.</h1>
        <p className={s.muted}>
          Sign in to manage products, services and your storefront.
        </p>
        <Link
          className={`${s.primary} mt-6`}
          href={
            surface ? `${base}/login` : "/auth/login?next=/creator/marketplace"
          }
        >
          Sign in
        </Link>
      </section>
    );
  const active = listings.filter((x) => x.status === "published").length;
  const pending = listings.filter(
    (x) => x.status === "submitted" || x.status === "in_review",
  ).length;
  const drafts = listings.filter((x) => x.status === "draft").length;
  const existing = listings.find((x) => x.id === editor?.id);
  const storeSlug = storefrontSlug(
    mine.seller?.creator_public_name ||
      mine.seller?.display_name ||
      mine.seller?.username ||
      "",
  );
  const storefrontHref = storeSlug
    ? surface
      ? `${base}/marketplace?provider=${encodeURIComponent(storeSlug)}`
      : `/marketplace/${storeSlug}`
    : `${base}/marketplace`;
  const listingRows = (items: Listing[]) =>
    items.map((item) => (
      <div className={s.listing} key={item.id}>
        {item.artwork_url ? (
          <img src={item.artwork_url} className={s.thumb} alt="" />
        ) : (
          <div className={s.thumb} aria-hidden="true">
            {item.listing_type === "service" ? "✦" : "▧"}
          </div>
        )}
        <div className={s.grow}>
          <p className="font-medium break-words">{item.title}</p>
          <p className={s.muted}>
            {human(item.category)} · US${Number(item.price_usd).toFixed(2)}
          </p>
          <Status value={item.status} />
          {item.review_notes && <p className={s.muted}>{item.review_notes}</p>}
        </div>
        <div className={s.actions}>
          <button
            className={s.button}
            disabled={busy}
            onClick={() => openListing(item.listing_type, item)}
          >
            Edit
          </button>
          {item.status === "published" && (
            <button
              className={s.button}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Pause “${item.title}”? It will disappear from the marketplace until you submit it for review again.`,
                  )
                )
                  void run(async () => {
                    await request({ action: "pause_listing", id: item.id });
                    await load(token);
                    setNotice("Listing paused. Existing orders are unchanged.");
                  });
              }}
            >
              Pause
            </button>
          )}
        </div>
      </div>
    ));
  return (
    <section
      className={`${s.desk} ${embedded ? "pt-4" : "mx-auto max-w-6xl px-4 py-10 sm:px-6"}`}
    >
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Creator workspace</p>
          <h1 className={s.title}>Make room for your next sale.</h1>
          <p className={s.muted}>
            Your work, your storefront, your next opportunity.
          </p>
        </div>
        <div className={s.actions}>
          <Link
            className={s.button}
            href={
              mine.profile?.status === "approved"
                ? storefrontHref
                : `${base}/marketplace`
            }
          >
            {mine.profile?.status === "approved"
              ? "View storefront ↗"
              : "Browse marketplace ↗"}
          </Link>
          <button
            className={s.primary}
            onClick={() => openListing("digital_product")}
          >
            + New listing
          </button>
        </div>
      </header>
      <div className={s.tabs} role="tablist" aria-label="Marketplace workspace">
        {[
          ["overview", "Overview"],
          ["listings", "Your listings"],
          ["storefront", "Storefront"],
          ["availability", "Availability"],
        ].map(([id, label]) => (
          <button
            key={id}
            id={`desk-tab-${id}`}
            role="tab"
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(event) => {
              const tabs = [
                "overview",
                "listings",
                "storefront",
                "availability",
              ];
              const index = tabs.indexOf(id);
              const next =
                event.key === "ArrowRight"
                  ? tabs[(index + 1) % tabs.length]
                  : event.key === "ArrowLeft"
                    ? tabs[(index + tabs.length - 1) % tabs.length]
                    : event.key === "Home"
                      ? tabs[0]
                      : event.key === "End"
                        ? tabs[tabs.length - 1]
                        : null;
              if (next) {
                event.preventDefault();
                setTab(next);
                document.getElementById(`desk-tab-${next}`)?.focus();
              }
            }}
            aria-selected={tab === id}
            aria-controls={`desk-panel-${id}`}
            className={s.tab}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className={`${s.notice} ${s.error}`}>
          {error}
          {!mine.listings && (
            <button
              className={`${s.button} ml-3`}
              onClick={() => void run(() => load(token, true))}
            >
              Retry loading
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className={s.notice}>
          {notice}
        </p>
      )}
      <div
        role="tabpanel"
        id={`desk-panel-${tab}`}
        aria-labelledby={`desk-tab-${tab}`}
      >
        {tab === "overview" && (
          <>
            <div className={s.grid}>
              {[
                ["Live listings", active, "Ready for customers", "published"],
                [
                  "In review",
                  pending,
                  "Editorial is checking your work",
                  "submitted",
                ],
                ["Drafts", drafts, "Pick up where you left off", "draft"],
              ].map(([label, count, hint, key]) => (
                <button
                  key={label}
                  className={`${s.card} text-left`}
                  onClick={() => {
                    setTab("listings");
                    setFilter(String(key));
                  }}
                >
                  <p className={s.muted}>{label}</p>
                  <p className={s.stat}>{count}</p>
                  <p className={s.muted}>{hint} →</p>
                </button>
              ))}
            </div>
            <div className={`${s.card} ${s.section}`}>
              <div className={s.row}>
                <div>
                  <h2 className={s.heading}>Your storefront</h2>
                  <p className={s.muted}>
                    {mine.profile?.headline ||
                      "Give your creative work a home. Add your images, story and skills."}
                  </p>
                </div>
                <Status value={mine.profile?.status || "not started"} />
              </div>
              <button
                className={`${s.button} mt-5`}
                onClick={() => setTab("storefront")}
              >
                {mine.profile ? "Polish your storefront" : "Set up storefront"}{" "}
                →
              </button>
            </div>
            <div className={`${s.section} ${s.row}`}>
              <h2 className={s.heading}>Recently updated</h2>
              <button
                className={s.button}
                onClick={() => {
                  setTab("listings");
                  setFilter("all");
                }}
              >
                See all listings
              </button>
            </div>
            {listings.length ? (
              listingRows(listings.slice(0, 3))
            ) : (
              <div className={`${s.empty} ${s.section}`}>
                <h2 className={s.heading}>Something worth sharing?</h2>
                <p className={`${s.muted} mt-2 mb-5`}>
                  Start with a sample pack, production asset or a service you
                  love doing.
                </p>
                <div className={`${s.actions} justify-center`}>
                  <button
                    className={s.primary}
                    onClick={() => openListing("digital_product")}
                  >
                    Create a product
                  </button>
                  <button
                    className={s.button}
                    onClick={() => openListing("service")}
                  >
                    Offer a service
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {tab === "listings" && !editor && (
          <>
            <div className={s.row}>
              <div>
                <h2 className={s.heading}>Your listings</h2>
                <p className={s.muted}>
                  Manage what is live and keep your next release moving.
                </p>
              </div>
              <div className={s.actions}>
                <button
                  className={s.button}
                  onClick={() => openListing("service")}
                >
                  + Service
                </button>
                <button
                  className={s.primary}
                  onClick={() => openListing("digital_product")}
                >
                  + Product
                </button>
              </div>
            </div>
            <div className={s.formGrid}>
              <Field label="Find a listing">
                <input
                  className={s.field}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your titles"
                />
              </Field>
              <Field label="Status">
                <select
                  className={s.field}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    "all",
                    "published",
                    "draft",
                    "submitted",
                    "rejected",
                    "archived",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {x === "all"
                        ? "All listings"
                        : x === "published"
                          ? "Live"
                          : x === "archived"
                            ? "Paused / archived"
                            : human(x)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {listingRows(
              listings.filter(
                (x) =>
                  (filter === "all" ||
                    x.status === filter ||
                    (filter === "submitted" && x.status === "in_review")) &&
                  x.title.toLowerCase().includes(search.toLowerCase()),
              ),
            )}
            {!listings.some(
              (x) =>
                (filter === "all" ||
                  x.status === filter ||
                  (filter === "submitted" && x.status === "in_review")) &&
                x.title.toLowerCase().includes(search.toLowerCase()),
            ) && (
              <div className={`${s.empty} ${s.section}`}>
                <h3 className={s.heading}>No listings here yet</h3>
                <p className={s.muted}>
                  Try another filter or create your next listing.
                </p>
              </div>
            )}
          </>
        )}
        {tab === "listings" && editor && (
          <form
            className={s.card}
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 2) {
                setStep((v) => v + 1);
                return;
              }
              void saveListing(true);
            }}
          >
            <fieldset disabled={busy} className="min-w-0">
              <div className={s.row}>
                <div>
                  <p className={s.eyebrow}>
                    {editor.id ? "Edit listing" : "New listing"}
                  </p>
                  <h2 className={s.heading}>
                    {editor.listingType === "service"
                      ? "Offer your expertise"
                      : "Share something you made"}
                  </h2>
                </div>
                <button
                  type="button"
                  className={s.button}
                  disabled={busy}
                  onClick={() => {
                    if (
                      !listingDirty ||
                      window.confirm("Discard unsaved listing changes?")
                    ) {
                      setEditor(null);
                      setListingDirty(false);
                      clearListingUploads();
                    }
                  }}
                >
                  Close
                </button>
              </div>
              {existing?.status === "published" && (
                <p className={s.notice}>
                  Saving changes takes this live listing offline. Submit it for
                  Editorial review to publish the updated version.
                </p>
              )}
              <div className={s.steps}>
                {["The essentials", "Files & details", "Review & submit"].map(
                  (label, i) => (
                    <div
                      key={label}
                      className={s.step}
                      data-active={step === i}
                    >
                      {i + 1}. {label}
                    </div>
                  ),
                )}
              </div>
              {step === 0 && (
                <div className={s.formGrid}>
                  <Field label="Title" wide>
                    <input
                      className={s.field}
                      required
                      maxLength={160}
                      value={editor.title}
                      onChange={(e) => edit("title", e.target.value)}
                      placeholder={
                        editor.listingType === "service"
                          ? "e.g. A polished mix for your next single"
                          : "e.g. Midnight Soul — drum kit"
                      }
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      className={s.field}
                      value={editor.category}
                      onChange={(e) => edit("category", e.target.value)}
                    >
                      {(editor.listingType === "service"
                        ? services
                        : products
                      ).map((x) => (
                        <option key={x} value={x}>
                          {human(x)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Price · USD">
                    <input
                      className={s.field}
                      required
                      type="number"
                      min="1"
                      step="0.01"
                      value={editor.priceUsd}
                      onChange={(e) => edit("priceUsd", e.target.value)}
                      placeholder="25.00"
                    />
                  </Field>
                  <Field label="What will the customer receive?" wide>
                    <textarea
                      className={s.field}
                      rows={5}
                      maxLength={5000}
                      value={editor.description}
                      onChange={(e) => edit("description", e.target.value)}
                      placeholder="Describe what is included, who it is for, and what makes it useful."
                    />
                  </Field>
                </div>
              )}
              {step === 1 && (
                <div className={s.formGrid}>
                  {editor.listingType === "digital_product" ? (
                    <>
                      <div>
                        {uploadBox("asset", "Product download")}
                        {existing?.asset_path && !uploads.asset && (
                          <p className={s.muted}>
                            Your current product file is attached. Choose a file
                            only to replace it.
                          </p>
                        )}
                      </div>
                      <div>
                        {uploadBox(
                          "artwork",
                          "Listing artwork",
                          existing?.artwork_url,
                        )}
                      </div>
                      <Field label="Software / version compatibility" wide>
                        <input
                          className={s.field}
                          value={editor.compatibility}
                          onChange={(e) =>
                            edit("compatibility", e.target.value)
                          }
                          placeholder="e.g. WAV · any DAW · 44.1 kHz"
                        />
                      </Field>
                      <Field label="Licence summary" wide>
                        <textarea
                          className={s.field}
                          rows={2}
                          value={editor.licenceSummary}
                          onChange={(e) =>
                            edit("licenceSummary", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Full licence terms" wide>
                        <textarea
                          className={s.field}
                          rows={4}
                          value={editor.licenceTerms}
                          onChange={(e) => edit("licenceTerms", e.target.value)}
                        />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="Package name">
                        <input
                          className={s.field}
                          value={editor.packageName}
                          onChange={(e) => edit("packageName", e.target.value)}
                        />
                      </Field>
                      <Field label="Turnaround · days">
                        <input
                          className={s.field}
                          type="number"
                          min="1"
                          max="120"
                          value={editor.turnaroundDays}
                          onChange={(e) =>
                            edit("turnaroundDays", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Included revisions">
                        <input
                          className={s.field}
                          type="number"
                          min="0"
                          max="20"
                          value={editor.revisionsIncluded}
                          onChange={(e) =>
                            edit("revisionsIncluded", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="What this package includes" wide>
                        <textarea
                          className={s.field}
                          rows={4}
                          value={editor.packageDescription}
                          onChange={(e) =>
                            edit("packageDescription", e.target.value)
                          }
                        />
                      </Field>
                      <div className={s.wide}>
                        {uploadBox(
                          "artwork",
                          "Service artwork",
                          existing?.artwork_url,
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              {step === 2 && (
                <>
                  <div className={s.card}>
                    <div className={s.row}>
                      <h3 className={s.heading}>
                        {editor.title || "Untitled listing"}
                      </h3>
                      <span>US${Number(editor.priceUsd || 0).toFixed(2)}</span>
                    </div>
                    <p className={s.muted}>{human(editor.category)}</p>
                    <p className="mt-4 whitespace-pre-wrap">
                      {editor.description || "No description yet."}
                    </p>
                  </div>
                  <label className="mt-6 flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={editor.rightsConfirmed}
                      onChange={(e) =>
                        edit("rightsConfirmed", e.target.checked)
                      }
                    />
                    I own or control the rights and can fulfil this listing. All
                    claims are accurate.
                  </label>
                  <p className={`${s.muted} mt-4`}>
                    Editorial checks rights, quality and fulfilment before a
                    listing goes live.
                    {mine.profile?.status !== "approved"
                      ? " Save a draft now, then submit once your storefront profile is approved."
                      : ""}
                  </p>
                </>
              )}
              <div className={s.footer}>
                <span className={s.muted}>
                  {busy
                    ? "Saving — keep this page open…"
                    : listingDirty
                      ? "Unsaved changes"
                      : "All changes saved"}
                </span>
                <div className={s.actions}>
                  {step > 0 && (
                    <button
                      type="button"
                      className={s.button}
                      disabled={busy}
                      onClick={() => setStep((v) => v - 1)}
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    className={s.button}
                    disabled={busy}
                    onClick={() => void saveListing(false)}
                  >
                    Save draft
                  </button>
                  <button
                    className={s.primary}
                    disabled={
                      busy ||
                      (step === 2 && mine.profile?.status !== "approved")
                    }
                  >
                    {busy
                      ? "Saving…"
                      : step < 2
                        ? "Continue →"
                        : "Submit for review"}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
        )}
        {tab === "storefront" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile(true);
            }}
          >
            <fieldset disabled={busy} className="min-w-0">
              <div className={s.row}>
                <div>
                  <h2 className={s.heading}>Make it feel like you.</h2>
                  <p className={s.muted}>
                    Your images and story help customers connect with your work.
                  </p>
                </div>
                <Status value={mine.profile?.status || "draft"} />
              </div>
              {mine.profile?.review_notes && (
                <p className={s.notice}>{mine.profile.review_notes}</p>
              )}
              <div className={`${s.card} ${s.section}`}>
                {mine.profile?.status === "approved" && (
                  <p className={s.notice}>
                    Saving changes takes your approved storefront out of the
                    public marketplace until Editorial approves the updated
                    profile. Submit for approval when ready.
                  </p>
                )}
                {uploads.storefront_banner?.preview ||
                mine.profile?.banner_url ? (
                  <img
                    className={s.cover}
                    src={
                      uploads.storefront_banner?.preview ||
                      mine.profile?.banner_url
                    }
                    alt="Storefront banner preview"
                  />
                ) : (
                  <div className={s.cover} />
                )}
                <div>
                  {uploads.storefront_avatar?.preview ||
                  mine.profile?.avatar_url ? (
                    <img
                      className={s.avatar}
                      src={
                        uploads.storefront_avatar?.preview ||
                        mine.profile?.avatar_url
                      }
                      alt="Storefront avatar preview"
                    />
                  ) : (
                    <div className={s.avatar} />
                  )}
                </div>
                <h3 className={s.heading}>
                  {mine.seller?.creator_public_name ||
                    mine.seller?.display_name ||
                    mine.seller?.username ||
                    "Your storefront"}
                </h3>
                <p className={s.muted}>
                  {profile.headline || "Your creative headline goes here"}
                </p>
                <div className={s.formGrid}>
                  {uploadBox("storefront_avatar", "Storefront portrait")}
                  {uploadBox("storefront_banner", "Storefront banner")}
                </div>
              </div>
              <div className={`${s.card} ${s.section}`}>
                <h3 className={s.heading}>Your story</h3>
                <div className={s.formGrid}>
                  <Field label="Headline" wide>
                    <input
                      className={s.field}
                      maxLength={180}
                      value={profile.headline}
                      onChange={(e) => {
                        setProfile((v) => ({ ...v, headline: e.target.value }));
                        setProfileDirty(true);
                      }}
                      placeholder="e.g. Soulful production. Thoughtful sound design."
                    />
                  </Field>
                  <Field label="About you" wide>
                    <textarea
                      className={s.field}
                      rows={5}
                      maxLength={3000}
                      value={profile.bio}
                      onChange={(e) => {
                        setProfile((v) => ({ ...v, bio: e.target.value }));
                        setProfileDirty(true);
                      }}
                      placeholder="Tell customers what you make and what it is like working with you."
                    />
                  </Field>
                </div>
                <p className={`${s.label} mt-6`}>What do you do?</p>
                <div className={s.roles}>
                  {roles.map((role) => (
                    <label className={s.role} key={role}>
                      <input
                        type="checkbox"
                        checked={profile.roles.includes(role)}
                        onChange={() => {
                          setProfile((v) => ({
                            ...v,
                            roles: v.roles.includes(role)
                              ? v.roles.filter((x) => x !== role)
                              : [...v.roles, role],
                          }));
                          setProfileDirty(true);
                        }}
                      />
                      {human(role)}
                    </label>
                  ))}
                </div>
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm">
                    Skills, experience & tools
                  </summary>
                  <div className={s.formGrid}>
                    {(
                      ["skills", "genres", "equipment", "software"] as const
                    ).map((key) => (
                      <Field
                        key={key}
                        label={`${human(key)} · comma separated`}
                      >
                        <input
                          className={s.field}
                          value={profile[key]}
                          onChange={(e) => {
                            setProfile((v) => ({
                              ...v,
                              [key]: e.target.value,
                            }));
                            setProfileDirty(true);
                          }}
                        />
                      </Field>
                    ))}
                    <Field label="Professional experience" wide>
                      <textarea
                        className={s.field}
                        rows={4}
                        value={profile.experience}
                        onChange={(e) => {
                          setProfile((v) => ({
                            ...v,
                            experience: e.target.value,
                          }));
                          setProfileDirty(true);
                        }}
                      />
                    </Field>
                  </div>
                </details>
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm">
                    Portfolio, credits & accomplishments
                  </summary>
                  <div className={s.formGrid}>
                    {(
                      [
                        ["portfolioUrl", "Portfolio link"],
                        ["credit", "Featured credit"],
                        ["accomplishment", "Featured accomplishment"],
                        ["evidenceUrl", "Evidence link"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          className={s.field}
                          type={key.endsWith("Url") ? "url" : "text"}
                          value={profile[key]}
                          onChange={(e) => {
                            setProfile((v) => ({
                              ...v,
                              [key]: e.target.value,
                            }));
                            setProfileDirty(true);
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                  <p className={`${s.muted} mt-4`}>
                    Additional existing credits and portfolio links are kept
                    when you save.
                  </p>
                </details>
                <div className={s.footer}>
                  <span className={s.muted}>
                    {busy
                      ? "Saving…"
                      : profileDirty
                        ? "Unsaved changes"
                        : "All changes saved"}
                  </span>
                  <div className={s.actions}>
                    <button
                      type="button"
                      className={s.button}
                      disabled={busy}
                      onClick={() => void saveProfile(false)}
                    >
                      Save changes
                    </button>
                    <button className={s.primary} disabled={busy}>
                      {busy ? "Saving…" : "Submit for approval"}
                    </button>
                  </div>
                </div>
              </div>
            </fieldset>
          </form>
        )}
        {tab === "availability" && <MarketplaceAvailabilityDesk />}
      </div>
      {mine.entitlements && (
        <p className={`${s.muted} mt-8 text-xs`}>
          {human(mine.entitlements.planId)} plan · Products:{" "}
          {
            listings.filter(
              (x) =>
                x.listing_type === "digital_product" &&
                !["archived", "rejected"].includes(x.status),
            ).length
          }
          /{mine.entitlements.productListingLimit ?? "fair use"} · Services:{" "}
          {
            listings.filter(
              (x) =>
                x.listing_type === "service" &&
                !["archived", "rejected"].includes(x.status),
            ).length
          }
          /{mine.entitlements.serviceListingLimit ?? "fair use"}
        </p>
      )}
    </section>
  );
}
