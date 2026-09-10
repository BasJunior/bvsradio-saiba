import "server-only";

import type { AppSurface } from "@/lib/app-surface";
import type { BvsObject } from "@/lib/bvs-object";
import type { DiscoveryItem } from "@/lib/discovery";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import { creatorPublicName } from "@/lib/public-name";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import { listPublishedBeats, publicStorageUrl } from "@/lib/beatstore-server";
import { storefrontSlug } from "@/lib/marketplace-storefronts";

export type BvsFeedCategory = "music" | "creator" | "beat" | "live" | "marketplace";
export type BvsFeedFilter = "all" | BvsFeedCategory;

export type BvsFeedItem = {
  id: string;
  category: BvsFeedCategory;
  verb: string;
  occurredAt: string;
  object: BvsObject;
  social?: {
    section: "favourites" | "follows";
    item: DiscoveryItem;
  };
};

type PublicProfile = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  is_producer?: boolean | null;
  creator_public_name?: string | null;
  creator_name_status?: string | null;
  created_at?: string | null;
};

type TrackRow = {
  id: string;
  user_id?: string | null;
  title: string;
  artist_name?: string | null;
  file_url?: string | null;
  artwork_url?: string | null;
  genre?: string | null;
  release_id?: string | null;
  rotation_added_at?: string | null;
  created_at?: string | null;
};

type ReleaseRow = {
  id: string;
  user_id?: string | null;
  title: string;
  artist_name?: string | null;
  genre?: string | null;
  cover_url?: string | null;
  release_type?: string | null;
  track_count?: number | null;
  published_at?: string | null;
  created_at?: string | null;
};

type ProgrammeRow = {
  id: string;
  slug: string;
  title: string;
  tagline?: string | null;
  image_url?: string | null;
  host?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type ShowEventRow = {
  id: string;
  programme_slug: string;
  title: string;
  status?: string | null;
  starts_at?: string | null;
  updated_at?: string | null;
};

type MarketplaceListingRow = {
  id: string;
  seller_user_id: string;
  listing_type: "service" | "digital_product" | string;
  category?: string | null;
  title: string;
  description?: string | null;
  price_usd?: number | string | null;
  artwork_path?: string | null;
  published_at?: string | null;
  profiles?: {
    username?: string | null;
    display_name?: string | null;
    creator_public_name?: string | null;
    creator_name_status?: string | null;
    avatar_url?: string | null;
  } | null;
};

function firstPartyForApp(value?: string | null) {
  const resolved = mediaUrlForStoredValue(value);
  return resolved && resolved.startsWith("/") ? resolved : undefined;
}

function publicMedia(value?: string | null, surface?: AppSurface) {
  return surface ? firstPartyForApp(value) : mediaUrlForStoredValue(value) || undefined;
}

async function rows<T>(path: string): Promise<T[]> {
  try {
    const response = await fetch(creatorUrl(path), {
      headers: creatorHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload as T[] : [];
  } catch {
    return [];
  }
}

function creatorRoute(profile: PublicProfile | undefined, surface?: AppSurface) {
  const username = String(profile?.username || "").trim();
  if (!username) return surface ? `/app/${surface}/explore?kind=artists` : "/search?type=artists";
  return surface
    ? `/app/${surface}/creator/${encodeURIComponent(username)}`
    : `/artist/${encodeURIComponent(username)}`;
}

function discoveryHref(route: string) {
  return route;
}

function socialItem(input: {
  id: string;
  kind: DiscoveryItem["kind"];
  title: string;
  subtitle: string;
  href: string;
  image?: string;
  tags?: string[];
}): DiscoveryItem {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    subtitle: input.subtitle,
    href: discoveryHref(input.href),
    image: input.image,
    tags: input.tags,
  };
}

function safeDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(0).toISOString();
}

function releaseRoute(id: string, title: string, surface?: AppSurface) {
  return surface
    ? `/app/${surface}/explore?q=${encodeURIComponent(title)}&kind=music`
    : `/album/${encodeURIComponent(id)}`;
}

function trackRoute(title: string, surface?: AppSurface) {
  return surface
    ? `/app/${surface}/explore?q=${encodeURIComponent(title)}&kind=music`
    : `/catalogue?q=${encodeURIComponent(title)}`;
}

export async function getBvsFeed(options: { surface?: AppSurface; limit?: number } = {}): Promise<BvsFeedItem[]> {
  const surface = options.surface;
  const limit = Math.min(120, Math.max(12, options.limit || 72));
  const trackSelect = "id,user_id,title,artist_name,file_url,artwork_url,genre,release_id,rotation_added_at,created_at";
  const trackPath = surface
    ? `tracks?in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved&mobile_distribution_clearances!inner(surface,status)&mobile_distribution_clearances.surface=eq.${surface}&mobile_distribution_clearances.status=eq.cleared&select=${trackSelect},mobile_distribution_clearances(surface,status)&order=rotation_added_at.desc.nullslast,created_at.desc&limit=40`
    : `tracks?in_rotation=eq.true&is_public=eq.true&editorial_status=eq.approved&select=${trackSelect}&order=rotation_added_at.desc.nullslast,created_at.desc&limit=40`;

  const [tracks, releases, profiles, programmes, showEvents, marketplaceListings, beats] = await Promise.all([
    rows<TrackRow>(trackPath),
    rows<ReleaseRow>("releases?is_public=eq.true&editorial_status=eq.approved&select=id,user_id,title,artist_name,genre,cover_url,release_type,track_count,published_at,created_at&order=published_at.desc.nullslast,created_at.desc&limit=32"),
    rows<PublicProfile>("profiles?is_published=eq.true&is_verified=eq.true&select=id,username,avatar_url,role,is_producer,creator_public_name,creator_name_status,created_at&order=created_at.desc&limit=40"),
    rows<ProgrammeRow>("programmes?status=in.(scheduled,active)&select=id,slug,title,tagline,image_url,host,status,updated_at,created_at&order=updated_at.desc&limit=24"),
    rows<ShowEventRow>("show_events?status=in.(scheduled,live)&select=id,programme_slug,title,status,starts_at,updated_at&order=starts_at.desc&limit=24"),
    rows<MarketplaceListingRow>("creator_marketplace_listings?status=eq.published&select=id,seller_user_id,listing_type,category,title,description,price_usd,artwork_path,published_at,profiles!inner(username,display_name,creator_public_name,creator_name_status,avatar_url)&order=published_at.desc&limit=32"),
    listPublishedBeats(40).catch(() => []),
  ]);

  const profileIds = new Set<string>();
  for (const track of tracks) if (track.user_id) profileIds.add(track.user_id);
  for (const release of releases) if (release.user_id) profileIds.add(release.user_id);
  for (const beat of beats) if (beat.producer_user_id) profileIds.add(beat.producer_user_id);
  const missingProfileIds = [...profileIds].filter((id) => !profiles.some((profile) => profile.id === id));
  const linkedProfiles = missingProfileIds.length
    ? await rows<PublicProfile>(`profiles?id=in.(${missingProfileIds.join(",")})&is_published=eq.true&select=id,username,avatar_url,role,is_producer,creator_public_name,creator_name_status,created_at`)
    : [];
  const allProfiles = [...profiles, ...linkedProfiles.filter((profile) => !profiles.some((item) => item.id === profile.id))];
  const profileById = new Map(allProfiles.map((profile) => [profile.id, profile]));

  const feed: BvsFeedItem[] = [];

  for (const track of tracks) {
    const artist = String(track.artist_name || "BVS artist").trim() || "BVS artist";
    const artwork = publicMedia(track.artwork_url, surface);
    const src = publicMedia(track.file_url, surface);
    if (!src) continue;
    const route = trackRoute(track.title, surface);
    const profile = track.user_id ? profileById.get(track.user_id) : undefined;
    const media = { src, artist, project: track.release_id ? "Artist release" : "BVS rotation", genre: track.genre || undefined, artwork };
    const object: BvsObject = {
      id: track.id,
      kind: "track",
      route,
      title: track.title,
      subtitle: artist,
      artwork,
      contextLabel: "Now on BVS",
      metadata: [track.genre || undefined].filter(Boolean) as string[],
      media,
      primaryAction: { id: "play", label: "Play", intent: "play", media },
      overflowActions: [
        { id: "next", label: "Play next", intent: "play-next", media },
        { id: "queue", label: "Add to queue", intent: "queue", media },
        ...(profile ? [{ id: "artist", label: `Open ${artist}`, intent: "navigate" as const, href: creatorRoute(profile, surface) }] : []),
      ],
      rightsState: "published",
    };
    feed.push({
      id: `rotation:${track.id}:${track.rotation_added_at || track.created_at || "live"}`,
      category: "music",
      verb: "Entered BVS rotation",
      occurredAt: safeDate(track.rotation_added_at, track.created_at),
      object,
      social: {
        section: "favourites",
        item: socialItem({ id: track.id, kind: "track", title: track.title, subtitle: artist, href: route, image: artwork, tags: [track.genre || "music"] }),
      },
    });
  }

  for (const release of releases) {
    const artist = String(release.artist_name || "BVS artist").trim() || "BVS artist";
    const artwork = publicMedia(release.cover_url, surface);
    const route = releaseRoute(release.id, release.title, surface);
    const profile = release.user_id ? profileById.get(release.user_id) : undefined;
    const object: BvsObject = {
      id: release.id,
      kind: "release",
      route,
      title: release.title,
      subtitle: artist,
      artwork,
      contextLabel: "New release",
      metadata: [release.release_type?.replaceAll("_", " "), release.genre, release.track_count ? `${release.track_count} tracks` : undefined].filter(Boolean) as string[],
      primaryAction: { id: "open", label: "Open release", intent: "navigate", href: route },
      overflowActions: [
        ...(profile ? [{ id: "artist", label: `Open ${artist}`, intent: "navigate" as const, href: creatorRoute(profile, surface) }] : []),
      ],
      rightsState: "published",
    };
    feed.push({
      id: `release:${release.id}:${release.published_at || release.created_at || "live"}`,
      category: "music",
      verb: "New release on BVS",
      occurredAt: safeDate(release.published_at, release.created_at),
      object,
      social: {
        section: "favourites",
        item: socialItem({ id: release.id, kind: "release", title: release.title, subtitle: artist, href: route, image: artwork, tags: [release.release_type || "release", release.genre || "music"] }),
      },
    });
  }

  for (const beat of beats) {
    const profile = profileById.get(beat.producer_user_id);
    const producer = creatorPublicName({
      publicName: profile?.creator_public_name,
      publicNameStatus: profile?.creator_name_status,
      username: profile?.username,
    }) || "BVS producer";
    const artwork = surface ? firstPartyForApp(beat.artwork_path) : publicStorageUrl(beat.artwork_path) || undefined;
    const preview = surface ? firstPartyForApp(beat.preview_path) : publicStorageUrl(beat.preview_path) || undefined;
    const activePrices = (beat.beat_licence_options || [])
      .filter((licence) => licence.is_active !== false && licence.is_sold_out !== true)
      .map((licence) => Number(licence.price_usd))
      .filter((price) => Number.isFinite(price) && price > 0);
    if (!activePrices.length) continue;
    const route = surface
      ? `/app/${surface}/beat/${encodeURIComponent(beat.id)}`
      : `/catalogue?type=beat&q=${encodeURIComponent(beat.slug || beat.title)}#beatstore`;
    const media = preview ? { src: preview, artist: producer, project: "BVS BeatStore", genre: beat.genre, artwork } : undefined;
    const object: BvsObject = {
      id: beat.id,
      kind: "beat",
      route,
      title: beat.title,
      subtitle: producer,
      artwork,
      contextLabel: "BeatStore drop",
      metadata: [beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : undefined, beat.musical_key].filter(Boolean) as string[],
      availabilityLabel: `Licences from $${Math.min(...activePrices).toFixed(2)}`,
      media,
      primaryAction: media
        ? { id: "preview", label: "Preview", intent: "play", media }
        : { id: "open", label: "Open beat", intent: "navigate", href: route },
      overflowActions: [
        { id: "details", label: "Beat details", intent: "navigate", href: route },
        ...(media ? [
          { id: "next", label: "Preview next", intent: "play-next" as const, media },
          { id: "queue", label: "Add preview to queue", intent: "queue" as const, media },
        ] : []),
        ...(profile ? [{ id: "producer", label: `Open ${producer}`, intent: "navigate" as const, href: creatorRoute(profile, surface) }] : []),
      ],
      rightsState: "preview",
    };
    feed.push({
      id: `beat:${beat.id}:${beat.published_at || beat.created_at || "live"}`,
      category: "beat",
      verb: "New BeatStore drop",
      occurredAt: safeDate(beat.published_at, beat.created_at),
      object,
      social: {
        section: "favourites",
        item: socialItem({ id: beat.id, kind: "beat", title: beat.title, subtitle: producer, href: route, image: artwork, tags: [beat.genre || "beat"] }),
      },
    });
  }

  for (const profile of profiles) {
    const username = String(profile.username || "").trim();
    if (!username) continue;
    const name = creatorPublicName({
      publicName: profile.creator_public_name,
      publicNameStatus: profile.creator_name_status,
      username,
    }) || username;
    const route = creatorRoute(profile, surface);
    const image = publicMedia(profile.avatar_url, surface);
    const role = profile.is_producer ? "BVS artist & producer" : profile.role === "artist" ? "BVS artist" : "BVS creator";
    const object: BvsObject = {
      id: profile.id,
      kind: "creator",
      route,
      title: name,
      subtitle: role,
      artwork: image,
      contextLabel: "Creator profile live",
      primaryAction: { id: "open", label: "Open profile", intent: "navigate", href: route },
      overflowActions: [{ id: "profile", label: "View creator profile", intent: "navigate", href: route }],
      rightsState: "published",
    };
    feed.push({
      id: `creator:${profile.id}:${profile.created_at || "live"}`,
      category: "creator",
      verb: "Creator joined BVS",
      occurredAt: safeDate(profile.created_at),
      object,
      social: {
        section: "follows",
        item: socialItem({ id: profile.id, kind: "artist", title: name, subtitle: role, href: route, image, tags: [profile.is_producer ? "producer" : "artist"] }),
      },
    });
  }

  const programmeBySlug = new Map(programmes.map((programme) => [programme.slug, programme]));
  const liveProgrammeSlugs = new Set(showEvents.filter((event) => event.status === "live").map((event) => event.programme_slug));

  for (const event of showEvents.filter((item) => item.status === "live")) {
    const programme = programmeBySlug.get(event.programme_slug);
    const slug = event.programme_slug;
    const route = surface ? `/app/${surface}/show/${encodeURIComponent(slug)}` : `/shows/${encodeURIComponent(slug)}`;
    const title = programme?.title || event.title;
    const image = publicMedia(programme?.image_url, surface);
    const object: BvsObject = {
      id: event.id,
      kind: "show",
      route,
      title,
      subtitle: programme?.host || programme?.tagline || "Live on BVS",
      artwork: image,
      contextLabel: "Live now",
      metadata: [programme?.tagline || undefined].filter(Boolean) as string[],
      availabilityLabel: "Live",
      primaryAction: { id: "open", label: "Join live", intent: "navigate", href: route },
      overflowActions: [{ id: "show", label: "Open show", intent: "navigate", href: route }],
      rightsState: "published",
    };
    feed.push({ id: `live:${event.id}`, category: "live", verb: "Live on BVS now", occurredAt: safeDate(event.starts_at, event.updated_at), object });
  }

  for (const programme of programmes) {
    if (liveProgrammeSlugs.has(programme.slug)) continue;
    const route = surface ? `/app/${surface}/show/${encodeURIComponent(programme.slug)}` : `/shows/${encodeURIComponent(programme.slug)}`;
    const image = publicMedia(programme.image_url, surface);
    const object: BvsObject = {
      id: programme.id,
      kind: "show",
      route,
      title: programme.title,
      subtitle: programme.host || programme.tagline || "BVS programme",
      artwork: image,
      contextLabel: programme.status === "active" ? "BVS show" : "Upcoming on BVS",
      metadata: [programme.tagline || undefined].filter(Boolean) as string[],
      primaryAction: { id: "open", label: "Open show", intent: "navigate", href: route },
      overflowActions: [{ id: "show", label: "View programme", intent: "navigate", href: route }],
      rightsState: "published",
    };
    feed.push({
      id: `show:${programme.id}:${programme.updated_at || programme.created_at || "live"}`,
      category: "live",
      verb: programme.status === "active" ? "BVS show updated" : "New show on BVS",
      occurredAt: safeDate(programme.updated_at, programme.created_at),
      object,
    });
  }

  for (const listing of marketplaceListings) {
    const publicName = creatorPublicName({
      publicName: listing.profiles?.creator_public_name,
      publicNameStatus: listing.profiles?.creator_name_status,
      username: listing.profiles?.username,
    }) || String(listing.profiles?.display_name || listing.profiles?.username || "BVS creator");
    const providerSlug = storefrontSlug(publicName);
    const route = surface
      ? `/app/${surface}/marketplace?provider=${encodeURIComponent(providerSlug)}&service=${encodeURIComponent(listing.id)}`
      : `/marketplace/${encodeURIComponent(providerSlug)}?service=${encodeURIComponent(listing.id)}`;
    const image = publicMedia(listing.artwork_path || listing.profiles?.avatar_url, surface);
    const price = Number(listing.price_usd);
    const object: BvsObject = {
      id: listing.id,
      kind: listing.listing_type === "digital_product" ? "product" : "service",
      route,
      title: listing.title,
      subtitle: publicName,
      artwork: image,
      contextLabel: "New in Marketplace",
      metadata: [listing.category?.replaceAll("_", " ")].filter(Boolean) as string[],
      availabilityLabel: Number.isFinite(price) && price > 0 ? `From $${price.toFixed(2)}` : undefined,
      primaryAction: { id: "open", label: "View details", intent: "navigate", href: route },
      overflowActions: [{ id: "details", label: "View Marketplace listing", intent: "navigate", href: route }],
      rightsState: "published",
    };
    feed.push({
      id: `marketplace:${listing.id}:${listing.published_at || "live"}`,
      category: "marketplace",
      verb: listing.listing_type === "digital_product" ? "New creator product" : "New creator service",
      occurredAt: safeDate(listing.published_at),
      object,
    });
  }

  return feed
    .filter((item) => Date.parse(item.occurredAt) > 0)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, limit);
}
