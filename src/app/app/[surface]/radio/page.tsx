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
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
      <p className="text-xs uppercase tracking-[.18em] text-brand">
        The BVS station
      </p>
      <h1 className="mb-6 mt-2 text-4xl font-semibold">Radio</h1>
      <RadioPlayer />
      <SharedProgrammeGuide />
    </main>
  );
}
