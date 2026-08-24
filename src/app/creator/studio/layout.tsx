import type { ReactNode } from "react";
import StudioProductionShell from "@/components/StudioProductionShell";

export default function CreatorStudioLayout({ children }: { children: ReactNode }) {
  return <StudioProductionShell>{children}</StudioProductionShell>;
}
