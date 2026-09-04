import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryAction from "@/components/LibraryAction";
import AppPlaylistPicker from "@/components/app-vnext/AppPlaylistPicker";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import type { DiscoveryItem } from "@/lib/discovery";
import { getPublicArtist } from "@/lib/artist-content";

export const dynamic = "force-dynamic";

export default async function AppCreatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string; slug: string }>;
  searchParams?: Promise<{ as?: string | string[] }>;
}) {
  const { surface, slug } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  const profile = await getPublicArtist(slug.toLowerCase());
  if (!profile) notFound();
  const asRaw = searchParams ? (await searchParams).as : undefined;
  const as = String(Array.isArray(asRaw) ? asRaw[0] : asRaw || "").toLowerCase();
  const producerContext = as === "producer" && Boolean(profile.beats?.length);
  const displayName = profile.name;
  const item: DiscoveryItem = {
    id: `artist-${profile.id}`,
    kind: "artist",
    title: displayName,
    subtitle: profile.role,
    href: `/app/${surface}/creator/${profile.username}${producerContext ? "?as=producer" : ""}`,
    image: profile.image,
  };
  const credits = new Map<string, Set<string>>();
  for (const track of profile.tracks) {
    for (const credit of track.credits || []) {
      if (!credits.has(credit.person_name)) credits.set(credit.person_name, new Set());
      credits.get(credit.person_name)?.add(credit.credit_role);
    }
  }
  const appSurface = surface as AppSurface;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <Link href={`/app/${surface}/explore`} className="text-sm text-text-secondary">← Explore</Link>
      <section className="mt-5 grid gap-6 sm:grid-cols-[220px,1fr] sm:items-start">
        <div className="relative aspect-square overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/5">
          <Image src={profile.image} alt={displayName} fill unoptimized={/^https?:\/\//i.test(profile.image)} className="object-cover" priority />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-brand">Verified {producerContext ? "producer" : profile.role}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{displayName}</h1>
          {profile.location ? <p className="mt-2 text-sm text-text-secondary">{profile.location}</p> : null}
          <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary">{profile.bio}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LibraryAction item={item} section="follows" />
            <AppShareButton title={displayName} text={`Follow ${displayName} on BVS`} path={`/app/${surface}/creator/${profile.username}${producerContext ? "?as=producer" : ""}`} />
            {profile.beats?.length && !producerContext ? (
              <Link href={`/app/${surface}/creator/${profile.username}?as=producer`} className="min-h-10 rounded-full border border-brand/35 px-4 py-2 text-sm text-brand">Producer view</Link>
            ) : null}
            {producerContext && profile.tracks.length ? (
              <Link href={`/app/${surface}/creator/${profile.username}`} className="min-h-10 rounded-full border border-brand/35 px-4 py-2 text-sm text-brand">Artist view</Link>
            ) : null}
          </div>
        </div>
      </section>

      {profile.tracks.length ? (
        <section className="mt-9">
          <p className="text-xs uppercase tracking-[.18em] text-brand">Music</p>
          <h2 className="mt-1 text-2xl font-semibold">Published on BVS</h2>
          <div className="mt-4 space-y-2">
            {profile.tracks.map((track) => (
              <article key={track.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-3">
                {track.artwork_url ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <Image src={track.artwork_url} alt="" fill unoptimized className="object-cover" />
                  </div>
                ) : (
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-xs text-brand">BVS</div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{track.title}</h3>
                  <p className="mt-1 text-xs text-text-secondary">{track.genre || "BVS release"}{track.in_rotation ? " · In rotation" : ""}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AppPlaylistPicker trackId={track.id} compact />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {profile.beats?.length ? (
        <section className="mt-9">
          <p className="text-xs uppercase tracking-[.18em] text-brand">BeatStore</p>
          <h2 className="mt-1 text-2xl font-semibold">Beats by {displayName}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {profile.beats.map((beat) => (
              <Link key={beat.id} href={`/app/${surface}/beat/${beat.id}`} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 hover:border-brand/30">
                <h3 className="font-semibold">{beat.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{beat.genre || "Beat"}{typeof beat.starting_price === "number" ? ` · from $${beat.starting_price.toFixed(2)}` : ""}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {credits.size ? (
        <section className="mt-9 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5">
          <p className="text-xs uppercase tracking-[.18em] text-brand">Credits</p>
          <h2 className="mt-1 text-2xl font-semibold">People connected through the music.</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from(credits.entries()).map(([name, roles]) => (
              <span key={name} className="rounded-full border border-white/10 px-3 py-2 text-sm">
                <b>{name}</b>
                <span className="text-text-secondary"> · {Array.from(roles).join(", ")}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-9 rounded-2xl border border-white/10 p-4 text-sm text-text-secondary">
        App surface: {appSurface === "ios" ? "iOS" : "Android"}. Follow, playlists and sharing stay inside the BVS app.
      </div>
    </div>
  );
}
