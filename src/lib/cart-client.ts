/** Browser cart helpers — localStorage key shared with catalogue/checkout. */

export const BVS_CART_KEY = "bvs_cart"
export const BVS_CART_EVENT = "bvs:cart-updated"

export type BvsCartLine = {
  id?: string
  quantity?: number
  [key: string]: unknown
}

export function readCartLines(): BvsCartLine[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(BVS_CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as BvsCartLine[]) : []
  } catch {
    return []
  }
}

/** Sum of line quantities (defaults each line to 1). */
export function cartItemCount(lines: BvsCartLine[] = readCartLines()): number {
  return lines.reduce((sum, line) => {
    const q = Number(line?.quantity)
    return sum + (Number.isFinite(q) && q > 0 ? Math.floor(q) : 1)
  }, 0)
}

export function writeCartLines(lines: BvsCartLine[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(BVS_CART_KEY, JSON.stringify(lines))
  notifyCartUpdated(cartItemCount(lines))
}

export function clearCartLines(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(BVS_CART_KEY)
  notifyCartUpdated(0)
}

export function notifyCartUpdated(count?: number): void {
  if (typeof window === "undefined") return
  const next = typeof count === "number" ? count : cartItemCount()
  window.dispatchEvent(
    new CustomEvent(BVS_CART_EVENT, {
      detail: { count: next },
    }),
  )
}

/** Add or refresh a single track download line, then optionally go to checkout. */
export function upsertTrackCartLine(input: {
  id: string
  title: string
  artist?: string
  price: number
  artwork?: string
  src?: string
  quantity?: number
}): BvsCartLine[] {
  const price = Number(input.price)
  if (!input.id || !Number.isFinite(price) || price <= 0) return readCartLines()
  const lines = readCartLines().filter((line) => String(line.id) !== String(input.id))
  const next: BvsCartLine = {
    id: input.id,
    title: input.title,
    artist: input.artist || "",
    type: "single",
    price,
    quantity: input.quantity && input.quantity > 0 ? Math.floor(input.quantity) : 1,
    artwork: input.artwork || "",
    src: input.src || "",
    delivery: "Personal download released after payment is confirmed.",
  }
  const merged = [...lines, next]
  writeCartLines(merged)
  return merged
}

/** Add the authoritative selected licence for one beat. A new tier replaces the previous tier for that beat. */
export function upsertBeatLicenceCartLine(input: {
  beatId: string
  licenceOptionId: string
  title: string
  producer?: string
  licenceName?: string
  price: number
  artwork?: string
  src?: string
}): BvsCartLine[] {
  const price = Number(input.price)
  if (!input.beatId || !input.licenceOptionId || !Number.isFinite(price) || price <= 0) return readCartLines()
  const lines = readCartLines().filter((line) => !(String(line.id) === String(input.beatId) && String(line.type || "") === "beat"))
  const next: BvsCartLine = {
    id: input.beatId,
    title: input.title,
    artist: input.producer || "BVS producer",
    type: "beat",
    price,
    quantity: 1,
    artwork: input.artwork || "",
    src: input.src || "",
    licence_option_id: input.licenceOptionId,
    licence_name: input.licenceName || "Beat licence",
    delivery: `${input.licenceName || "Beat licence"} — licensed files and terms released after payment is confirmed.`,
  }
  const merged = [...lines, next]
  writeCartLines(merged)
  return merged
}
