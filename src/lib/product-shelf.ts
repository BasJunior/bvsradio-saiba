import { mediaUrlForStoredValue } from "@/lib/media-url";
import { canonicalMarketplaceStorefrontSlug } from "@/lib/marketplace-storefronts";
import { readCartLines, writeCartLines } from "@/lib/cart-client";

/**
 * BVS product shelf: the public storefront for creator digital products.
 *
 * It reads the existing creator_marketplace_listings (listing_type =
 * 'digital_product') and sells through the existing `creator_product` checkout
 * line, so prices, licence terms, seller settlement and private delivery stay
 * in the one commerce system. Nothing here creates a second catalogue.
 */

export const SHELF_CATEGORIES = [
  { id: "drum_kit", label: "Drum kits", blurb: "One-shots ready to load into any sampler." },
  { id: "sample_pack", label: "Sample packs", blurb: "Original sounds, textures and hits." },
  { id: "loop_pack", label: "Loops", blurb: "Melodies, percussion and vocal loops to build on." },
  { id: "midi_pack", label: "MIDI packs", blurb: "Editable drum patterns, chords and melodies." },
  { id: "preset", label: "Presets", blurb: "Synth and effect settings for a sound, fast." },
  { id: "template", label: "Templates", blurb: "Session and mix templates to start from." },
  { id: "stems", label: "Stems", blurb: "Separated parts for remixing and practice." },
  { id: "other", label: "More tools", blurb: "Other creator downloads." },
] as const;

export type ShelfCategoryId = (typeof SHELF_CATEGORIES)[number]["id"];

const CATEGORY_IDS = new Set<string>(SHELF_CATEGORIES.map((category) => category.id));

export function shelfCategoryLabel(id: string) {
  return SHELF_CATEGORIES.find((category) => category.id === id)?.label || "More tools";
}

export function isShelfSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,90}$/.test(value);
}

/** Columns the public shelf may read. The private asset_path is never selected. */
export const SHELF_LIST_COLUMNS =
  "id,seller_user_id,category,title,slug,description,price_usd,artwork_path,preview_path,compatibility,licence_summary,published_at,profiles!inner(username,display_name,creator_public_name)";
export const SHELF_DETAIL_COLUMNS = `${SHELF_LIST_COLUMNS},licence_terms`;

export type ShelfListingRow = {
  id: string;
  seller_user_id?: string;
  category?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  price_usd: number | string;
  artwork_path?: string | null;
  preview_path?: string | null;
  compatibility?: string | null;
  licence_summary?: string | null;
  licence_terms?: string | null;
  published_at?: string | null;
  profiles?: {
    username?: string | null;
    display_name?: string | null;
    creator_public_name?: string | null;
  } | null;
};

export type ShelfProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ShelfCategoryId;
  categoryLabel: string;
  priceUsd: number;
  artworkUrl: string | null;
  previewUrl: string | null;
  compatibility: string;
  licenceSummary: string;
  licenceTerms?: string;
  sellerName: string;
  storefrontSlug: string;
  publishedAt: string | null;
  /** True only for local development fixtures. Never set for database rows. */
  fixture?: boolean;
};

export function shelfProductFromRow(row: ShelfListingRow): ShelfProduct {
  const category = (CATEGORY_IDS.has(String(row.category)) ? row.category : "other") as ShelfCategoryId;
  const sellerName =
    row.profiles?.creator_public_name?.trim() ||
    row.profiles?.display_name?.trim() ||
    row.profiles?.username?.trim() ||
    "BVS creator";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: String(row.description || ""),
    category,
    categoryLabel: shelfCategoryLabel(category),
    priceUsd: Math.round((Number(row.price_usd) || 0) * 100) / 100,
    artworkUrl: mediaUrlForStoredValue(row.artwork_path),
    previewUrl: mediaUrlForStoredValue(row.preview_path),
    compatibility: String(row.compatibility || ""),
    licenceSummary: String(row.licence_summary || ""),
    ...(row.licence_terms === undefined ? {} : { licenceTerms: String(row.licence_terms || "") }),
    sellerName,
    storefrontSlug: canonicalMarketplaceStorefrontSlug(sellerName),
    publishedAt: row.published_at || null,
  };
}

export function shelfPrice(priceUsd: number) {
  return `US$${priceUsd.toFixed(2)}`;
}

/**
 * Puts one copy of a product in the shared BVS cart. The server re-reads the
 * title, price, seller and licence at checkout, so these values are display only.
 */
export function addShelfProductToCart(product: Pick<ShelfProduct, "id" | "title" | "sellerName" | "priceUsd">) {
  const lines = readCartLines();
  const existing = lines.findIndex((line) => String(line.id) === product.id && line.type === "creator_product");
  const next = [...lines];
  if (existing >= 0) next[existing] = { ...next[existing], quantity: 1 };
  else
    next.push({
      id: product.id,
      title: product.title,
      artist: product.sellerName,
      type: "creator_product",
      price: product.priceUsd,
      quantity: 1,
      delivery: "Private download after confirmed payment",
    });
  writeCartLines(next);
}

/**
 * The first products BVS plans to put on the shelf. These are NOT for sale:
 * they render as "Coming soon" until a real listing in the same category is
 * published through the Creator Marketplace review. Prices are proposals.
 */
export type PlannedShelfProduct = {
  key: string;
  title: string;
  category: ShelfCategoryId;
  proposedPriceUsd: number;
  pitch: string;
  contents: string;
  /** What must be true before this can be published. */
  rightsRequirement: string;
};

export const PLANNED_SHELF_PRODUCTS: PlannedShelfProduct[] = [
  {
    key: "zim-drum-kit-vol-1",
    title: "BVS Zim Drum Kit Vol. 1",
    category: "drum_kit",
    proposedPriceUsd: 9,
    pitch: "Punchy kicks, snares, claps, hats and percussion shaped for Zim dancehall, Afrobeats and hip-hop.",
    contents: "About 60 one-shot WAV files, sorted by type.",
    rightsRequirement: "Every sound designed or recorded by the listed producer. No sounds lifted from other kits or records.",
  },
  {
    key: "mbira-marimba-loops-vol-1",
    title: "Mbira & Marimba Loops Vol. 1",
    category: "loop_pack",
    proposedPriceUsd: 12,
    pitch: "Original mbira and marimba phrases, tempo-labelled and ready to chop.",
    contents: "About 25 WAV loops with key and BPM in each file name.",
    rightsRequirement: "Original performances only, with written consent from each player to sell the recordings royalty-free.",
  },
  {
    key: "african-percussion-pack",
    title: "African Percussion Pack",
    category: "sample_pack",
    proposedPriceUsd: 10,
    pitch: "Hosho, ngoma and hand-percussion hits and grooves recorded in studio.",
    contents: "One-shots plus short grooves, WAV.",
    rightsRequirement: "Recorded by BVS or the listed creator, with performer consent on file.",
  },
  {
    key: "afro-dancehall-midi-pack",
    title: "Afro & Zim Dancehall MIDI Pack",
    category: "midi_pack",
    proposedPriceUsd: 7,
    pitch: "Drum patterns and chord progressions you can drop on any sound and edit freely.",
    contents: "About 40 MIDI files grouped by tempo and style.",
    rightsRequirement: "Patterns written by the listed producer; no transcriptions of existing songs.",
  },
  {
    key: "vocal-mix-template",
    title: "BVS Vocal Mix Template",
    category: "template",
    proposedPriceUsd: 10,
    pitch: "A ready vocal chain and session layout built with stock plugins, so it opens on any setup.",
    contents: "Session template plus a one-page setup guide.",
    rightsRequirement: "Built by the listed engineer using stock plugins only; no third-party plugin presets redistributed.",
  },
];

/** Planned products whose category still has nothing live on the shelf. */
export function plannedProductsToShow(live: Pick<ShelfProduct, "category">[]) {
  const liveCategories = new Set(live.map((product) => product.category));
  return PLANNED_SHELF_PRODUCTS.filter((planned) => !liveCategories.has(planned.category));
}

/**
 * Local development only: sample rows so the storefront can be reviewed
 * without a database. Guarded by NODE_ENV and an explicit flag in the API.
 */
export const SHELF_FIXTURE_ROWS: ShelfListingRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    category: "drum_kit",
    title: "[Fixture] Sample Drum Kit",
    slug: "fixture-sample-drum-kit",
    description: "Development fixture. Not a real product and cannot be bought.",
    price_usd: 9,
    compatibility: "Any DAW or sampler that loads WAV",
    licence_summary: "Royalty-free use in your own music. No reselling the sounds on their own.",
    licence_terms: "Fixture licence text for layout review only.",
    published_at: "2026-11-01T10:00:00.000Z",
    profiles: { username: "fixture-producer", creator_public_name: "Fixture Producer" },
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    category: "midi_pack",
    title: "[Fixture] Sample MIDI Pack",
    slug: "fixture-sample-midi-pack",
    description: "Development fixture. Not a real product and cannot be bought.",
    price_usd: 7,
    compatibility: "Any DAW",
    licence_summary: "Royalty-free use in your own music.",
    licence_terms: "Fixture licence text for layout review only.",
    published_at: "2026-11-02T10:00:00.000Z",
    profiles: { username: "fixture-producer", creator_public_name: "Fixture Producer" },
  },
];
