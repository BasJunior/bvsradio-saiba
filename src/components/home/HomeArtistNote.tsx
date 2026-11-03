"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStationPlayer } from "@/components/StationPlayer";

type Artist = {
  username: string;
  name: string;
  role: string;
  bio: string;
  image: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default function HomeArtistNote() {
  const player = useStationPlayer();
  const [artists, setArtists] = useState<Artist[]>([]);
  const currentArtist = player.current?.artist || "";

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 10000);
    fetch("/api/artists?limit=24", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ artists?: Artist[] }> : Promise.reject())
      .then((payload) => {
        if (active) setArtists(Array.isArray(payload?.artists) ? payload.artists.filter(item => item && typeof item.name === "string" && typeof item.username === "string") : []);
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(deadline));
    return () => { active = false; window.clearTimeout(deadline); controller.abort(); };
  }, []);

  const artist = useMemo(() => {
    const target = normalize(currentArtist.split(/\s*(?:,|feat\.?|ft\.?|&)\s*/i)[0] || currentArtist);
    if (!target) return null;
    return artists.find((item) => {
      const name = normalize(item.name);
      return Boolean(name) && name === target;
    }) || null;
  }, [artists, currentArtist]);

  if (!player.current) return null;

  const note = artist?.bio || `Discover more from ${player.current.artist}, explore the connections behind the music, or keep listening to your next favourite.`;

  return (
    <section className="mt-4 flex h-[220px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/10 p-4 sm:h-[232px] sm:p-5" aria-labelledby="home-artist-note-title">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- live artist portrait */}
        {artist?.image ? <img src={artist.image} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-2xl object-cover" /> : null}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Behind the sound</p>
          <h2 id="home-artist-note-title" className="mt-1 truncate text-base font-semibold">{artist?.name || player.current.artist}</h2>
          <p className="text-xs text-text-secondary">{artist?.role || "Independent sound on BVS"}</p>
        </div>
      </div>
      {artist?.bio ? (
        <p className="mt-4 line-clamp-3 overflow-hidden border-l-2 border-brand/60 pl-3 text-sm leading-relaxed text-white/75" title={note}>
          {note}
        </p>
      ) : (
        <p className="mt-4 line-clamp-3 overflow-hidden text-sm leading-relaxed text-white/65" title={note}>{note}</p>
      )}
      {artist ? (
        <Link href={`/artist/${encodeURIComponent(artist.username)}`} className="mt-auto inline-flex text-sm font-semibold text-brand hover:underline">
          View artist profile →
        </Link>
      ) : null}
    </section>
  );
}
