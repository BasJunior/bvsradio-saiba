import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import LibraryAction from "@/components/LibraryAction";
import ShareCreatorButton from "@/components/ShareCreatorButton";
import FlowRelationships from "@/components/flow/FlowRelationships";
import CreatorActivity from "@/components/flow/CreatorActivity";
import ArtistProfileMusic from "@/components/ArtistProfileMusic";
import ArtistProfileBeats from "@/components/ArtistProfileBeats";
import { flowV2Flags } from "@/lib/feature-flags";

function external(value: string) {
  return /^https?:\/\//i.test(value)
    ? value
    : `https://${value.replace(/^\/+/, "")}`;
}
import type { DiscoveryItem } from "@/lib/discovery";
import { getPublicArtist } from "@/lib/artist-content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const profile = await getPublicArtist((await params).slug.toLowerCase());
  if (!profile) return { title: "Creator profile" };
  const description = `${profile.role} on BVS Radio. ${profile.bio}`.slice(0, 180);
  return { title: profile.name, description, openGraph: { title: `${profile.name} | BVS Radio`, description, images: profile.image && !profile.image.includes("default-avatar") ? [profile.image] : ["/logo.png"] } };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug.toLowerCase();
  const profile = await getPublicArtist(slug);
  if (!profile)
    return (
      <main className="mx-auto min-h-[65vh] max-w-3xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-brand">
          Artist profiles
        </p>
        <h1 className="mt-3 text-4xl">This profile is not published yet</h1>
        <p className="mx-auto mt-4 max-w-xl text-text-secondary">
          BVS publishes artist pages only after editorial verification. We won’t
          fill the gap with invented tracks, numbers or credits.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/catalogue"
            className="rounded-full bg-brand px-5 py-2 font-semibold text-black"
          >
            Browse music
          </Link>
          <Link
            href="/upload"
            className="rounded-full border border-white/20 px-5 py-2"
          >
            Submit music
          </Link>
        </div>
      </main>
    );

  const item: DiscoveryItem = {
    id: `artist-${profile.id}`,
    kind: "artist",
    title: profile.name,
    subtitle: profile.role,
    href: `/artist/${profile.username}`,
    image: profile.image,
  };
  const hasMusic = profile.tracks.length > 0;
  const hasConnections = profile.tracks.some(track => track.credits.length > 0);
  const hasBeats = Boolean(profile.beats?.length);
  const producerFirst = /producer/i.test(profile.role) && hasBeats;
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/music/artists" className="text-sm text-brand">
        ← All BVS creators
      </Link>
      <div className="mt-8 flex flex-col gap-10 md:flex-row">
        <div className="relative aspect-square w-full shrink-0 self-start overflow-hidden rounded-2xl border border-white/10 bg-black/40 md:h-80 md:w-80">
          <Image
            src={profile.image}
            alt={profile.name}
            fill
            unoptimized={/^https?:\/\//i.test(profile.image)}
            sizes="(max-width:768px) 100vw, 320px"
            className="object-cover object-center"
            priority
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.25em] text-brand">
            Verified {profile.role}
          </p>
          <h1 className="mt-2 text-5xl">{profile.name}</h1>
          {profile.location && (
            <p className="mt-3 text-sm text-brand">{profile.location}</p>
          )}
          <p className="mt-5 max-w-prose text-text-secondary">{profile.bio}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LibraryAction item={item} section="follows" />
            {profile.beats && profile.beats.length > 0 && (
              <Link
                href={`/catalogue?type=beat&producer=${encodeURIComponent(profile.username)}#browse`}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black hover:bg-brand-dark"
              >
                View producer catalogue
              </Link>
            )}
            <ShareCreatorButton name={profile.name} />
            {profile.links?.instagram && (
              <a
                href={
                  profile.links.instagram.startsWith("http")
                    ? profile.links.instagram
                    : `https://instagram.com/${profile.links.instagram.replace(/^@/, "")}`
                }
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand"
              >
                Instagram
              </a>
            )}
            {profile.links?.spotify && (
              <a
                href={external(profile.links.spotify)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/20"
              >
                Listen on Spotify
              </a>
            )}
            {profile.links?.website && (
              <a
                href={external(profile.links.website)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand"
              >
                Official site
              </a>
            )}
          </div>
          {profile.joinedAt && (
            <p className="mt-4 text-xs text-text-secondary">
              BVS member since {new Date(profile.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}

          <nav className="mt-8 flex gap-2 overflow-x-auto pb-1 text-sm" aria-label="Creator profile sections" data-flow-scroll-key={`creator-tabs:${profile.id}`}>
            {producerFirst ? <a href="#beats" className="shrink-0 rounded-full border border-brand/35 bg-brand/10 px-4 py-2 text-brand">Beats</a> : null}
            {hasMusic ? <a href="#music" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Music</a> : null}
            {hasConnections ? <a href="#connections" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Credits & Connections</a> : null}
            {hasBeats && !producerFirst ? <a href="#beats" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Beats</a> : null}
          </nav>

          {producerFirst && profile.beats ? <ArtistProfileBeats artist={profile.name} username={profile.username} beats={profile.beats} /> : null}

          {hasMusic ? <ArtistProfileMusic artist={profile.name} username={profile.username} tracks={profile.tracks} /> : null}

          {flowV2Flags.pulse ? <CreatorActivity creatorId={profile.id} /> : null}

          {hasConnections ? <section id="connections" className="scroll-mt-24"><FlowRelationships kind="creator" id={profile.id} view="connections" /></section> : null}
          {hasBeats && !producerFirst && profile.beats ? <ArtistProfileBeats artist={profile.name} username={profile.username} beats={profile.beats} /> : null}
        </div>
      </div>
    </div>
  );
}
