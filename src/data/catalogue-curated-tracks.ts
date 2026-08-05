/**
 * Curated catalogue listings kept as fallback/supplement until fully DB-backed.
 * Live approved tracks come from /api/catalogue/listings.
 */
import { PRICE_SINGLE_DOWNLOAD } from "@/lib/catalogue-pricing";
import { legacyPreviewUrl } from "@/lib/legacy-catalogue-media";

export type CuratedTrackType = "single" | "beat" | "mix";

export type CuratedTrack = {
  id: number | string;
  title: string;
  artist: string;
  genre: string;
  collection: string;
  duration: string;
  description: string;
  type: CuratedTrackType;
  src: string;
  artwork: string;
  bpm?: string;
  price?: number | null;
  externalUrl?: string;
  streamOnly?: boolean;
  albumPackage?: boolean;
  producerBeat?: boolean;
  producerUsername?: string;
  packId?: string | null;
};

const coverArt = "/music/Bvs-3000x3000%202.png";
const junePackArt = "/images/music-packs/june-pack.jpg";
const mayPackArt = "/images/music-packs/may-pack-1-2.jpg";
const straighteninArt = "/images/albums/straightenin.jpg";
const howlingArt = "/images/albums/howling-in-the-hills-2.jpg";
const wolfBeenBadArt = "/images/albums/wolf-been-bad.jpg";

function musicFile(filename: string) {
  return legacyPreviewUrl(filename);
}

const streamingReleaseSongs: CuratedTrack[] = [
  ...[
    ["Peter Piper (feat. W.Hills & Calm Beast)", "2:31", "6-rP-DUCq8o"],
    ["Trap Jumping (feat. H.Sauce & W.Hills)", "1:48", "OwGq3xqI0WE"],
    ["Loot (feat. Obi Davids)", "2:25", "ZxlRn4-BdtY"],
    ["Diss You (feat. Obi Davids)", "2:27", "IKhskzyN-BM"],
    ["My Side (feat. I Ratty)", "2:06", "JWyQp7H-bUE"],
    ["Frightened (feat. W.Hills)", "2:09", "tiracfBEIiI"],
    ["Ndatenda (feat. 9xne)", "2:12", "KeWj8zF5Tns"],
    ["Chasing Dead Faces (OUTRO) (feat. I Ratty)", "4:50", "6SHdHsJ6X34"],
  ].map(([title, duration, videoId], index) => ({
    id: 1100 + index,
    title,
    artist: "Wolf Bridges",
    genre: "Streaming Release",
    collection: "STRAIGHTENIN",
    duration,
    description: `Track ${index + 1} from STRAIGHTENIN by Wolf Bridges. Listed for BVS discovery with the project cover assigned.`,
    type: "mix" as CuratedTrackType,
    src: "",
    artwork: straighteninArt,
    externalUrl: `https://music.youtube.com/watch?v=${videoId}`,
    streamOnly: true,
    price: null,
  })),
  ...[
    ["The Wolf Cub & The Hill Intro (skit)", "2:28", "pkVMa54Y4Sg"],
    ["Forgive Me, Lord", "1:40", "vEvrp6ty9C4"],
    ["Nanganisa", "3:23", "qY_iiPrml10"],
    ["Zviriko Here?", "2:32", "wKzna4XfvWA"],
    ["Multiply (How Come)", "2:29", "qPqzl3UFjsY"],
    ["Doubted", "2:24", "jIFxjGOf1z4"],
    ["Kurt Kobain (feat. Omari Gray)", "2:39", "wbyBSQ1xH0o"],
    ["Boddies In The Booth (feat. Omari Gray)", "2:36", "mVRvPr5ZyOA"],
    ["Thank God (feat. Omari Gray)", "2:54", "X9u1lzsWDJ4"],
    ["Kunta Kinte (feat. Omari Gray)", "2:37", "bpm_tC1POIE"],
    ["NaZoaa's Call", "1:26", "x26qVN_2jFE"],
    ["Truth", "3:47", "sNCqu1JzlZY"],
    ["The Wolf Cub & The Hill Outro (skit)", "2:28", "QJ7ftRLOC4Y"],
  ].map(([title, duration, videoId], index) => ({
    id: 1200 + index,
    title,
    artist: "Wolf Bridges x W.Hills",
    genre: "Streaming Release",
    collection: "HOWLING IN THE HILLS 2",
    duration,
    description: `Track ${index + 1} from HOWLING IN THE HILLS 2 by Wolf Bridges and W.Hills. Listed for BVS discovery with the project cover assigned.`,
    type: "mix" as CuratedTrackType,
    src: "",
    artwork: howlingArt,
    externalUrl: `https://music.youtube.com/watch?v=${videoId}`,
    streamOnly: true,
    price: null,
  })),
  ...[
    ["See Clear", "1:54", "Y6Ml21LuJhA"],
    ["Run Dolla", "3:01", "8LOexU8JcGU"],
    ["Don't Worry", "2:48", "Ce2YDXITQXs"],
    ["Only Jah", "2:05", "N5l3k2tHRkQ"],
  ].map(([title, duration, videoId], index) => ({
    id: 1300 + index,
    title,
    artist: "Wolf Bridges x I Ratty",
    genre: "Streaming Release",
    collection: "WOLF BEEN BAD",
    duration,
    description: `Track ${index + 1} from WOLF BEEN BAD by Wolf Bridges and I Ratty. Listed for BVS discovery with the project cover assigned.`,
    type: "mix" as CuratedTrackType,
    src: "",
    artwork: wolfBeenBadArt,
    externalUrl: `https://music.youtube.com/watch?v=${videoId}`,
    streamOnly: true,
    price: null,
  })),
];

const tracks: CuratedTrack[] = [
  {
    id: 1,
    title: "Robert Gabriel Mugabe International Airport",
    artist: "BVS Radio",
    genre: "BVS Original",
    collection: "BVS Archive",
    duration: "3:42",
    description:
      "One of the preserved original BVS cuts now restored into the live site catalogue.",
    type: "single",
    src: musicFile("bvs-radio-robert-gabriel-mugabe-international-airport.mp3"),
    artwork: coverArt,
  },
  {
    id: 2,
    title: "BVS Slide",
    artist: "BVS Radio",
    genre: "BVS Original",
    collection: "BVS Archive",
    duration: "3:18",
    description: "A direct BVS archive track from the original player library.",
    type: "mix",
    src: musicFile("bvs-radio-slide-mix.mp3"),
    artwork: coverArt,
  },
  {
    id: 3,
    title: "Never Ending Mix",
    artist: "BVS x Brx",
    genre: "BVS Original",
    collection: "BVS Archive",
    duration: "4:08",
    description: "BVS and Brx energy from the preserved VPS catalogue.",
    type: "mix",
    src: musicFile("bvs-brx-never-ending-mix.mp3"),
    artwork: coverArt,
  },
  {
    id: 4,
    title: "BVS Starve",
    artist: "BVS Radio",
    genre: "BVS Original",
    collection: "BVS Archive",
    duration: "3:36",
    description:
      "A gritty BVS archive track carried forward from the original station files.",
    type: "single",
    src: musicFile("bvs-radio-starve.mp3"),
    artwork: coverArt,
  },
  {
    id: 5,
    title: "Calm Beast",
    artist: "Mahendere",
    genre: "Gospel",
    collection: "BVS Archive",
    duration: "4:22",
    description:
      "A mastered archive track that gives the catalogue a warmer Zimbabwean gospel edge.",
    type: "single",
    src: musicFile("calm-beast-mahendere-master.mp3"),
    artwork: coverArt,
  },
  {
    id: 6,
    title: "Mellisa",
    artist: "Wolf Bridges",
    genre: "Hip-Hop",
    collection: "June Pack",
    duration: "2:54",
    description: "A polished Wolf Bridges beat from the staged June pack.",
    type: "beat",
    bpm: "156 BPM",
    src: musicFile("mellisa - 156 bpm @wolfbrx.mp3"),
    artwork: junePackArt,
  },
  {
    id: 7,
    title: "In My City",
    artist: "Wolf Bridges",
    genre: "Hip-Hop",
    collection: "June Pack",
    duration: "2:41",
    description:
      "Fast, direct, and built for radio rotation or artist placement.",
    type: "beat",
    bpm: "170 BPM",
    src: musicFile("in my city - 170 bpm @wolfbrx.mp3"),
    artwork: junePackArt,
  },
  {
    id: 8,
    title: "RGB",
    artist: "Wolf Bridges",
    genre: "Trap",
    collection: "June Pack",
    duration: "3:05",
    description:
      "A clean trap beat with the kind of punch that fits BVS producer showcases.",
    type: "beat",
    bpm: "160 BPM",
    src: musicFile("RGB - 160 bpm @wolfbrx.mp3"),
    artwork: junePackArt,
  },
  {
    id: 9,
    title: "Fading Memories",
    artist: "Wolf Bridges + Znayshi",
    genre: "Melodic Rap",
    collection: "March Pack",
    duration: "2:58",
    description:
      "Melodic and reflective, pulled from the Wolf Bridges pack now sitting in the live catalogue.",
    type: "beat",
    bpm: "167 BPM",
    src: musicFile("fading memories - 167 bpm @wolfbrx + znayshi.mp3"),
    artwork: "/images/mic-closeup.jpg",
  },
  {
    id: 10,
    title: "The Giant",
    artist: "Wolf Bridges + Dannynevamiss",
    genre: "Hip-Hop",
    collection: "March Pack",
    duration: "2:47",
    description:
      "A heavy producer cut from the Dropbox pack with enough presence for a featured card.",
    type: "beat",
    bpm: "166 BPM",
    src: musicFile("the giant - 166 bpm @wolfbrx + dannynevamiss.mp3"),
    artwork: "/images/musicians.jpg",
  },
  {
    id: 11,
    title: "Foreign Exchange",
    artist: "Wolf Bridges + Thermo",
    genre: "Trap",
    collection: "March Pack",
    duration: "3:11",
    description:
      "A sharp, clean beat that fits the producer-market side of BVS.",
    type: "beat",
    bpm: "158 BPM",
    src: musicFile("foreign exchange - 158 bpm @wolfbrx + thermo.mp3"),
    artwork: "/images/female-host.jpg",
  },
  {
    id: 12,
    title: "Chiraq Drillaz",
    artist: "Wolf Bridges",
    genre: "Drill",
    collection: "January Pack",
    duration: "2:51",
    description:
      "Drill energy from the January pack, useful for showing the harder side of the catalogue.",
    type: "beat",
    bpm: "158 BPM",
    src: musicFile("Chiraq Drillaz - 158 bpm @wolfbrx.mp3"),
    artwork: "/images/festival-crowd.jpg",
  },
  {
    id: 13,
    title: "Bottom Barre",
    artist: "Wolf Bridges + Prodbygtp",
    genre: "Rap",
    collection: "January Pack",
    duration: "3:02",
    description:
      "A lower-tempo cut from the pack with a different pocket for artists browsing beats.",
    type: "beat",
    bpm: "98 BPM",
    src: musicFile("bottom barre - 98 bpm @wolfbrx + prodbygtp.mp3"),
    artwork: "/images/hero-studio.jpg",
  },
  {
    id: 14,
    title: "Rockstar",
    artist: "Wolf Bridges + Jhawk",
    genre: "Hip-Hop",
    collection: "February Pack",
    duration: "2:45",
    description:
      "A catchy, accessible Wolf Bridges collaboration from the February pack.",
    type: "beat",
    bpm: "125 BPM",
    src: musicFile("rockstar - 125 bpm @wolfbrx + jhawk.mp3"),
    artwork: "/images/mic-closeup.jpg",
  },
  {
    id: 15,
    title: "Grinder's Prayer",
    artist: "Wolf Bridges",
    genre: "Trap",
    collection: "May Pack",
    duration: "3:00",
    description:
      "A focused May pack track that fits the BVS working-artist lane.",
    type: "beat",
    bpm: "169 BPM",
    src: musicFile("grinder's prayer - 169 bpm @wolfbrx.mp3"),
    artwork: mayPackArt,
  },
  {
    id: 16,
    title: "Eternity",
    artist: "Wolf Bridges",
    genre: "Soul",
    collection: "Wolf Bridges Library",
    duration: "2:39",
    description:
      "A slower, soulful beat to balance the harder drill and trap rows.",
    type: "beat",
    bpm: "90 BPM",
    src: musicFile("eternity - 90 bpm @wolfbrx.mp3"),
    artwork: "/images/female-host.jpg",
  },
  // LORD Album — each song $2 single; full album package sold separately
  {
    id: 1001,
    title: "Calm Beast (Mahendere Master)",
    artist: "CalmBeast x W.Hills",
    genre: "Gospel",
    collection: "LORD Album",
    duration: "4:22",
    description: `LORD Album single — download $${PRICE_SINGLE_DOWNLOAD}. Cover follows the LORD project. Full album package also available.`,
    type: "single",
    src: musicFile("calm-beast-mahendere-master.mp3"),
    artwork: "/images/albums/lord-album.jpg",
    price: PRICE_SINGLE_DOWNLOAD,
  },
  // Drive commerce products (ids match bvsradio-products/albums/<id>.zip)
  {
    id: 100,
    title: "LORD Album",
    artist: "CalmBeast x W.Hills",
    genre: "Album",
    collection: "Albums",
    duration: "Full album",
    description: `Full LORD album download (CalmBeast x W.Hills). Individual songs also sell as $${PRICE_SINGLE_DOWNLOAD} singles where hosted. Full zip after payment.`,
    type: "mix",
    src: musicFile("calm-beast-mahendere-master.mp3"),
    artwork: "/images/albums/lord-album.jpg",
    price: 19,
    albumPackage: true,
  },
  {
    id: 102,
    title: "STRAIGHTENIN",
    artist: "Wolf Bridges",
    genre: "Spotify Release",
    collection: "Wolf Bridges Projects",
    duration: "Project",
    description:
      "Spotify project from Wolf Bridges, featured through the BVS Radio playlist.",
    type: "mix",
    src: "https://p.scdn.co/mp3-preview/a4c2906e4838d1513e71952936a5039c006c5cf9",
    artwork: straighteninArt,
    externalUrl: "https://open.spotify.com/album/2plE5CHEf6lodOSZdTzdXf",
    streamOnly: true,
    price: null,
  },
  {
    id: 103,
    title: "HOWLING IN THE HILLS 2",
    artist: "Wolf Bridges x W.Hills",
    genre: "Spotify Release",
    collection: "Wolf Bridges Projects",
    duration: "Project",
    description:
      "A Wolf Bridges and W.Hills project now surfaced in the BVS music catalogue with Spotify access.",
    type: "mix",
    src: "https://p.scdn.co/mp3-preview/afec4b1200c2ca74cbb50d6b0cfa053ccd6a5e8d",
    artwork: howlingArt,
    externalUrl: "https://open.spotify.com/album/5dHfrh9OYgQyvaWuEm9dfk",
    streamOnly: true,
    price: null,
  },
  {
    id: 104,
    title: "WOLF BEEN BAD",
    artist: "Wolf Bridges x I Ratty",
    genre: "Spotify Release",
    collection: "Wolf Bridges Projects",
    duration: "Project",
    description:
      "A Wolf Bridges and I Ratty project added to BVS catalogue discovery with a Spotify listen-through path.",
    type: "mix",
    src: "https://p.scdn.co/mp3-preview/625162a39886da9e1efec3c864f55238fbe6dd5c",
    artwork: wolfBeenBadArt,
    externalUrl: "https://open.spotify.com/album/4Bxbabl2djOaaT2tGHXkrB",
    streamOnly: true,
    price: null,
  },
  ...streamingReleaseSongs,
  {
    id: 1011,
    title: "16 Bit — Calm Beast cut",
    artist: "BVS Radio",
    genre: "Album",
    collection: "Album 16 Bit",
    duration: "Single",
    description: `Album 16 Bit single — download $${PRICE_SINGLE_DOWNLOAD}. Full album package sold separately.`,
    type: "single",
    src: musicFile("calm-beast.mp3"),
    artwork: "/images/albums/album-16-bit.jpg",
    price: PRICE_SINGLE_DOWNLOAD,
  },
  {
    id: 101,
    title: "Album 16 Bit",
    artist: "BVS Radio",
    genre: "Album",
    collection: "Albums",
    duration: "Full album",
    description: `Complete 16 Bit album package. Songs also available as $${PRICE_SINGLE_DOWNLOAD} singles where hosted. Digital download after checkout.`,
    type: "mix",
    src: musicFile("calm-beast.mp3"),
    artwork: "/images/albums/album-16-bit.jpg",
    price: 14,
    albumPackage: true,
  },
];

/** Archive, stream-only, and sample-pack listings used when not superseded by live DB rows. */
export const curatedCatalogueTracks: CuratedTrack[] = tracks;
