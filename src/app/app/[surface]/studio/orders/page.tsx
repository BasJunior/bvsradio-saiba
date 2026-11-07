import { notFound } from "next/navigation";
import { AppStudioOrdersPanel } from "@/components/app-vnext/AppStudioTokenPanels";
import StudioSubHeader from "@/components/app-vnext/StudioSubHeader";

export default async function AppStudioOrdersPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <main data-studio-accent="marketplace" className="bvs-studio-home bvs-app-studio-web mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6">
    <StudioSubHeader href={`/app/${surface}/studio`} eyebrow="Orders" title="Client work" copy="Track service orders, deadlines and deliveries for the people who hired you." />
    <section className="mt-5"><AppStudioOrdersPanel /></section>
  </main>;
}
