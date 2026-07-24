export type StationTrack = {
  id?: string;
  title: string;
  artist: string;
  src: string;
  /** Album / project cover for the persistent player */
  artwork?: string;
  /** Album or pack name when known */
  project?: string;
  playCount?: number;
  /** Optional genre for similar / auto-fill */
  genre?: string;
};

export type Show = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  host: string;
  schedule: string;
  status: "preview" | "active";
};

export const shows: Show[] = [
  {
    slug: "harare-after-dark",
    title: "Harare After Dark",
    tagline: "The city, after hours.",
    description: "A home for late-night Zimbabwean music, DJ selections and conversations from the creative scene.",
    image: "/images/editorial/radio-studio-harare.webp",
    host: "BVS Radio",
    schedule: "Friday · 20:00 CAT",
    status: "preview",
  },
  {
    slug: "studio-stories",
    title: "Studio Stories",
    tagline: "The people behind the sound.",
    description: "Artist interviews and honest conversations about writing, recording and building a music career.",
    image: "/images/editorial/audio-engineering-work.webp",
    host: "BVS Radio",
    schedule: "Coming to the programme",
    status: "preview",
  },
  {
    slug: "new-zimbabwean-sound",
    title: "New Zimbabwean Sound",
    tagline: "Fresh music, properly introduced.",
    description: "A discovery programme for new releases submitted by Zimbabwean artists at home and abroad.",
    image: "/images/editorial/music-discovery-show.webp",
    host: "BVS Radio selectors",
    schedule: "Sunday · 18:00 CAT",
    status: "preview",
  },
];

export const schedule = [
  { day: "Monday–Thursday", time: "All day", title: "BVS Continuous Rotation", note: "Automated library rotation" },
  { day: "Friday", time: "20:00 CAT", title: "Harare After Dark", note: "Programme preview — launch date to be announced" },
  { day: "Sunday", time: "18:00 CAT", title: "New Zimbabwean Sound", note: "Programme preview — launch date to be announced" },
];

export function getShow(slug: string) {
  return shows.find((show) => show.slug === slug);
}
