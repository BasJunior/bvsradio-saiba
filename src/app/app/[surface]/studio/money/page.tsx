import { notFound } from "next/navigation";
import { AppStudioMoneyPanel } from "@/components/app-vnext/AppStudioTokenPanels";
import StudioSubHeader from "@/components/app-vnext/StudioSubHeader";

export default async function AppStudioMoneyPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <main data-studio-accent="money" className="bvs-studio-home bvs-app-studio-web mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6">
    <StudioSubHeader href={`/app/${surface}/studio`} eyebrow="Money" title="Your earnings" copy="See what you’ve earned from listening and sales, what’s still pending, and what’s ready to be paid out." />
    <section className="mt-5"><AppStudioMoneyPanel /></section>
  </main>;
}
