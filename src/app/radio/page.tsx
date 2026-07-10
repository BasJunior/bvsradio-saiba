import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Listen Live",
  description: "BVS Radio — Listen live 24/7",
};

export default function RadioPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <section className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8 md:p-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Listen Live</h1>
          <p className="text-text-secondary text-lg">
            Tune in 24/7 for the best in music, entertainment, and community programming.
          </p>
        </div>

        {/* Player Card */}
        <div className="bg-gradient-to-br from-brand/10 to-accent/5 rounded-2xl p-8 border border-white/10 mb-8">
          {/* Artwork */}
          <div className="flex justify-center mb-8">
            <div className="relative w-48 h-48 md:w-64 md:h-64">
              <Image
                src="/assets/images/Bvsradio_logo.png"
                alt="BVS Radio"
                width={256}
                height={256}
                className="rounded-2xl shadow-2xl"
              />
              {/* Equalizer overlay when playing */}
              <div className="absolute bottom-4 right-4 flex items-end gap-1">
                {[12, 8, 16, 10, 14].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-brand rounded-full equalizer-bar"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Player Info */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">BVS Radio Live</h2>
            <p className="text-text-secondary">Streaming Now</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="h-1.5 bg-white/10 rounded-full mb-2">
              <div className="h-full w-1/3 bg-brand rounded-full" />
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span>0:00</span>
              <span>∞</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6">
            <button className="text-text-secondary hover:text-text-primary transition-colors" aria-label="Previous">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button className="w-16 h-16 bg-brand rounded-full flex items-center justify-center text-black hover:bg-brand-dark transition-all hover:scale-105" aria-label="Play/Pause">
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button className="text-text-secondary hover:text-text-primary transition-colors" aria-label="Next">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue={70}
              className="w-32 accent-brand"
            />
          </div>
        </div>

        {/* Stream Info */}
        <div className="text-center text-text-secondary space-y-2">
          <p>Enjoy our 24/7 live stream featuring the best in music, entertainment, and community programming.</p>
          <p>Tune in anytime for fresh updates, exclusive mixes, and live shows from our talented DJs.</p>
        </div>
      </section>
    </div>
  );
}