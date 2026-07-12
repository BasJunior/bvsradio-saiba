import type { Metadata } from "next";
import RadioPlayer from "@/components/RadioPlayer";

export const metadata: Metadata = {
  title: "Listen Live",
  description: "BVS Radio — Listen live 24/7",
};

export default function RadioPage() {
  // TODO: Replace with the real BVS Radio stream URL
  const streamUrl = "https://YOUR-ACTUAL-STREAM-URL-HERE";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <section className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8 md:p-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Listen Live</h1>
          <p className="text-text-secondary text-lg">
            Tune in 24/7 for the best in music, entertainment, and community programming.
          </p>
        </div>

        {/* Functional Player */}
        <RadioPlayer streamUrl={streamUrl} stationName="BVS Radio Live" />

        {/* Stream Info */}
        <div className="text-center text-text-secondary space-y-2">
          <p>Enjoy our 24/7 live stream featuring the best in music, entertainment, and community programming.</p>
          <p>Tune in anytime for fresh updates, exclusive mixes, and live shows from our talented DJs.</p>
        </div>
      </section>
    </div>
  );
}