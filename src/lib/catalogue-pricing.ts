/**
 * Catalogue pricing policy for BVS digital goods.
 *
 * Defaults (USD starting points):
 * - Album / archive single download: $2
 * - Full album package: set explicitly on the product (e.g. $14 / $19)
 * - Beat licence: $29 starting point (terms confirmed before release)
 * - Streaming-only (Spotify / YouTube Music discovery): not sold as download
 *
 * Tax / VAT / reverse charge is applied at checkout by location (see lib/tax.ts).
 * Where a platform or rights deal regulates price, set `price` (or `price: null` + streamOnly) on the track.
 */

export const PRICE_SINGLE_DOWNLOAD = 2
export const PRICE_ARCHIVE_MIX = 4
export const PRICE_BEAT_LICENCE = 29
export const PRICE_SERVICE_DEFAULT = 69

export type PricedCatalogueKind = "single" | "beat" | "mix" | "service" | string

export type PricedCatalogueItem = {
  type?: PricedCatalogueKind
  price?: number | null
  streamOnly?: boolean
  /** True for full-album zip products (not per-song) */
  albumPackage?: boolean
  collection?: string
  title?: string
}

/** Resolve list/checkout price. null = not for sale (stream only / regulated off-sale). */
export function catalogueUnitPrice(item: PricedCatalogueItem): number | null {
  if (item.streamOnly || item.price === null) return null
  if (typeof item.price === "number" && Number.isFinite(item.price)) return item.price

  if (item.type === "beat") return PRICE_BEAT_LICENCE
  if (item.type === "service") return PRICE_SERVICE_DEFAULT
  if (item.albumPackage || isFullAlbumTitle(item.title)) {
    // Full albums must set price explicitly; fallback is a bundle starting point
    return 14
  }
  if (item.type === "mix") return PRICE_ARCHIVE_MIX
  // singles + default track downloads
  return PRICE_SINGLE_DOWNLOAD
}

export function isFullAlbumTitle(title?: string) {
  if (!title) return false
  return /\balbum\b/i.test(title) && !/\b(preview|single|feat)\b/i.test(title)
}

export function offerLabel(item: PricedCatalogueItem): string {
  if (item.streamOnly || item.price === null) return "Streaming only"
  if (item.type === "beat") return "Beat licence"
  if (item.albumPackage || isFullAlbumTitle(item.title)) return "Full album download"
  if (item.type === "mix") return "Archive download"
  if (item.collection && /album|pack|project/i.test(item.collection)) {
    return "Single download"
  }
  return "Single download"
}

export function rightsSummary(item: PricedCatalogueItem): string {
  if (item.streamOnly || item.price === null) {
    return "Streaming discovery listing only. Open the linked streaming page for the full song. BVS does not sell a download for this title (platform / rights rules)."
  }
  if (item.type === "beat") {
    return "Listed price is a standard licence starting point. Usage limits, files, credits and commercial release terms must be confirmed by BVS before release."
  }
  if (item.albumPackage || isFullAlbumTitle(item.title)) {
    return "Full album download for personal listening after payment. Individual songs from this project are also sold as $2 singles where hosted. Copyright stays with the rights holder."
  }
  return "Personal listening download of this single ($2 starting price unless otherwise listed). Copyright and reuse rights remain with the rights holder; this purchase does not grant sampling, sync or redistribution rights."
}

export function priceBadge(item: PricedCatalogueItem): string {
  const p = catalogueUnitPrice(item)
  if (p === null) return "Stream"
  if (item.type === "beat") return `from $${p}`
  return `$${p}`
}
