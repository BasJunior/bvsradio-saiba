import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Editorial" };

/** Editorial pages share one square, hairline look with the rest of BVS. */
export default function EditorialLayout({ children }: { children: ReactNode }) {
  return <div className="bvs-editorial-page">{children}</div>;
}
