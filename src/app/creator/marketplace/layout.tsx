import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Marketplace Desk" };

export default function CreatorMarketplaceLayout({ children }: { children: ReactNode }) {
  return children;
}
