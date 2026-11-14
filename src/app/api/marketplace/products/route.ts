import { NextResponse } from "next/server";
import { creatorHeaders, creatorUrl } from "@/lib/creator-server";
import {
  SHELF_DETAIL_COLUMNS,
  SHELF_FIXTURE_ROWS,
  SHELF_LIST_COLUMNS,
  isShelfSlug,
  shelfProductFromRow,
  type ShelfListingRow,
} from "@/lib/product-shelf";

export const runtime = "nodejs";

const PUBLISHED_PRODUCTS = "creator_marketplace_listings?status=eq.published&listing_type=eq.digital_product";

// Fixtures exist for local layout review only and can never load in production.
function fixturesEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.BVS_SHELF_FIXTURES === "1";
}

async function rows(path: string): Promise<ShelfListingRow[]> {
  const response = await fetch(creatorUrl(path), { headers: creatorHeaders, cache: "no-store" });
  if (!response.ok) throw new Error("Shelf data unavailable");
  const data = await response.json();
  return Array.isArray(data) ? (data as ShelfListingRow[]) : [];
}

/**
 * Public product shelf.
 *   GET /api/marketplace/products          -> { products }
 *   GET /api/marketplace/products?slug=... -> { product } (includes full licence terms)
 * Only published digital products are returned and the private download path
 * is never selected; files are delivered through /api/download after payment.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() || "";
  if (slug && !isShelfSlug(slug)) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  try {
    if (fixturesEnabled()) {
      const products = SHELF_FIXTURE_ROWS.map((row) => ({ ...shelfProductFromRow(row), fixture: true }));
      if (!slug) return NextResponse.json({ products });
      const product = products.find((item) => item.slug === slug);
      return product ? NextResponse.json({ product }) : NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (slug) {
      const found = await rows(`${PUBLISHED_PRODUCTS}&slug=eq.${encodeURIComponent(slug)}&select=${SHELF_DETAIL_COLUMNS}&limit=1`);
      return found[0]
        ? NextResponse.json({ product: shelfProductFromRow(found[0]) })
        : NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    const listed = await rows(`${PUBLISHED_PRODUCTS}&select=${SHELF_LIST_COLUMNS}&order=published_at.desc&limit=200`);
    return NextResponse.json({ products: listed.map(shelfProductFromRow) });
  } catch {
    return NextResponse.json({ error: "The shelf could not be loaded. Please try again." }, { status: 503 });
  }
}
