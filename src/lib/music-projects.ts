/**
 * Album / project covers + member tracks for catalogue + station player.
 * Cover art is keyed by exact public/music filenames (decoded).
 */

export type MusicProject = {
  id: string;
  name: string;
  artwork: string;
  /** Exact filenames under public/music (not URL-encoded) */
  tracks: string[];
};

const coverArt = "/music/Bvs-3000x3000%202.png";
const junePackArt = "/images/music-packs/june-pack.jpg";
const mayPackArt = "/images/music-packs/may-pack-1-2.jpg";
const lordArt = "/images/albums/lord-album.jpg";
const bit16Art = "/images/albums/album-16-bit.jpg";

/** Curated projects Abias treats as albums / packs / releases */
export const musicProjects: MusicProject[] = [
  {
    id: "lord-album",
    name: "LORD Album",
    artwork: lordArt,
    // Site-hosted masters linked to the LORD project cover
    tracks: ["calm-beast-mahendere-master.mp3"],
  },
  {
    id: "album-16-bit",
    name: "Album 16 Bit",
    artwork: bit16Art,
    // Full multi-track package is commerce zip; preview master uses 16 Bit cover
    tracks: ["calm-beast.mp3"],
  },
  {
    id: "bvs-archive",
    name: "BVS Archive",
    artwork: coverArt,
    tracks: [
      "bvs-radio-robert-gabriel-mugabe-international-airport.mp3",
      "bvs-radio-slide-mix.mp3",
      "bvs-brx-never-ending-mix.mp3",
      "bvs-radio-starve.mp3",
      "bvs-radio-ab2c-mix.mp3",
      "bvs-radio-nerve-mix.mp3",
      "bvs-radio-on-the-moon-mix.mp3",
      "bvs-whills-brx-deep.mp3",
      "bvs-brx-uptown-wins.mp3",
      "bvs-radio-having-fun.mp3",
      "bvs-brx-want-sumo.mp3",
      "bvs-party-tarpy-mix.mp3",
      "bvs-radio-sad-addict-mix.mp3",
    ],
  },
  {
    id: "june-pack",
    name: "June Pack",
    artwork: junePackArt,
    tracks: [
      "mellisa - 156 bpm @wolfbrx.mp3",
      "in my city - 170 bpm @wolfbrx.mp3",
      "RGB - 160 bpm @wolfbrx.mp3",
    ],
  },
  {
    id: "may-pack",
    name: "May Pack",
    artwork: mayPackArt,
    tracks: ["grinder's prayer - 169 bpm @wolfbrx.mp3"],
  },
  {
    id: "march-pack",
    name: "March Pack",
    artwork: "/images/mic-closeup.jpg",
    tracks: [
      "fading memories - 167 bpm @wolfbrx + znayshi.mp3",
      "the giant - 166 bpm @wolfbrx + dannynevamiss.mp3",
      "foreign exchange - 158 bpm @wolfbrx + thermo.mp3",
    ],
  },
  {
    id: "january-pack",
    name: "January Pack",
    artwork: "/images/festival-crowd.jpg",
    tracks: [
      "Chiraq Drillaz - 158 bpm @wolfbrx.mp3",
      "bottom barre - 98 bpm @wolfbrx + prodbygtp.mp3",
    ],
  },
  {
    id: "february-pack",
    name: "February Pack",
    artwork: "/images/mic-closeup.jpg",
    tracks: ["rockstar - 125 bpm @wolfbrx + jhawk.mp3"],
  },
  {
    id: "naygifted",
    name: "Naygifted Beats",
    artwork: "/images/female-host.jpg",
    tracks: ["eternity - 90 bpm @wolfbrx.mp3"],
  },
];

/** Spotify / external projects (preview URLs for catalogue + optional station) */
export type ExternalProjectTrack = {
  id: string;
  project: string;
  title: string;
  artist: string;
  artwork: string;
  src: string;
  externalUrl: string;
};

export const externalProjectTracks: ExternalProjectTrack[] = [
  {
    id: "straightenin",
    project: "STRAIGHTENIN",
    title: "STRAIGHTENIN",
    artist: "Wolfbridges",
    artwork: "/images/musicians.jpg",
    src: "https://p.scdn.co/mp3-preview/a4c2906e4838d1513e71952936a5039c006c5cf9",
    externalUrl: "https://open.spotify.com/album/2plE5CHEf6lodOSZdTzdXf",
  },
  {
    id: "howling-in-the-hills-2",
    project: "HOWLING IN THE HILLS 2",
    title: "HOWLING IN THE HILLS 2",
    artist: "Wolfbridges x W.Hills",
    artwork: "/images/editorial/music-discovery-show.webp",
    src: "https://p.scdn.co/mp3-preview/afec4b1200c2ca74cbb50d6b0cfa053ccd6a5e8d",
    externalUrl: "https://open.spotify.com/album/5dHfrh9OYgQyvaWuEm9dfk",
  },
  {
    id: "wolf-been-bad",
    project: "WOLF BEEN BAD",
    title: "WOLF BEEN BAD",
    artist: "Wolfbridges x I Ratty",
    artwork: "/images/festival-crowd.jpg",
    src: "https://p.scdn.co/mp3-preview/625162a39886da9e1efec3c864f55238fbe6dd5c",
    externalUrl: "https://open.spotify.com/album/4Bxbabl2djOaaT2tGHXkrB",
  },
];

const DEFAULT_ARTWORK = coverArt;

/** Resolve album/project cover for a local music filename or public /music/... src */
export function artworkForMusicSrc(src: string): string {
  const decoded = decodeURIComponent(src);
  const filename = decoded.split("/").pop() || decoded;
  for (const project of musicProjects) {
    if (project.tracks.some((t) => t === filename || filename.endsWith(t))) {
      return project.artwork;
    }
  }
  // Heuristic packs by filename when not listed
  if (/june|mellisa|in my city|RGB/i.test(filename) && /wolfbrx/i.test(filename)) return junePackArt;
  if (/grinder/i.test(filename)) return mayPackArt;
  if (/wolfbrx/i.test(filename)) return junePackArt;
  if (/bvs-radio|bvs-brx|bvs-party|bvs-whills/i.test(filename)) return coverArt;
  return DEFAULT_ARTWORK;
}

export function projectNameForMusicSrc(src: string): string | undefined {
  const decoded = decodeURIComponent(src);
  const filename = decoded.split("/").pop() || decoded;
  for (const project of musicProjects) {
    if (project.tracks.some((t) => t === filename || filename.endsWith(t))) {
      return project.name;
    }
  }
  return undefined;
}

/** Ordered local files that should lead the station rotation (album/pack songs first) */
export function curatedRotationFilenames(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const project of musicProjects) {
    for (const track of project.tracks) {
      if (seen.has(track)) continue;
      seen.add(track);
      ordered.push(track);
    }
  }
  return ordered;
}
