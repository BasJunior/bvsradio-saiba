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
