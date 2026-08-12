import Image from "next/image";
import Link from "next/link";
import LibraryAction from "@/components/LibraryAction";
import ShareCreatorButton from "@/components/ShareCreatorButton";
import FlowRelationships from "@/components/flow/FlowRelationships";

function external(value: string) {
  return /^https?:\/\//i.test(value)
    ? value
    : `https://${value.replace(/^\/+/, "")}`;
}
import type { DiscoveryItem } from "@/lib/discovery";
import { getPublicArtist } from "@/lib/artist-content";

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
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/music/artists" className="text-sm text-brand">
        ← All BVS creators
      </Link>
      <div className="mt-8 flex flex-col gap-10 md:flex-row">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 md:w-80">
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
              BVS member since {new Date(profile.joinedAt).toLocaleDateString()}
            </p>
          )}

          <nav className="mt-8 flex gap-2 overflow-x-auto pb-1 text-sm" aria-label="Creator profile sections" data-flow-scroll-key={`creator-tabs:${profile.id}`}>
            <a href="#music" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Music</a>
            <a href="#connections" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Connections</a>
            {profile.beats?.length ? <a href="#connections" className="shrink-0 rounded-full border border-white/10 px-4 py-2 hover:border-brand/40 hover:text-brand">Beats</a> : null}
          </nav>

          <section id="music" className="mt-8 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
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
              <div className="mt-4 space-y-4">
                {profile.tracks.map((track) => (
                  <article
                    key={track.id}
                    className="rounded-xl border border-white/10 p-3"
                    data-flow-focus-id={`track:${track.id}`}
                    tabIndex={-1}
                  >
                    <div className="flex gap-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/5">
                        {track.artwork_url && (
                          <Image
                            src={track.artwork_url}
                            alt=""
                            fill
                            unoptimized={/^https?:\/\//i.test(track.artwork_url)}
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">
                              {track.title}
                            </h3>
                            <p className="text-xs text-text-secondary">
                              {track.genre || "Music"}
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
                            <Link
                              href={`/catalogue?q=${encodeURIComponent(track.title)}`}
                              className="text-sm text-brand"
                            >
                              Open →
                            </Link>
                          </div>
                        </div>
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
                            {track.credits
                              .map(
                                (credit) =>
                                  `${credit.person_name} — ${credit.credit_role}`,
                              )
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <FlowRelationships kind="track" id={track.id} compact />
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-secondary">
                No tracks have been published for this artist yet.
              </p>
            )}
          </section>

          <section id="connections" className="scroll-mt-24">
            <FlowRelationships kind="creator" id={profile.id} />
          </section>
        </div>
      </div>
    </main>
  );
}
