import type { ReactNode } from "react";
import EditorialArtworkShortcut from "@/components/EditorialArtworkShortcut";

export default function EditorialLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="border-b border-white/10 bg-bg-primary/95">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <EditorialArtworkShortcut />
        </div>
      </div>
      {children}
    </>
  );
}
