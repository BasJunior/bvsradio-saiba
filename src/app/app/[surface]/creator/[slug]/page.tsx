import CreatorAchievementBadges from "@/components/CreatorAchievementBadges";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryAction from "@/components/LibraryAction";
import AppCreatorPlayback from "@/components/app-vnext/AppCreatorPlayback";
import AppPlaylistPicker from "@/components/app-vnext/AppPlaylistPicker";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import DetailHero, { DetailSection } from "@/components/DetailHero";
import type { DiscoveryItem } from "@/lib/discovery";
import { getPublicArtist, getPublishedArtists, getPublishedProducers, getPublishedUsernameById } from "@/lib/artist-content";

export const dynamic = "force-dynamic";

function creatorKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function decodedSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function AppCreatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string; slug: string }>;
  searchParams?: Promise<{ as?: string | string[] }>;
}) {
  const { surface, slug } = await params;
  if (surface !== "ios" && surface !== "android") notFound();

  const routeValue = decodedSegment(slug);
  const routeKey = creatorKey(routeValue);
  const [artistSummaries, producerSummaries] = await Promise.all([getPublishedArtists(), getPublishedProducers()]);
  const knownCreator = [...artistSummaries, ...producerSummaries].find(
    (creator) => creator.id === routeValue || creatorKey(creator.username) === routeKey,
  );
  const handle = knownCreator?.username || (await getPublishedUsernameById(routeValue)) || routeValue;
  const profile = await getPublicArtist(handle.toLowerCase());
  if (!profile) notFound();

  const asRaw = searchParams ? (await searchParams).as : undefined;
  const as = String(Array.isArray(asRaw) ? asRaw[0] : asRaw || "").toLowerCase();
  const hasProducerCatalogue = Boolean(profile.beats?.length);
  const producerContext = as === "producer" && hasProducerCatalogue;
  const displayName = profile.name;
  const creatorPath = `/app/${surface}/creator/${encodeURIComponent(profile.id)}`;
  const item: DiscoveryItem = {
    id: `artist-${profile.id}`,
    kind: "artist",
    title: displayName,
    subtitle: profile.role,
    href: `${creatorPath}${producerContext ? "?as=producer" : ""}`,
    image: profile.image,
  };

  const credits = new Map<string, Set<string>>();
  for (const track of profile.tracks) {
    for (const credit of track.credits || []) {
      if (creatorKey(credit.person_name) === creatorKey(profile.name)) continue;
      if (!credits.has(credit.person_name)) credits.set(credit.person_name, new Set());
      credits.get(credit.person_name)?.add(credit.credit_role);
    }
  }

  const roleLabel = producerContext ? "Producer" : profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "Artist";

  return (
    <main className="bvs-app-page bvs-detail-page mx-auto max-w-5xl px-4 pb-14 sm:px-6" data-app-accent={producerContext ? "beats" : "lime"}>
      <DetailHero
        image={profile.image}
        imageAlt={displayName}
        eyebrow={`Verified ${roleLabel.toLowerCase()}`}
        title={displayName}
        subtitle={profile.location || undefined}
        facts={[profile.tracks.length ? `${profile.tracks.length} song${profile.tracks.length === 1 ? "" : "s"}` : null, profile.beats?.length ? `${profile.beats.length} beat${profile.beats.length === 1 ? "" : "s"}` : null]}
        actions={<>
          {profile.tracks.length ? <AppCreatorPlayback creatorId={profile.id} creatorName={displayName} surface={surface} /> : null}
          <LibraryAction item={item} section="follows" analyticsSource="artist_profile" />
          <AppShareButton
            title={displayName}
            text={`Follow ${displayName} on BVS`}
            path={`/artist/${encodeURIComponent(profile.username)}`}
            image={profile.image}
            kicker={`Verified ${roleLabel.toLowerCase()}`}
          />
        </>}
      />
      <div className="flex justify-center sm:justify-start"><CreatorAchievementBadges creatorId={profile.id} /></div>

      {hasProducerCatalogue && profile.tracks.length ? (
        <nav className="mt-4 flex gap-2" aria-label="Profile view">
          <Link href={creatorPath} aria-pressed={!producerContext} className="bvs-app-chip">Music</Link>
          <Link href={`${creatorPath}?as=producer`} aria-pressed={producerContext} className="bvs-app-chip">Beats</Link>
        </nav>
      ) : null}

      {profile.tracks.length && !producerContext ? (
        <DetailSection title="Songs" id="creator-songs-heading" action={<span className="text-xs text-white/45">{profile.tracks.length}</span>}>
          <ol>
            {profile.tracks.map((track, index) => (
              <li key={track.id} className="bvs-app-row flex items-center gap-3 py-2.5">
                <span className="w-5 shrink-0 text-center text-sm tabular-nums text-white/40">{index + 1}</span>
                {track.artwork_url ? (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden"><Image src={track.artwork_url} alt="" fill unoptimized className="object-cover" /></div>
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center bg-white/5 text-[10px] text-white/40">BVS</div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-semibold">{track.title}</h3>
                  <p className="truncate text-[13px] text-white/50">{[track.genre, track.in_rotation ? "On BVS Radio" : null].filter(Boolean).join(" · ") || "Single"}</p>
                  {track.credits?.length ? <p className="truncate text-[11px] text-white/35">{track.credits.map((credit) => `${credit.credit_role}: ${credit.person_name}`).join(" · ")}</p> : null}
                </div>
                <div className="bvs-row-actions flex shrink-0 items-center gap-1">
                  <AppCreatorPlayback creatorId={profile.id} creatorName={displayName} surface={surface} startTrackId={track.id} compact />
                  <AppPlaylistPicker trackId={track.id} compact />
                  {track.spotify_url ? <a href={track.spotify_url} target="_blank" rel="noreferrer" aria-label={`${track.title} on streaming services`} className="bvs-app-icon-button text-xs font-semibold">↗</a> : null}
                </div>
              </li>
            ))}
          </ol>
        </DetailSection>
      ) : null}

      {profile.beats?.length && (producerContext || !profile.tracks.length) ? (
        <DetailSection title={`Beats by ${displayName}`} id="creator-beats-heading">
          <div>
            {profile.beats.map((beat) => (
              <Link key={beat.id} href={`/app/${surface}/beat/${beat.id}`} className="bvs-app-row flex items-center justify-between gap-3 py-3">
                <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{beat.title}</span><span className="block text-[13px] text-white/50">{beat.genre || "Beat"}</span></span>
                {typeof beat.starting_price === "number" ? <span className="shrink-0 text-sm font-semibold text-[#c1a7ff]">From ${beat.starting_price.toFixed(2)}</span> : <span aria-hidden="true" className="text-white/35">›</span>}
              </Link>
            ))}
          </div>
        </DetailSection>
      ) : null}

      {profile.bio ? <DetailSection title="About" id="creator-about-heading"><p className="max-w-2xl text-sm leading-6 text-white/65">{profile.bio}</p></DetailSection> : null}

      {credits.size ? (
        <DetailSection title="Worked with" id="creator-credits-heading">
          <div className="flex flex-wrap gap-2">
            {Array.from(credits.entries()).map(([name, roles]) => (
              <span key={name} className="border border-white/12 px-3 py-2 text-sm"><b>{name}</b><span className="text-white/50"> · {Array.from(roles).join(", ")}</span></span>
            ))}
          </div>
        </DetailSection>
      ) : null}
    </main>
  );
}
