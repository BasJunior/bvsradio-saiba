"use client";

import { useEffect } from "react";

type BeatRow = {
  id?: string;
  title?: string;
  producer?: string;
  genre?: string | null;
  bpm?: number | string | null;
  startingPrice?: number | string | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  popularityScore?: number | null;
  plays?: number | null;
  saves?: number | null;
  shares?: number | null;
};

const normalize = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export default function BeatStoreSortBar() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") !== "beat") return;

    let disposed = false;
    let rows: BeatRow[] = [];
    let originalOrder = new Map<HTMLElement, number>();

    const findDirectory = () =>
      document.querySelector<HTMLElement>('section[data-beat-directory="true"]');

    const findBrowseHeading = () =>
      Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,p,div")).find(
        (node) => normalize(node.textContent) === "browse beats",
      );

    const beatForCard = (card: HTMLElement) => {
      const title = normalize(card.querySelector("h2")?.textContent);
      const producer = normalize(Array.from(card.querySelectorAll("p"))[0]?.textContent);
      return (
        rows.find((beat) => normalize(beat.title) === title && normalize(beat.producer) === producer) ||
        rows.find((beat) => normalize(beat.title) === title)
      );
    };

    const apply = () => {
      if (disposed) return;
      const directory = findDirectory();
      const bar = document.querySelector<HTMLElement>("[data-beat-sort-bar]");
      if (!directory || !bar) return;

      const input = bar.querySelector<HTMLInputElement>("input");
      const select = bar.querySelector<HTMLSelectElement>("select");
      const query = normalize(input?.value);
      const mode = select?.value || "newest";
      const cards = Array.from(directory.querySelectorAll<HTMLElement>("article"));

      if (originalOrder.size === 0) {
        originalOrder = new Map(cards.map((card, index) => [card, index]));
      }

      cards.forEach((card) => {
        const beat = beatForCard(card);
        const haystack = normalize(
          [
            card.querySelector("h2")?.textContent,
            Array.from(card.querySelectorAll("p"))[0]?.textContent,
            beat?.genre,
            beat?.bpm,
            beat?.startingPrice,
          ]
            .filter(Boolean)
            .join(" "),
        );
        card.style.display = !query || haystack.includes(query) ? "" : "none";
      });

      const visible = cards.filter((card) => card.style.display !== "none");
      const priceOf = (beat?: BeatRow) => Number(beat?.startingPrice) || Number.POSITIVE_INFINITY;
      const bpmOf = (beat?: BeatRow) => Number(String(beat?.bpm ?? "").replace(/\D/g, "")) || Number.POSITIVE_INFINITY;
      const dateOf = (beat?: BeatRow) => {
        const value = beat?.publishedAt || beat?.createdAt;
        const timestamp = value ? Date.parse(value) : 0;
        return Number.isFinite(timestamp) ? timestamp : 0;
      };
      const popularityOf = (beat?: BeatRow) =>
        Number(beat?.popularityScore) ||
        Number(beat?.plays) + Number(beat?.saves) * 3 + Number(beat?.shares) * 4 ||
        0;

      visible.sort((a, b) => {
        const beatA = beatForCard(a);
        const beatB = beatForCard(b);
        if (mode === "producer") return normalize(beatA?.producer).localeCompare(normalize(beatB?.producer));
        if (mode === "price") return priceOf(beatA) - priceOf(beatB);
        if (mode === "bpm") return bpmOf(beatA) - bpmOf(beatB);
        if (mode === "genre") return normalize(beatA?.genre).localeCompare(normalize(beatB?.genre));
        if (mode === "popular") {
          const delta = popularityOf(beatB) - popularityOf(beatA);
          return delta || (originalOrder.get(a) || 0) - (originalOrder.get(b) || 0);
        }
        const delta = dateOf(beatB) - dateOf(beatA);
        return delta || (originalOrder.get(a) || 0) - (originalOrder.get(b) || 0);
      });

      visible.forEach((card) => directory.appendChild(card));
    };

    const mount = () => {
      if (disposed || document.querySelector("[data-beat-sort-bar]")) return;
      const directory = findDirectory();
      const heading = findBrowseHeading();
      if (!directory || !heading) return;

      const bar = document.createElement("div");
      bar.dataset.beatSortBar = "true";
      bar.className = "mb-4 flex h-8 w-full items-stretch border border-white/15 bg-black/20";
      bar.innerHTML = `
        <input
          aria-label="Search beats"
          placeholder="Search beats"
          class="min-w-0 flex-1 bg-transparent px-3 text-[11px] uppercase tracking-[0.12em] text-white outline-none placeholder:text-white/35"
        />
        <select
          aria-label="Sort beats"
          class="w-[10.5rem] border-l border-white/15 bg-black px-2 text-[11px] uppercase tracking-[0.12em] text-white outline-none"
        >
          <option value="producer">Producer</option>
          <option value="price">Price</option>
          <option value="bpm">BPM</option>
          <option value="genre">Genre</option>
          <option value="newest" selected>Newest</option>
          <option value="popular">Most popular</option>
        </select>
      `;

      heading.insertAdjacentElement("afterend", bar);
      bar.querySelector("input")?.addEventListener("input", apply);
      bar.querySelector("select")?.addEventListener("change", apply);
      apply();
    };

    fetch("/api/beats?scope=public", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(async (payload: { beats?: BeatRow[]; nextOffset?: number }) => {
        rows = Array.isArray(payload.beats) ? payload.beats : [];
        let nextOffset = payload.nextOffset;
        while (Number.isSafeInteger(nextOffset) && Number(nextOffset) > 0 && !disposed) {
          const response = await fetch(`/api/beats?scope=public&offset=${nextOffset}`, { cache: "no-store" });
          if (!response.ok) break;
          const next = await response.json().catch(() => ({}));
          rows.push(...(Array.isArray(next.beats) ? next.beats : []));
          nextOffset = next.nextOffset;
        }
        mount();
        apply();
      })
      .catch(() => mount());

    const observer = new MutationObserver(() => {
      mount();
      apply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    mount();

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
