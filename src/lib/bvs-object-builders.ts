import type { BvsObject } from "./bvs-object";
import { hrefForAppSurface, type AppSurface } from "./app-surface";

export type BuildableTrack = {
  id?: string;
  title: string;
  artist: string;
  src: string;
  artwork?: string;
  project?: string;
  genre?: string;
};

export type BuildableBeat = {
  id: string;
  slug?: string | null;
  title: string;
  producer?: string;
  producer_username?: string;
  genre?: string;
  mood?: string;
  bpm?: number | null;
  musical_key?: string | null;
  artworkUrl?: string;
  previewUrl?: string;
  startingPrice?: number;
};

export type BuildableCreator = {
  id: string;
  username: string;
  name: string;
  role?: string;
  image?: string;
  trackCount?: number;
  beatCount?: number;
};

export type BuildableStory = {
  slug: string;
  title: string;
  description?: string;
  readTime?: string;
};

export type BuildableShow = {
  slug: string;
  title: string;
  tagline?: string;
  schedule?: string;
  image?: string;
};

export type BuildableRelease = {
  id: string;
  title: string;
  artist?: string;
  cover?: string;
  trackCount?: number;
};

function mediaFromTrack(track: BuildableTrack) {
  return {
    src: track.src,
    artist: track.artist,
    project: track.project || "BVS Station",
    genre: track.genre,
    artwork: track.artwork,
  };
}

export function stationTrackToObject(
  track: BuildableTrack,
  opts: { surface?: AppSurface | null; availabilityLabel?: string } = {},
): BvsObject {
  const id = track.id || track.src;
  const artistHref = hrefForAppSurface(`/search?q=${encodeURIComponent(track.artist)}`, opts.surface);
  const media = mediaFromTrack(track);
  return {
    id,
    kind: "track",
    route: artistHref,
    title: track.title,
    subtitle: track.artist,
    artwork: track.artwork,
    contextLabel: track.project || "BVS rotation",
    metadata: [track.genre].filter(Boolean) as string[],
    availabilityLabel: opts.availabilityLabel,
    media,
    primaryAction: { id: "play", label: "Play", intent: "play", media },
    overflowActions: [
      { id: "next", label: "Play next", intent: "play-next", media },
      { id: "queue", label: "Add to queue", intent: "queue", media },
      { id: "artist", label: `Go to ${track.artist}`, intent: "navigate", href: artistHref },
    ],
    rightsState: "published",
  };
}

export function beatToObject(
  beat: BuildableBeat,
  opts: { surface?: AppSurface | null } = {},
): BvsObject {
  const catalogueHref = `/catalogue?type=beat&q=${encodeURIComponent(beat.slug || beat.title)}#beatstore`;
  const route = hrefForAppSurface(catalogueHref, opts.surface);
  const producerHref = beat.producer_username
    ? `/artist/${beat.producer_username}`
    : hrefForAppSurface(`/search?q=${encodeURIComponent(beat.producer || "")}`, opts.surface);
  const media = beat.previewUrl
    ? { src: beat.previewUrl, artist: beat.producer, project: "BVS BeatStore", artwork: beat.artworkUrl, genre: beat.genre }
    : undefined;
  return {
    id: beat.id,
    kind: "beat",
    route,
    title: beat.title,
    subtitle: beat.producer || "BVS producer",
    artwork: beat.artworkUrl,
    contextLabel: "BVS BeatStore",
    metadata: [beat.genre, beat.mood, beat.bpm ? `${beat.bpm} BPM` : undefined, beat.musical_key].filter(Boolean) as string[],
    availabilityLabel: Number(beat.startingPrice) > 0 ? `Licences from $${Number(beat.startingPrice).toFixed(2)}` : "Licence options available",
    media,
    primaryAction: media
      ? { id: "preview", label: "Preview", intent: "play", media }
      : { id: "licence", label: "View licence", intent: "navigate", href: catalogueHref },
    overflowActions: [
      ...(media ? [
        { id: "next", label: "Preview next", intent: "play-next" as const, media },
        { id: "queue", label: "Add preview to queue", intent: "queue" as const, media },
      ] : []),
      { id: "licence", label: "View licence", intent: "navigate", href: catalogueHref },
      ...(beat.producer ? [{ id: "producer", label: `Go to ${beat.producer}`, intent: "navigate" as const, href: producerHref }] : []),
    ],
    rightsState: "preview",
  };
}

export function creatorToObject(creator: BuildableCreator): BvsObject {
  const route = `/artist/${creator.username}`;
  const count = creator.beatCount && !creator.trackCount
    ? `${creator.beatCount} published ${creator.beatCount === 1 ? "beat" : "beats"}`
    : creator.trackCount != null
      ? `${creator.trackCount} published ${creator.trackCount === 1 ? "track" : "tracks"}`
      : undefined;
  return {
    id: creator.id,
    kind: "creator",
    route,
    title: creator.name,
    subtitle: creator.role || "BVS creator",
    artwork: creator.image,
    contextLabel: creator.beatCount && !creator.trackCount ? "Producer" : "Artist",
    metadata: count ? [count] : undefined,
    primaryAction: { id: "open", label: "Open", intent: "navigate", href: route },
    overflowActions: [{ id: "profile", label: "View creator profile", intent: "navigate", href: route }],
    rightsState: "published",
  };
}

export function storyToObject(story: BuildableStory): BvsObject {
  const route = `/blog/${story.slug}`;
  return {
    id: story.slug,
    kind: "story",
    route,
    title: story.title,
    subtitle: story.description,
    contextLabel: "BVS story",
    metadata: story.readTime ? [story.readTime] : undefined,
    primaryAction: { id: "read", label: "Read", intent: "navigate", href: route },
    overflowActions: [{ id: "open", label: "Open story", intent: "navigate", href: route }],
    rightsState: "published",
  };
}

export function showToObject(show: BuildableShow): BvsObject {
  const route = `/shows/${show.slug}`;
  return {
    id: show.slug,
    kind: "show",
    route,
    title: show.title,
    subtitle: show.tagline,
    artwork: show.image,
    contextLabel: "Programme",
    metadata: show.schedule ? [show.schedule] : undefined,
    primaryAction: { id: "open", label: "Open", intent: "navigate", href: route },
    overflowActions: [{ id: "profile", label: "View programme", intent: "navigate", href: route }],
    rightsState: "published",
  };
}

export function releaseToObject(release: BuildableRelease): BvsObject {
  const route = `/album/${release.id}`;
  return {
    id: release.id,
    kind: "release",
    route,
    title: release.title,
    subtitle: release.artist || "BVS creator",
    artwork: release.cover,
    contextLabel: "Release",
    metadata: release.trackCount ? [`${release.trackCount} tracks`] : undefined,
    primaryAction: { id: "open", label: "Open", intent: "navigate", href: route },
    overflowActions: [{ id: "album", label: "View release", intent: "navigate", href: route }],
    rightsState: "published",
  };
}
