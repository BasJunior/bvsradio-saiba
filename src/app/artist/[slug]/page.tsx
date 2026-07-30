import Link from "next/link";
import Image from "next/image";
import LibraryAction from "@/components/LibraryAction";
import ShareCreatorButton from "@/components/ShareCreatorButton";

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
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 md:w-80">
          <Image
            src={profile.image}
            alt={profile.name}
            fill
            unoptimized={/^https?:\/\//i.test(profile.image)}
            className="object-cover"
            priority
          />
        </div>
        <div className="flex-1">
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
                className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand"
              >
                Spotify / DSP
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
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
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
                    className="flex gap-4 rounded-xl border border-white/10 p-3"
                  >
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
                        <Link
                          href={`/catalogue?q=${encodeURIComponent(track.title)}`}
                          className="shrink-0 text-sm text-brand"
                        >
                          Open →
                        </Link>
                      </div>
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
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-secondary">
                No tracks have been published for this artist yet.
              </p>
            )}
          </section>
          {profile.beats && profile.beats.length > 0 && (
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-brand">
                    Producer BeatStore
                  </p>
                  <h2 className="mt-1 text-xl">Published beats</h2>
                </div>
                <span className="text-sm text-text-secondary">
                  {profile.beats.length} beats
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {profile.beats.map((beat) => (
                  <article
                    key={beat.id}
                    className="flex items-center gap-4 rounded-xl border border-white/10 p-3"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">
                      {beat.artwork_url && (
                        <Image
                          src={beat.artwork_url}
                          alt=""
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{beat.title}</h3>
                      <p className="text-xs text-text-secondary">
                        {beat.genre || "Beat"} · Licence from $
                        {Number(beat.starting_price || 29).toFixed(2)}
                      </p>
                    </div>
                    <Link
                      href={`/catalogue?type=beat&q=${encodeURIComponent(beat.title)}#beatstore`}
                      className="text-sm text-brand"
                    >
                      Open →
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
