import type { ReactNode } from "react";

/** Staff tools share the editorial look. Access control stays in each page and API. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="bvs-editorial-page">{children}</div>;
}
