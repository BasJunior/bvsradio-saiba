import { notFound } from "next/navigation";
import { AppStudioInsightsPanel } from "@/components/app-vnext/AppStudioTokenPanels";
import StudioSubHeader from "@/components/app-vnext/StudioSubHeader";

export default async function AppStudioInsightsPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <main data-studio-accent="insights" className="bvs-studio-home bvs-app-studio-web mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6">
    <StudioSubHeader href={`/app/${surface}/studio`} eyebrow="Insights" title="How your music is doing" copy="Plays, saves and follows show attention. They’re shown separately from your earnings, which live in Money." />
    <section className="mt-5"><AppStudioInsightsPanel /></section>
  </main>;
}
