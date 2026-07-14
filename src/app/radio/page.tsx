import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import RadioPlayer from "@/components/RadioPlayer";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Listen Live | BVS Radio",
  description: "Stream BVS Radio live 24/7 — Zimbabwe's premier online radio station. Music, culture, and community from Harare to the world.",
};

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg"]);

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^pack\d+_/, "")
    .replace(/_/g, " ")
    .trim();
}

function getLocalTracks() {
  const musicDir = path.join(process.cwd(), "public", "music");

  if (!fs.existsSync(musicDir)) {
    return [];
  }

  return fs
    .readdirSync(musicDir)
    .filter((filename) => AUDIO_EXTENSIONS.has(path.extname(filename).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((filename) => ({
      title: titleFromFilename(filename),
      artist: "BVS Radio",
      src: `/music/${encodeURIComponent(filename)}`,
    }));
}

export default function RadioPage() {
  const tracks = getLocalTracks();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
        <div>
          <h1 className="text-5xl font-semibold tracking-[-0.025em] mb-4">Listen Live</h1>
          <p className="text-xl text-text-secondary mb-6">
            The soundtrack of Zimbabwe. Broadcasting 24/7 in true HiFi from Harare with the best in local and African music, 
            exclusive interviews, and cultural conversations.
          </p>
          <div className="flex flex-wrap gap-2 text-sm text-text-secondary">
            <span>Live daily broadcasts</span>
            <span className="opacity-40">·</span>
            <span>Global audience</span>
            <span className="opacity-40">·</span>
            <span>Zimbabwean sound</span>
          </div>
        </div>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/10">
          <Image 
            src="/images/mic-closeup.jpg" 
            alt="BVS Radio microphone in studio" 
            fill 
            className="object-cover" 
          />
        </div>
      </div>

      {/* Live Player */}
      <div className="max-w-md mx-auto mb-12">
        <RadioPlayer tracks={tracks} stationName="BVS Radio Live" />
        <div className="text-center mt-4 text-xs text-text-secondary">
          Playing the preserved BVS Radio library with {tracks.length} tracks from the VPS and WolfBrx packs.
        </div>
      </div>

      {/* Browse like Spotify */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Browse the Catalogue</h2>
          <Link href="/catalogue" className="text-brand hover:underline text-sm">See all</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: "Harare Nights", artist: "BVS Collective", img: "/images/festival-crowd.jpg" },
            { title: "Vibrations", artist: "Wolf Bridges", img: "/images/musicians.jpg" },
            { title: "Shona Soul", artist: "BVS Artists", img: "/images/hero-studio.jpg" },
            { title: "City Lights", artist: "BVS Collective", img: "/images/female-host.jpg" },
          ].map((track, i) => (
            <Link key={i} href="/catalogue" className="group bg-bg-card/50 rounded-xl overflow-hidden border border-white/10 hover:border-brand/40 flex items-center gap-3 p-2">
              <div className="relative w-16 h-16 flex-shrink-0">
                <Image src={track.img} alt={track.title} fill className="object-cover rounded" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate group-hover:text-brand">{track.title}</p>
                <p className="text-sm text-text-secondary truncate">{track.artist}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-12 text-center text-sm text-text-secondary">
        Love a track? Double-click it in <Link href="/catalogue" className="text-brand hover:underline">Browse</Link> to see the full album and purchase the download. Or get it mixed/mastered by <Link href="/shop" className="text-brand hover:underline">Wolf Bridges</Link>.
      </div>
    </div>
  );
}
