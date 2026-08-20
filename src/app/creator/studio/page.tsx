"use client";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import MyBeatStore from "@/components/MyBeatStore";
import BeatPackUploadForm from "@/components/BeatPackUploadForm";
import ReleaseSubmitForm from "@/components/ReleaseSubmitForm";
import CreatorInsights from "@/components/CreatorInsights";
import StudioPremiumDesk from "@/components/StudioPremiumDesk";
import DistributionPathTimeline from "@/components/DistributionPathTimeline";
import { CreatorMarketplaceDesk } from "@/components/CreatorMarketplaceDesk";
import CreatorServiceOrders from "@/components/CreatorServiceOrders";
import ArtworkChangeRequestForm from "@/components/ArtworkChangeRequestForm";
import {
  buildArtistPathSteps,
  publicDistributionStatusLabel,
} from "@/lib/distribution-path";

type WorkflowItem = {
  id: string;
  title?: string;
  topic?: string;
  status?: string;
  editor_notes?: string;
  review_notes?: string;
  scheduled_for?: string;
};
type ShowItem = WorkflowItem & { status: string };
type Release = {
  id: string;
  title: string;
  genre?: string;
  editorial_status: string;
  editorial_notes?: string;
  is_public: boolean;
  in_rotation: boolean;
  is_downloadable: boolean;
  download_price: number;
  licence_type: string;
  play_count: number;
  like_count?: number;
  created_at: string;
  release_id?: string;
  isrc?: string;
  spotify_url?: string;
};
type AlbumRelease = {
  id: string;
  title: string;
  artist_name?: string;
  genre?: string;
  editorial_status: string;
  editorial_notes?: string;
  is_public: boolean;
  in_rotation: boolean;
  release_type?: string;
  track_count?: number;
  created_at: string;
  published_at?: string | null;
};
type DistJob = {
  id: string;
  release_id: string;
  status: string;
  notes?: string | null;
  updated_at?: string;
  created_at?: string;
};
type TrackRequest = {
  id: string;
  track_id: string;
  request_type: string;
  status: string;
  message: string;
  created_at: string;
};
type ProfileFlags = {
  premiumActive: boolean;
  premiumUntil: string | null;
  distributionEnabled: boolean;
  premiumPlanId?: string | null;
};
type Data = {
  profile: { role: string; display_name?: string; is_producer?: boolean };
  application?: { status: string; review_notes?: string };
  articles: WorkflowItem[];
  briefs: WorkflowItem[];
  shows: ShowItem[];
  episodes: WorkflowItem[];
  tracks: Release[];
  trackRequests: TrackRequest[];
  releases?: AlbumRelease[];
  distributionJobs?: DistJob[];
  profileFlags?: ProfileFlags;
};
const field =
  "w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand";

export default function CreatorStudio() {
  const [data, setData] = useState<Data | null>(null),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async (t: string) => {
    const r = await fetch("/api/creator/workspace", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const p = await r.json();
    if (!r.ok) throw new Error(p.error);
    setData(p);
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    createClient()
      .auth.getSession()
      .then(({ data: s }) => {
        const t = s.session?.access_token;
        if (!t) {
          setError("Sign in with a creator account.");
          return;
        }
        setToken(t);
        load(t).catch((e) => setError(e.message));
      });
  }, [load]);
  const act = async (body: Record<string, unknown>) => {
    setError("");
    setMessage("");
    const r = await fetch("/api/creator/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const p = await r.json();
    if (!r.ok) {
      setError(p.error);
      return;
    }
    setMessage("Saved successfully.");
    await load(token);
  };
  if (error && !data)
    return (
      <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl">Creator workspace unavailable</h1>
        <p className="mt-4 text-text-secondary">{error}</p>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-black"
        >
          Sign in
        </Link>
      </main>
    );
  if (!data)
    return (
      <main className="p-20 text-center text-text-secondary">
        Loading creator workspace…
      </main>
    );
  const artist = ["artist", "admin"].includes(data.profile.role),
    writer = ["writer", "admin"].includes(data.profile.role),
    showCreator = ["show_creator", "admin"].includes(data.profile.role);
  const producer =
    Boolean((data.profile as { is_producer?: boolean }).is_producer) ||
    data.profile.role === "admin";
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-xs uppercase tracking-[.22em] text-brand">
        Creator studio
      </p>
      <h1 className="mt-2 text-4xl font-semibold">
        Welcome, {data.profile.display_name || "creator"}
      </h1>
      <p className="mt-3 text-text-secondary">
        Manage your public work, submissions and business from one place. BVS
        editorial review remains separate from paid creator tools.
      </p>
      {error && (
        <p className="mt-5 rounded-xl bg-red-500/10 p-4 text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-5 rounded-xl bg-brand/10 p-4 text-brand">{message}</p>
      )}
      <StudioOverview
        artist={artist}
        producer={producer}
        writer={writer}
        showCreator={showCreator}
        trackCount={(data.tracks || []).length}
      />
      {artist && (
        <section id="artist-access" className="scroll-mt-24 pt-12" aria-labelledby="artist-access-heading">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Artist access</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="artist-access-heading" className="text-3xl font-semibold">Music and releases</h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">Submit music, multi-track albums/EPs, follow editorial decisions, manage published recordings and track the path to distribution — without leaving Studio.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="#artist-upload" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Upload music</a>
              <Link href="/upload" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">Full upload page</Link>
              <Link href="/artists" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">Wallet & earnings</Link>
              <Link href="/artist/premium" className="rounded-full border border-brand/40 px-5 py-2.5 text-sm text-brand hover:bg-brand/10">Artist Premium</Link>
            </div>
          </div>
        </section>
      )}
      {artist && (
        <div id="artist-upload" className="scroll-mt-24">
          <CreatorDropDown label="Upload album / EP / single" defaultOpen>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-text-secondary">
                Artist form only: multi-track Album / EP or a single recording. Files go to private storage, then editorial review. Separate from producer BeatStore packs below.
              </p>
              <ReleaseSubmitForm onSuccess={() => void load(token)} />
            </div>
          </CreatorDropDown>
        </div>
      )}
      {artist && (
        <div id="release-path" className="scroll-mt-24">
          <CreatorDropDown label="Release path">
            <ArtistPathBoard data={data} />
          </CreatorDropDown>
        </div>
      )}
      {artist && (
        <div id="releases" className="scroll-mt-24">
          <CreatorDropDown label="Releases and artist requests" count={(data.tracks || []).length} defaultOpen>
            <ArtistReleases token={token} tracks={data.tracks || []} requests={data.trackRequests || []} jobs={data.distributionJobs || []} releases={data.releases || []} flags={data.profileFlags} />
          </CreatorDropDown>
        </div>
      )}
      {(artist || producer) && <div id="insights" className="scroll-mt-24"><CreatorDropDown label="Performance and editorial insights" defaultOpen><CreatorInsights token={token} /></CreatorDropDown></div>}
      {producer && (
        <section id="producer-access" className="scroll-mt-24 pt-12" aria-labelledby="producer-access-heading">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Producer access</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="producer-access-heading" className="text-3xl font-semibold">BeatStore packs & singles</h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                Upload a multi-beat pack/EP (for example 10 previews at once) or a single beat, then track editorial status here. Packs stay grouped through approve → publish.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="#beat-pack-upload" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Upload beat pack</a>
              <a href="#beat-single-upload" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">Single beat</a>
              <Link href="/upload?type=pack" className="rounded-full border border-white/20 px-5 py-2.5 text-sm hover:border-brand">Full upload page</Link>
            </div>
          </div>
        </section>
      )}
      {producer && (
        <div id="beat-pack-upload" className="scroll-mt-24">
          <CreatorDropDown label="Upload a beat pack / EP" defaultOpen>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-text-secondary">
                Producer form: multi-select 2–20 tagged previews as one ordered pack. Same flow as /upload?type=pack — private storage → editorial pack queue → approve whole pack → publish to BeatStore.
              </p>
              <BeatPackUploadForm />
            </div>
          </CreatorDropDown>
        </div>
      )}
      {producer && (
        <div id="beat-single-upload" className="scroll-mt-24">
          <CreatorDropDown label="Upload a single beat">
            <div className="space-y-3 pt-2">
              <p className="text-sm text-text-secondary">One beat at a time when you are not shipping a pack.</p>
              <MyBeatStore creationOnly />
            </div>
          </CreatorDropDown>
        </div>
      )}
      {producer && (
        <div id="beatstore" className="scroll-mt-24">
          <CreatorDropDown label="My BeatStore catalogue & review" defaultOpen>
            <MyBeatStore />
          </CreatorDropDown>
        </div>
      )}

      <section id="business" className="scroll-mt-24 pt-12" aria-labelledby="business-heading">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Creator business</p>
        <h2 id="business-heading" className="mt-2 text-3xl font-semibold">Sell, deliver and grow</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">Marketplace listings, customer service orders and optional Premium capabilities live here—separate from editorial approval and radio rotation.</p>
      </section>
      <div id="marketplace-desk" className="scroll-mt-24"><CreatorDropDown label="Marketplace listings"><CreatorMarketplaceDesk accessToken={token} embedded /></CreatorDropDown></div>
      <div id="service-orders" className="scroll-mt-24"><CreatorDropDown label="Service orders"><CreatorServiceOrders token={token} /></CreatorDropDown></div>
      <div id="premium-desk" className="scroll-mt-24"><CreatorDropDown label="Premium capabilities"><StudioPremiumDesk token={token} /></CreatorDropDown></div>
      {writer && (
        <section id="writer-work" className="scroll-mt-24 pt-12">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Editorial writing</p>
          <h2 className="mt-2 text-3xl font-semibold">Stories and research</h2>
          <CreatorDropDown
            label="Writer application"
            defaultOpen={
              !data.application ||
              ["submitted", "information_requested"].includes(
                data.application.status,
              )
            }
          >
            <WriterApplication application={data.application} act={act} />
          </CreatorDropDown>
          {(data.profile.role === "admin" ||
            data.application?.status === "approved") && (
            <CreatorDropDown label="Create a new article">
              <ArticleForm act={act} />
            </CreatorDropDown>
          )}
          <CreatorDropDown
            label="Your articles"
            count={data.articles.length}
            defaultOpen={data.articles.some((item) =>
              ["submitted", "in_review", "changes_requested"].includes(
                item.status || "",
              ),
            )}
          >
            <Queue title="Your articles" items={data.articles} />
          </CreatorDropDown>
          <CreatorDropDown
            label="Assigned research briefs"
            count={data.briefs.length}
          >
            <Queue
              title="Assigned research briefs"
              items={data.briefs}
              note="Briefs provide sourced direction only. A human editor must approve them before drafting, and articles still require separate review."
            />
          </CreatorDropDown>
        </section>
      )}
      {showCreator && (
        <section id="show-work" className="scroll-mt-24 pt-12">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Shows</p>
          <h2 className="mt-2 text-3xl font-semibold">Programmes and episodes</h2>
          <CreatorDropDown label="Propose a weekly show">
            <ShowForm act={act} />
          </CreatorDropDown>
          <CreatorDropDown
            label="Submit a weekly episode"
            defaultOpen={data.shows.some((show) => show.status === "approved")}
          >
            <EpisodeForm shows={data.shows} token={token} act={act} />
          </CreatorDropDown>
          <CreatorDropDown
            label="Your shows"
            count={data.shows.length}
            defaultOpen={data.shows.some((item) =>
              ["submitted", "in_review", "changes_requested"].includes(
                item.status || "",
              ),
            )}
          >
            <Queue title="Your shows" items={data.shows} />
          </CreatorDropDown>
          <CreatorDropDown
            label="Your episodes"
            count={data.episodes.length}
            defaultOpen={data.episodes.some((item) =>
              ["submitted", "in_review", "changes_requested"].includes(
                item.status || "",
              ),
            )}
          >
            <Queue title="Your episodes" items={data.episodes} />
          </CreatorDropDown>
        </section>
      )}
    </main>
  );
}

function StudioOverview({
  artist,
  producer,
  writer,
  showCreator,
  trackCount,
}: {
  artist: boolean;
  producer: boolean;
  writer: boolean;
  showCreator: boolean;
  trackCount: number;
}) {
  const roles = [artist && "Artist", producer && "Producer", writer && "Writer", showCreator && "Show creator"].filter(Boolean) as string[];
  const tasks = [
    artist && { href: "#artist-upload", eyebrow: "Music", title: "Upload album / EP", copy: "Multi-track artist release from Studio — no need to leave for /upload." },
    artist && { href: "#releases", eyebrow: `${trackCount} track${trackCount === 1 ? "" : "s"}`, title: "Manage releases", copy: "Check decisions, requests, publication and distribution status." },
    producer && { href: "#beat-pack-upload", eyebrow: "Pack / EP", title: "Upload beat pack", copy: "Multi-select 2–20 previews (e.g. 10-pack) without leaving Studio." },
    producer && { href: "#beatstore", eyebrow: "BeatStore", title: "Manage beats", copy: "Track pack and single status, editorial replies and live catalogue." },
    { href: "#marketplace-desk", eyebrow: "Marketplace", title: "Products & services", copy: "Manage listings without mixing commerce with editorial decisions." },
    (artist || producer) && { href: "#insights", eyebrow: "Performance", title: "View insights", copy: "See plays and editorially meaningful performance signals." },
    { href: "/artists", eyebrow: "Money", title: "Wallet & earnings", copy: "Review sales, fees, processing, refunds and payout readiness." },
  ].filter(Boolean) as Array<{ href: string; eyebrow: string; title: string; copy: string }>;

  return <section className="mt-10 scroll-mt-24" aria-labelledby="studio-overview-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Overview</p><h2 id="studio-overview-heading" className="mt-2 text-2xl font-semibold">What do you want to do?</h2></div>
      <div className="flex flex-wrap gap-2" aria-label="Your creator roles">{roles.map(role => <span key={role} className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">{role}</span>)}</div>
    </div>
    <nav className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Studio sections">
      {artist && <Link href="#artist-access" className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Artist access</Link>}
      {artist && <Link href="#artist-upload" className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Upload music</Link>}
      {producer && <Link href="#producer-access" className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Producer</Link>}
      {producer && <Link href="#beat-pack-upload" className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Beat pack</Link>}
      {producer && <Link href="#beatstore" className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">BeatStore</Link>}
      <Link href="#business" className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Business</Link>
      {writer && <Link href="#writer-work" className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Writing</Link>}
      {showCreator && <Link href="#show-work" className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand">Shows</Link>}
    </nav>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tasks.map(task => <Link key={`${task.href}-${task.title}`} href={task.href} className="group rounded-2xl border border-white/10 bg-white/[.025] p-5 transition hover:border-brand/40 hover:bg-brand/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">{task.eyebrow}</span><h3 className="mt-2 text-lg font-semibold group-hover:text-brand">{task.title}</h3><p className="mt-1 text-sm text-text-secondary">{task.copy}</p></Link>)}</div>
  </section>;
}

function CreatorDropDown({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `creator-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.015]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition hover:bg-white/[.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="font-semibold">{label}</span>
          {typeof count === "number" && (
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-text-secondary">
              {count}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
          {open ? "Hide section" : "Show section"}
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="m5 7.5 5 5 5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open && (
        <div id={panelId} className="border-t border-white/10 px-5 pb-6 pt-1">
          {children}
        </div>
      )}
    </section>
  );
}
function WriterApplication({
  application,
  act,
}: {
  application: Data["application"];
  act: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [bio, setBio] = useState(""),
    [portfolio, setPortfolio] = useState(""),
    [beats, setBeats] = useState("Music, Culture");
  if (application)
    return (
      <section className="mt-10 rounded-2xl border border-white/10 p-6">
        <h2 className="text-2xl">Writer application</h2>
        <p className="mt-2 text-brand">
          {application.status.replaceAll("_", " ")}
        </p>
        {application.review_notes && (
          <p className="mt-2 text-sm text-text-secondary">
            Editor: {application.review_notes}
          </p>
        )}
      </section>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void act({
          action: "apply_writer",
          bio,
          portfolioUrl: portfolio,
          beats: beats.split(","),
        });
      }}
      className="mt-10 space-y-3 rounded-2xl border border-white/10 p-6"
    >
      <h2 className="text-2xl">Apply to write</h2>
      <textarea
        required
        minLength={40}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Experience and what you want to cover"
        className={field}
      />
      <input
        value={beats}
        onChange={(e) => setBeats(e.target.value)}
        placeholder="Beats, comma separated"
        className={field}
      />
      <input
        value={portfolio}
        onChange={(e) => setPortfolio(e.target.value)}
        placeholder="Portfolio URL (optional)"
        className={field}
      />
      <button className="rounded-full bg-brand px-5 py-2 font-semibold text-black">
        Submit application
      </button>
    </form>
  );
}
function ArticleForm({
  act,
}: {
  act: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [form, set] = useState({ title: "", dek: "", body: "", sources: "" });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    void act({
      action: "save_article",
      ...form,
      sources: form.sources.split("\n").filter(Boolean),
      submit: submitter.value === "submit",
    });
  };
  return (
    <form
      onSubmit={submit}
      className="mt-10 grid gap-3 rounded-2xl border border-white/10 p-6"
    >
      <h2 className="text-2xl">New article</h2>
      <input
        required
        value={form.title}
        onChange={(e) => set({ ...form, title: e.target.value })}
        placeholder="Headline"
        className={field}
      />
      <input
        value={form.dek}
        onChange={(e) => set({ ...form, dek: e.target.value })}
        placeholder="One-line summary"
        className={field}
      />
      <textarea
        value={form.body}
        onChange={(e) => set({ ...form, body: e.target.value })}
        placeholder="Draft"
        className={`${field} min-h-64`}
      />
      <textarea
        value={form.sources}
        onChange={(e) => set({ ...form, sources: e.target.value })}
        placeholder="Source URLs, one per line"
        className={field}
      />
      <div className="flex gap-3">
        <button
          value="draft"
          className="rounded-full border border-white/20 px-5 py-2"
        >
          Save draft
        </button>
        <button
          value="submit"
          className="rounded-full bg-brand px-5 py-2 font-semibold text-black"
        >
          Submit for review
        </button>
      </div>
    </form>
  );
}
function ShowForm({
  act,
}: {
  act: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [form, set] = useState({
    title: "",
    description: "",
    category: "Music",
    artworkUrl: "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void act({ action: "save_show", ...form, submit: true });
      }}
      className="mt-10 grid gap-3 rounded-2xl border border-white/10 p-6"
    >
      <h2 className="text-2xl">Propose a weekly show</h2>
      <input
        required
        value={form.title}
        onChange={(e) => set({ ...form, title: e.target.value })}
        placeholder="Show title"
        className={field}
      />
      <textarea
        value={form.description}
        onChange={(e) => set({ ...form, description: e.target.value })}
        placeholder="Format, audience and weekly concept"
        className={field}
      />
      <input
        value={form.category}
        onChange={(e) => set({ ...form, category: e.target.value })}
        placeholder="Category"
        className={field}
      />
      <input
        value={form.artworkUrl}
        onChange={(e) => set({ ...form, artworkUrl: e.target.value })}
        placeholder="Artwork URL (optional)"
        className={field}
      />
      <button className="rounded-full bg-brand px-5 py-2 font-semibold text-black">
        Submit show
      </button>
    </form>
  );
}
function EpisodeForm({
  shows,
  token,
  act,
}: {
  shows: ShowItem[];
  token: string;
  act: (b: Record<string, unknown>) => Promise<void>;
}) {
  const approved = shows.filter((s) => s.status === "approved");
  const [showId, setShow] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [uploadProgress, setUploadProgress] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setUploadProgress("Preparing secure upload…");
    try {
      const r = await fetch("/api/creator/episode-upload/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: file.name,
          type: file.type,
          size: file.size,
        }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setUploadProgress("Uploading directly to secure storage…");
      const upload = await fetch(p.slot.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": p.slot.contentType || file.type || "audio/mpeg",
        },
        body: file,
      });
      if (!upload.ok)
        throw new Error(
          "Episode upload failed. Check your connection and try again.",
        );
      setUploadProgress("Submitting for editorial review…");
      await act({
        action: "submit_episode",
        showId,
        title,
        description,
        audioPath: p.slot.path,
      });
      setFile(null);
      setUploadProgress("Episode submitted.");
    } catch (caught) {
      setUploadProgress(
        caught instanceof Error ? caught.message : "Episode upload failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      className="mt-10 grid gap-3 rounded-2xl border border-white/10 p-6"
    >
      <h2 className="text-2xl">Submit a weekly episode</h2>
      <p className="text-sm text-text-secondary">
        Audio uploads directly to secure BVS storage, so large episodes do not
        pass through the website server.
      </p>
      {!approved.length && (
        <p className="text-sm text-amber-200">
          Your show must be approved before episodes can be submitted.
        </p>
      )}
      <select
        required
        value={showId}
        onChange={(e) => setShow(e.target.value)}
        className={field}
      >
        <option value="">Approved show</option>
        {approved.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Episode title"
        className={field}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Episode notes and guest details"
        className={field}
      />
      <input
        required
        type="file"
        accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac,audio/aac,.mp3,.m4a,.wav,.ogg,.flac,.aac"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className={field}
      />
      {uploadProgress && (
        <p className="text-sm text-text-secondary" role="status">
          {uploadProgress}
        </p>
      )}
      <button
        disabled={busy || !approved.length}
        className="rounded-full bg-brand px-5 py-2 font-semibold text-black disabled:opacity-40"
      >
        {busy ? "Uploading…" : "Upload and submit"}
      </button>
    </form>
  );
}
function ArtistPathBoard({ data }: { data: Data }) {
  const flags = data.profileFlags || {
    premiumActive: false,
    premiumUntil: null,
    distributionEnabled: false,
  };
  const releases = data.releases || [];
  const jobs = data.distributionJobs || [];
  const tracks = data.tracks || [];
  const focus = useMemo(() => {
    const release = releases[0];
    const track = tracks[0];
    const job = release
      ? jobs.find((j) => j.release_id === release.id)
      : undefined;
    return { release, track, job };
  }, [releases, tracks, jobs]);
  const steps = buildArtistPathSteps({
    premiumActive: flags.premiumActive,
    distributionEnabled: flags.distributionEnabled,
    hasSubmission: Boolean(focus.release || focus.track),
    bvsStatus: focus.release?.editorial_status || focus.track?.editorial_status,
    isPublic: Boolean(focus.release?.is_public || focus.track?.is_public),
    inRotation: Boolean(focus.release?.in_rotation || focus.track?.in_rotation),
    distroStatus: focus.job?.status,
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <DistributionPathTimeline steps={steps} />
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-brand">
          User story
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          Premium song → BVS → stores
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
          <li>
            Activate{" "}
            <Link href="/artist/premium" className="text-brand hover:underline">
              Artist Premium
            </Link>
            . Paynow is prepaid (resubscribe when it ends). Stripe auto-renews.
          </li>
          <li>
            <Link href="/upload" className="text-brand hover:underline">
              Submit
            </Link>{" "}
            with rights/clearance and ISRCs.
          </li>
          <li>
            BVS editorial approves → live on BVS Radio (free). Rotation does not need Premium.
          </li>
          <li>
            Eligible means BVS can send the pack — it is <strong className="text-text-primary">not</strong> live on Spotify yet.
          </li>
          <li>
            After stores approve, paste Spotify/Apple links and ISRCs on the release card below.
          </li>
        </ol>
        <div className="mt-5 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
          <p>
            <span className="text-text-primary">Premium:</span>{" "}
            {flags.premiumActive ? "active" : "off"}
            {flags.distributionEnabled
              ? " · distribution on"
              : " · distribution off"}
          </p>
          <p className="mt-1">
            <span className="text-text-primary">Focus release:</span>{" "}
            {focus.release?.title || focus.track?.title || "None yet"}
          </p>
          <p className="mt-1">
            <span className="text-text-primary">Platforms:</span>{" "}
            {publicDistributionStatusLabel(focus.job?.status)}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/upload"
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black"
          >
            Submit music
          </Link>
          <Link
            href="/artist/premium"
            className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand"
          >
            Premium
          </Link>
        </div>
      </div>
    </div>
  );
}

function ReleaseStoreLinks({
  token,
  tracks,
}: {
  token: string;
  tracks: Release[];
}) {
  const [drafts, setDrafts] = useState<Record<string, { isrc: string; spotifyUrl: string }>>({});
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  if (!tracks.length) {
    return (
      <p className="mt-3 text-xs text-text-secondary">
        No linked tracks yet — ISRCs and store URLs appear here after publish.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 p-3">
      <p className="text-[11px] uppercase tracking-wide text-brand">Store links (you paste — BVS does not invent them)</p>
      {tracks.map((track) => {
        const draft = drafts[track.id] || {
          isrc: track.isrc || "",
          spotifyUrl: track.spotify_url || "",
        };
        return (
          <form
            key={track.id}
            className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(track.id);
              setNote("");
              try {
                const res = await fetch("/api/creator/distribution-links", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    trackId: track.id,
                    isrc: draft.isrc,
                    spotifyUrl: draft.spotifyUrl,
                  }),
                });
                const payload = await res.json();
                if (!res.ok) throw new Error(payload.error || "Save failed");
                setNote(`Saved ${track.title}`);
              } catch (error) {
                setNote(error instanceof Error ? error.message : "Save failed");
              } finally {
                setBusy("");
              }
            }}
          >
            <p className="md:col-span-3 text-xs text-text-primary">{track.title}</p>
            <input
              value={draft.isrc}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [track.id]: { ...draft, isrc: event.target.value },
                }))
              }
              placeholder="ISRC"
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs"
            />
            <input
              value={draft.spotifyUrl}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [track.id]: { ...draft, spotifyUrl: event.target.value },
                }))
              }
              placeholder="https://open.spotify.com/..."
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={busy === track.id}
              className="rounded-full border border-white/20 px-3 py-2 text-xs hover:border-brand disabled:opacity-40"
            >
              {busy === track.id ? "Saving…" : "Save"}
            </button>
          </form>
        );
      })}
      {note && <p className="text-xs text-text-secondary">{note}</p>}
    </div>
  );
}

function ArtistReleases({
  token,
  tracks,
  requests,
  jobs,
  releases,
  flags,
}: {
  token: string;
  tracks: Release[];
  requests: TrackRequest[];
  jobs: DistJob[];
  releases: AlbumRelease[];
  flags?: ProfileFlags;
}) {
  const jobByRelease = new Map(jobs.map((j) => [j.release_id, j]));
  return (
    <section className="mt-10">
      <div className="grid gap-3 sm:grid-cols-5">
        {[
          ["Uploads", tracks.length],
          ["Published", tracks.filter((t) => t.is_public).length],
          ["In rotation", tracks.filter((t) => t.in_rotation).length],
          ["Album releases", releases.length],
          [
            "Lifetime playback starts",
            tracks.reduce((sum, t) => sum + Number(t.play_count || 0), 0),
          ],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-white/10 p-4"
          >
            <p className="text-xs text-text-secondary">{label}</p>
            <p className="mt-1 text-2xl text-brand">{value}</p>
          </div>
        ))}
      </div>
      {releases.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl">Album / EP path</h2>
          <div className="mt-4 space-y-3">
            {releases.map((release) => {
              const job = jobByRelease.get(release.id);
              return (
                <article
                  key={release.id}
                  className="rounded-xl border border-white/10 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{release.title}</h3>
                      <p className="mt-1 text-xs capitalize text-text-secondary">
                        {release.release_type || "release"} ·{" "}
                        {release.editorial_status.replaceAll("_", " ")} ·{" "}
                        {release.is_public ? "on BVS" : "not public"} ·{" "}
                        {release.in_rotation
                          ? "in rotation"
                          : "not in rotation"}
                      </p>
                    </div>
                    <p className="max-w-xs text-right text-xs text-brand">
                      {publicDistributionStatusLabel(job?.status)}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    {job?.notes ? String(job.notes).slice(0, 240) : "No store-delivery notes yet."}
                  </p>
                  <ReleaseStoreLinks
                    token={token}
                    tracks={tracks.filter((t) => t.release_id === release.id)}
                  />
                  {release.editorial_notes && (
                    <p className="mt-3 text-sm text-text-secondary">
                      Editor: {release.editorial_notes}
                    </p>
                  )}
                  {!(flags?.premiumActive && flags?.distributionEnabled) &&
                    release.is_public && (
                      <p className="mt-3 text-xs text-amber-100">
                        Live on BVS. Multi-platform needs active Artist Premium.
                      </p>
                    )}
                </article>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          <h2 className="text-2xl">Your tracks</h2>
          <div className="mt-4 space-y-3">
            {tracks.map((track) => (
              <article
                key={track.id}
                className="rounded-xl border border-white/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{track.title}</h3>
                    <p className="mt-1 text-xs capitalize text-text-secondary">
                      {track.genre || "Music"} ·{" "}
                      {track.editorial_status.replaceAll("_", " ")} ·{" "}
                      {track.is_public ? "published" : "not public"} ·{" "}
                      {track.in_rotation ? "in rotation" : "not in rotation"}
                    </p>
                    {(track.isrc || track.spotify_url) && (
                      <p className="mt-2 text-xs text-text-secondary">
                        {track.isrc ? `ISRC ${track.isrc}` : ""}
                        {track.isrc && track.spotify_url ? " · " : ""}
                        {track.spotify_url ? "Linked on Spotify" : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-text-secondary">
                    <p className="text-lg text-brand">
                      {Number(track.play_count || 0)}
                    </p>
                    <p>playback starts</p>
                  </div>
                </div>
                {track.editorial_notes && (
                  <p className="mt-3 text-sm text-text-secondary">
                    Editor: {track.editorial_notes}
                  </p>
                )}
                <p className="mt-3 text-xs text-text-secondary">
                  {track.is_downloadable
                    ? `${track.licence_type.replaceAll("_", " ")} · $${Number(track.download_price || 0).toFixed(2)}`
                    : "Not available for download sale"}
                </p>
              </article>
            ))}
            {!tracks.length && (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">
                Your uploaded tracks and review status will appear here after
                submission.
              </p>
            )}
          </div>
        </div>
        <div>
          <ArtworkChangeRequestForm
            token={token}
            scope="releases"
            heading="Request a change"
            copy="Select any of your tracks or albums, upload a new cover, and editorial will approve it before it goes live."
          />
          {requests.length > 0 && (
            <div className="mt-3 space-y-2">
              {requests.slice(0, 5).map((item) => (
                <p
                  key={item.id}
                  className="rounded-lg border border-white/10 p-3 text-xs text-text-secondary"
                >
                  {item.request_type.replaceAll("_", " ")} · {item.status} ·{" "}
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function Queue({
  title,
  items,
  note,
}: {
  title: string;
  items: WorkflowItem[];
  note?: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl">{title}</h2>
      {note && (
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">{note}</p>
      )}
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-white/10 p-4"
          >
            <div className="flex justify-between gap-4">
              <h3 className="font-medium">{item.title || item.topic}</h3>
              <span className="text-xs uppercase text-brand">
                {item.status?.replaceAll("_", " ")}
              </span>
            </div>
            {(item.editor_notes || item.review_notes) && (
              <p className="mt-2 text-sm text-text-secondary">
                Editor: {item.editor_notes || item.review_notes}
              </p>
            )}
            {item.scheduled_for && (
              <p className="mt-2 text-xs text-text-secondary">
                Scheduled {new Date(item.scheduled_for).toLocaleString()}
              </p>
            )}
          </article>
        ))}
        {!items.length && (
          <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">
            Nothing here yet.
          </p>
        )}
      </div>
    </section>
  );
}
