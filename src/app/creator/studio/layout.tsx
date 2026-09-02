import type { ReactNode } from "react";
import ArtistActivationNudge from "@/components/ArtistActivationNudge";

export default function CreatorStudioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <ArtistActivationNudge />
      </div>
      {children}
    </>
  );
}
