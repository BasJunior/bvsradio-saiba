import { notFound } from "next/navigation";
import RadioPlayer from "@/components/RadioPlayer";
import SharedProgrammeGuide from "@/components/radio/SharedProgrammeGuide";

export default async function AppRadioPage({
  params,
}: {
  params: Promise<{ surface: string }>;
}) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return (
    <main className="bvs-app-page bvs-app-radio mx-auto max-w-5xl px-4 pb-14 pt-5 sm:px-6" data-app-accent="lime">
      <header>
        <p className="bvs-app-eyebrow">Independent sound, worldwide</p>
        <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">Radio</h1>
        <p className="mt-2 text-sm text-white/50">The BVS station, live around the clock.</p>
      </header>
      <section className="bvs-app-shelf" aria-label="On air"><RadioPlayer /></section>
      <section className="bvs-app-shelf" aria-label="Programme guide"><SharedProgrammeGuide /></section>
    </main>
  );
}
