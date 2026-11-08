import type { Metadata } from "next";
import type { ReactNode } from "react";
import { seededStorefront } from "@/lib/marketplace-storefronts";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = seededStorefront(slug)?.name || decodeURIComponent(slug).replace(/-/g, " ");
  return { title: `${name} on BVS Marketplace` };
}

export default function MarketplaceStoreLayout({ children }: { children: ReactNode }) {
  return children;
}
