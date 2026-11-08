import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Cart" };

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
