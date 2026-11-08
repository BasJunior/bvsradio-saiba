import "./studio-workspace.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import StudioProductionShell from "@/components/StudioProductionShell";

export const metadata: Metadata = { title: "Creator Studio" };

export default function CreatorStudioLayout({ children }: { children: ReactNode }) {
  return <StudioProductionShell>{children}</StudioProductionShell>;
}
