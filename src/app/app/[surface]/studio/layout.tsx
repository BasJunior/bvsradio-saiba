import type { ReactNode } from "react";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <div className="bvs-square-studio">{children}</div>;
}
