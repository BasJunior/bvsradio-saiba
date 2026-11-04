import CreatorTrackConnections from "@/components/CreatorTrackConnections";
import CreatorAchievementBadges from "@/components/CreatorAchievementBadges";
import CreatorProfileArtwork from "@/components/CreatorProfileArtwork";
import "./profile.css";
import Link from "next/link";
import type { Metadata } from "next";
import LibraryAction from "@/components/LibraryAction";
import AppCreatorPlayback from "@/components/app-vnext/AppCreatorPlayback";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import FlowRelationships from "@/components/flow/FlowRelationships";

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
  const hasPlayableIdentity = /^[0-9a-f-]{36}$/i.test(profile.id);
  return (
    <main className="bvs-artist-profile bvs-creator-profile mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/music/artists" className="text-sm text-brand">
        ← All BVS creators
      </Link>
      <div className="creator-profile-hero mt-6 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
        <div className="creator-profile-portrait relative aspect-square w-40 shrink-0 self-start overflow-hidden border border-white/15 bg-black/40 md:w-full">
          <CreatorProfileArtwork src={profile.image} name={profile.name} priority />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.25em] text-brand">
            Verified {profile.role}
          </p>
          <h1 className="creator-profile-name mt-3">{profile.name}</h1>
          <CreatorAchievementBadges creatorId={profile.id} />
          {profile.location && (
            <p className="mt-3 text-sm text-brand">{profile.location}</p>
          )}
          {profile.bio ? <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">{profile.bio.length > 180 ? `${profile.bio.slice(0, 177).trimEnd()}…` : profile.bio} <a href="#about" className="ml-1 font-semibold text-brand hover:underline">About {profile.name} ↗</a></p> : null}
          {hasMusic && hasPlayableIdentity ? (
            <div className="mt-6">
              <AppCreatorPlayback creatorId={profile.id} creatorName={profile.name} />
            </div>
          ) : null}
          <div className="creator-profile-actions mt-4 flex flex-wrap gap-2">
            <LibraryAction item={item} section="follows" analyticsSource="artist_profile" />
            {profile.beats && profile.beats.length > 0 && (
              <Link
                href={`/catalogue?type=beat&producer=${encodeURIComponent(profile.username)}#browse`}
                className="border border-purple-200/40 px-4 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-200/10"
              >
                Browse all beats ↗
              </Link>
            )}
            <AppShareButton
              title={profile.name}
              text={`Follow ${profile.name} on BVS`}
              path={`/artist/${encodeURIComponent(profile.username)}`}
              image={profile.image}
              kicker={`Verified ${profile.role}`}
            />

          </div>
          {profile.joinedAt && (
            <p className="mt-4 text-xs text-text-secondary">
              BVS member since {new Date(profile.joinedAt).toLocaleDateString()}
            </p>
          )}

        </div>
      </div>

          <nav className="creator-profile-tabs mt-8 flex gap-2 overflow-x-auto pb-1 text-sm" aria-label="Creator profile sections" data-flow-scroll-key={`creator-tabs:${profile.id}`}>
            {producerFirst ? <a href="#beats" className="shrink-0 rounded-full border border-brand/35 bg-brand/10 px-4 py-2 text-brand">Beats</a> : null}
            {hasMusic ? <a href="#music" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Music</a> : null}
            {hasConnections ? <a href="#connections" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Credits & Connections</a> : null}
            {hasBeats && !producerFirst ? <a href="#beats" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Beats</a> : null}
            <a href="#about" className="shrink-0 border border-white/10 px-4 py-2 hover:text-brand">About</a>
          </nav>

          {producerFirst ? <section id="beats" className="scroll-mt-24"><FlowRelationships kind="creator" id={profile.id} view="beats" /></section> : null}

          {hasMusic ? <section id="music" className="mt-8 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand">
                  BVS catalogue
                </p>
                <h2 className="mt-1 text-xl">Published music</h2>
              </div>
              <span className="text-sm text-text-secondary">
                {profile.tracks.length}{" "}
                {profile.tracks.length === 1 ? "track" : "tracks"}
              </span>
            </div>
            {profile.tracks.length ? (
              <div className="creator-profile-tracks mt-4 space-y-4">
                {profile.tracks.map((track) => (
                  <article
                    key={track.id}
                    id={`track-${track.id}`}
                    className="scroll-mt-24 rounded-xl border border-white/10 p-3"
                    data-flow-focus-id={`track:${track.id}`}
                    tabIndex={-1}
                  >
                    <div className="flex gap-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/5">
                        <CreatorProfileArtwork src={track.artwork_url || undefined} name={track.title} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">
                              {track.title}
                            </h3>
                            <p className="text-xs text-text-secondary">
                              {track.artist_name || track.genre || "Music"}
                              {track.in_rotation ? " · In BVS rotation" : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {track.spotify_url && (
                              <a
                                href={external(track.spotify_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-brand"
                              >
                                Spotify →
                              </a>
                            )}
                            {track.external_url ? <a href={external(track.external_url)} target="_blank" rel="noreferrer" className="text-sm text-brand">Open stream ↗</a> : null}
                            <Link
                              href={`/catalogue?q=${encodeURIComponent(track.title)}`}
                              className="text-sm text-brand"
                            >
                              Open →
                            </Link>
                          </div>
                        </div>
                        {hasPlayableIdentity && /^[0-9a-f-]{36}$/i.test(track.id) ? (
                          <div className="mt-2">
                            <AppCreatorPlayback creatorId={profile.id} creatorName={profile.name} startTrackId={track.id} compact />
                          </div>
                        ) : null}
                        {(track.isrc || track.spotify_url) && (
                          <p className="mt-2 text-xs text-text-secondary">
                            {track.isrc ? `ISRC ${track.isrc}` : "DSP linked"}
                            {track.isrc && track.spotify_url ? " · " : ""}
                            {track.spotify_url ? "Also on Spotify" : ""}
                          </p>
                        )}
                        {track.credits.length > 0 && (
                          <p className="mt-3 border-t border-white/10 pt-2 text-xs text-text-secondary">
                            Verified credits:{" "}
                            {track.credits.map((credit, index) => (
                              <span key={`${credit.person_name}-${credit.credit_role}-${index}`}>
                                {index > 0 ? " · " : ""}
                                {credit.profile_url?.startsWith("/artist/") ? <Link href={credit.profile_url} className="text-brand hover:underline">{credit.person_name}</Link> : credit.person_name}
                                {` — ${credit.credit_role}`}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                    {/^[0-9a-f-]{36}$/i.test(track.id) ? <CreatorTrackConnections trackId={track.id} /> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-secondary">
                No tracks have been published for this artist yet.
              </p>
            )}
          </section> : null}

          {hasConnections ? <section id="connections" className="scroll-mt-24"><FlowRelationships kind="creator" id={profile.id} view="connections" /></section> : null}
          {hasBeats && !producerFirst ? <section id="beats" className="scroll-mt-24"><FlowRelationships kind="creator" id={profile.id} view="beats" /></section> : null}
      <section id="about" className="creator-profile-about scroll-mt-28" aria-labelledby="creator-about-title">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Behind the sound</p><h2 id="creator-about-title" className="mt-2 text-3xl font-bold">About {profile.name}</h2>{profile.location ? <p className="mt-3 text-sm text-white/50">{profile.location}</p> : null}</div>
        <div><p className="whitespace-pre-line text-sm leading-7 text-white/65">{profile.bio || 'Discover this creator through their published work on BVS.'}</p><div className="mt-5 flex flex-wrap gap-2">            {profile.links?.instagram && (
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
            )}</div></div>
      </section>
    </main>
  );
}
