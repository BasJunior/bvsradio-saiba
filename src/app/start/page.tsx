import type { Metadata } from "next";
import { AppSessionProvider } from "@/components/app-vnext/AppSessionProvider";
import ActivationStartClient from "@/components/ActivationStartClient";

export const metadata: Metadata = {
  title: "Start with BVS",
  description: "Finish the few actions that make BVS useful to you from day one.",
};

export default function StartPage() {
  return (
    <AppSessionProvider>
      <ActivationStartClient />
    </AppSessionProvider>
  );
}
