"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { discoveryItems } from "@/lib/discovery";
import type { TrendingBoard } from "@/lib/trending";
import { useStationPlayer } from "@/components/StationPlayer";

const ROTATION_INTERVAL_MS = 6_000;

type Slide = {
  id: string;
  title: string;
  artist: string;
  src?: string;
  image?: string;
  href: string;
  rank?: number;
};

function fallbackSlides(): Slide[] {
  return discoveryItems
    .filter((item) => item.kind === "track" && item.image)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.title,
      artist: item.subtitle.split(" · ")[0] || "BVS",
      image: item.image,
      href: item.href,
    }));
}

export default function HomeTopFive() {
  const player = useStationPlayer();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [ranked, setRanked] = useState(false);
  const [settled, setSettled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setMotionAllowed(!preference.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    syncMotion(); syncVisibility();
    preference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => { preference.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", syncVisibility); };
  }, []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 10000);
    fetch("/api/trending?window=week", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<TrendingBoard> : null)
      .then((board) => {
        if (!alive) return;
        const chartSlides = Array.isArray(board?.entries) ? board.entries.filter(entry => entry && entry.id && entry.title && entry.artist).slice(0, 5).map((entry) => ({
          id: entry.id,
          title: entry.title,
          artist: entry.artist,
          src: entry.src,
          image: entry.artwork,
          href: `/song/${encodeURIComponent(entry.id)}`,
          rank: entry.rank,
        })) : [];
        setRanked(Boolean(chartSlides.length));
        setSlides(chartSlides?.length ? chartSlides : fallbackSlides());
      })
      .catch(() => {
        if (alive) setSlides(fallbackSlides());
      })
      .finally(() => { window.clearTimeout(deadline); if (alive) setSettled(true); });
    return () => { alive = false; window.clearTimeout(deadline); controller.abort(); };
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || hovered || focused || !motionAllowed || !visible) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, hovered, focused, motionAllowed, visible]);

  const slide = slides[activeIndex];
  const playableSlide = slide ? player.tracks.find((track) =>
    track.id === slide.id || (track.title === slide.title && track.artist === slide.artist)
  ) : undefined;
  const playSource = slide?.src || playableSlide?.src;

  return (
    <section
      aria-labelledby="home-top-five-title"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#1a1d21] shadow-[0_20px_60px_rgba(0,0,0,.2)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">BVS Discover</p>
          <h2 id="home-top-five-title" className="mt-1 text-lg font-semibold">{ranked || !settled ? "Top 5 this week" : "Discover your next favourite"}</h2>
        </div>
        <Link href={ranked ? "/trending" : "/search"} className="text-xs font-semibold text-brand hover:underline">{ranked ? "Full chart →" : "Explore →"}</Link>
      </div>

      {slide ? (
        <div className="relative">
          <Link href={slide.href} className="group relative block aspect-[16/8] overflow-hidden">
            {slide.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.image} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 sm:p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-black">{ranked ? `#${slide.rank}` : "↗"}</span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold text-white">{slide.title}</span>
                <span className="mt-0.5 block truncate text-sm text-white/70">{slide.artist}</span>
              </span>
            </div>
          </Link>
          <button
            type="button"
            aria-label={`Play ${slide.title}`}
            disabled={!playSource}
            onClick={() => {
              if (!playSource) return;
              player.playNow({
                id: slide.id,
                title: slide.title,
                artist: slide.artist,
                src: playSource,
                artwork: slide.image,
                project: "BVS Top 5",
              }, {
                from: "BVS Top 5",
                related: slides
                  .filter((item) => item.id !== slide.id)
                  .map((item) => {
                    const track = player.tracks.find((candidate) =>
                      candidate.id === item.id || (candidate.title === item.title && candidate.artist === item.artist)
                    );
                    return track || (item.src ? {
                      id: item.id,
                      title: item.title,
                      artist: item.artist,
                      src: item.src,
                      artwork: item.image,
                      project: "BVS Top 5",
                    } : null);
                  })
                  .filter((track): track is NonNullable<typeof track> => Boolean(track)),
              });
            }}
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-brand text-lg font-bold text-black shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 sm:right-5 sm:top-5"
          >
            ▶
          </button>
          <div className="flex items-center gap-2 px-4 py-3 sm:px-5" aria-label="Top five slides">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show ${index + 1} of ${slides.length}, ${item.title}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => { setActiveIndex(index); setPaused(true); }}
                className="grid h-11 w-8 place-items-center rounded-full"
              ><span aria-hidden="true" className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-6 bg-brand" : "w-1.5 bg-white/30"}`} /></button>
            ))}
            {slides.length > 1 ? <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Resume chart rotation" : "Pause chart rotation"} aria-pressed={paused} className="ml-auto min-h-11 px-2 text-xs text-white/65">{paused ? "Resume" : "Pause"}</button> : null}
            <span className="ml-auto text-[11px] tabular-nums text-text-secondary">{activeIndex + 1} / {slides.length}</span>
          </div>
        </div>
      ) : settled ? (
        <div role="status" className="flex aspect-[16/8] flex-col justify-center gap-3 px-5 text-sm text-text-secondary">The chart is taking a break.<Link href="/search" className="font-semibold text-brand">Discover music →</Link></div>
      ) : (
        <div className="aspect-[16/8] animate-pulse bg-white/[.04]" aria-label="Loading weekly chart" />
      )}
    </section>
  );
}
