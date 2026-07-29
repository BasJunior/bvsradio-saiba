export const LEGACY_CATALOGUE_FILES = [
  "bvs-radio-robert-gabriel-mugabe-international-airport.mp3",
  "bvs-radio-slide-mix.mp3",
  "bvs-brx-never-ending-mix.mp3",
  "bvs-radio-starve.mp3",
  "calm-beast-mahendere-master.mp3",
  "mellisa - 156 bpm @wolfbrx.mp3",
  "in my city - 170 bpm @wolfbrx.mp3",
  "RGB - 160 bpm @wolfbrx.mp3",
  "fading memories - 167 bpm @wolfbrx + znayshi.mp3",
  "the giant - 166 bpm @wolfbrx + dannynevamiss.mp3",
  "foreign exchange - 158 bpm @wolfbrx + thermo.mp3",
  "Chiraq Drillaz - 158 bpm @wolfbrx.mp3",
  "bottom barre - 98 bpm @wolfbrx + prodbygtp.mp3",
  "rockstar - 125 bpm @wolfbrx + jhawk.mp3",
  "grinder's prayer - 169 bpm @wolfbrx.mp3",
  "eternity - 90 bpm @wolfbrx.mp3",
  "calm-beast.mp3",
] as const;

function legacyObjectName(filename: string) {
  const extension = filename.toLowerCase().endsWith(".mp3") ? ".mp3" : "";
  const slug = filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  let hash = 2166136261;
  for (let index = 0; index < filename.length; index += 1) {
    hash ^= filename.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${slug}-${(hash >>> 0).toString(16).padStart(8, "0")}${extension}`;
}

export function legacyPreviewKey(filename: string) {
  return `legacy/previews/${legacyObjectName(filename)}`;
}

export function legacyMasterKey(filename: string) {
  return `legacy/masters/${legacyObjectName(filename)}`;
}

export function legacyPreviewUrl(filename: string) {
  const base =
    process.env.NEXT_PUBLIC_R2_PREVIEW_BASE_URL ||
    "https://pub-2685a77641ae44d48d5c57eda51ee34c.r2.dev";
  return `${base.replace(/\/+$/, "")}/${legacyPreviewKey(filename)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}?v=1`;
}

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PRODUCT_TITLE_FILES: Record<string, string> = {
  "robert gabriel mugabe international airport":
    "bvs-radio-robert-gabriel-mugabe-international-airport.mp3",
  "bvs slide": "bvs-radio-slide-mix.mp3",
  "never ending mix": "bvs-brx-never-ending-mix.mp3",
  "bvs starve": "bvs-radio-starve.mp3",
  "calm beast": "calm-beast-mahendere-master.mp3",
  "calm beast mahendere master": "calm-beast-mahendere-master.mp3",
  mellisa: "mellisa - 156 bpm @wolfbrx.mp3",
  "in my city": "in my city - 170 bpm @wolfbrx.mp3",
  rgb: "RGB - 160 bpm @wolfbrx.mp3",
  "fading memories": "fading memories - 167 bpm @wolfbrx + znayshi.mp3",
  "the giant": "the giant - 166 bpm @wolfbrx + dannynevamiss.mp3",
  "foreign exchange": "foreign exchange - 158 bpm @wolfbrx + thermo.mp3",
  "chiraq drillaz": "Chiraq Drillaz - 158 bpm @wolfbrx.mp3",
  "bottom barre": "bottom barre - 98 bpm @wolfbrx + prodbygtp.mp3",
  rockstar: "rockstar - 125 bpm @wolfbrx + jhawk.mp3",
  "grinder s prayer": "grinder's prayer - 169 bpm @wolfbrx.mp3",
  eternity: "eternity - 90 bpm @wolfbrx.mp3",
  "16 bit calm beast cut": "calm-beast.mp3",
};

export function legacyFileForProductTitle(title?: string | null) {
  const needle = normalized(title || "");
  if (!needle) return null;
  const exact = PRODUCT_TITLE_FILES[needle];
  if (exact) return exact;
  return (
    LEGACY_CATALOGUE_FILES.find((filename) => {
      const candidate = normalized(filename);
      return candidate.includes(needle) || needle.includes(candidate);
    }) || null
  );
}
