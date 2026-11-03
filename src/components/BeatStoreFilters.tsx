"use client";

import { useEffect, useState, type FormEvent } from "react";

export type BeatFilterFields = {
  query: string;
  producer: string;
  genre: string;
  bpm: string;
  vibe: string;
  price: string;
  sort: "newest" | "oldest" | "popular";
};

export const emptyBeatFilters: BeatFilterFields = {
  query: "", producer: "", genre: "All", bpm: "", vibe: "", price: "", sort: "newest",
};

type Props = {
  value: BeatFilterFields;
  producers: string[];
  genres: string[];
  vibes: string[];
  count: number;
  popularityAvailable: boolean;
  onApply: (filters: BeatFilterFields) => void;
  onReset: () => void;
};

const selectStyle = "h-11 w-full min-w-0 rounded-none border border-white/20 bg-[#101010] px-2 text-sm text-white focus:border-[#c1a7ff]";
const labelStyle = "min-w-0";

export default function BeatStoreFilters({
  value, producers, genres, vibes, count, popularityAvailable, onApply, onReset,
}: Props) {
  const [draft, setDraft] = useState<BeatFilterFields>(value);
  useEffect(() => { setDraft(value); }, [value]);
  const update = (field: keyof BeatFilterFields, next: string) =>
    setDraft((previous) => ({ ...previous, [field]: next }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply({ ...draft, query: draft.query.trim() });
  };
  const reset = () => { setDraft(emptyBeatFilters); onReset(); };

  return (
    <form onSubmit={submit} className="mb-5 space-y-3 border border-white/10 bg-[#101010] p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search beats</span>
          <input
            type="search"
            value={draft.query}
            placeholder="Search beats, producers, genres..."
            onChange={(event) => update("query", event.target.value)}
            className="h-12 w-full rounded-none border border-white/20 bg-black/50 px-4 text-sm text-white outline-none placeholder:text-white/45 focus:border-[#c1a7ff]"
          />
        </label>
        <button type="submit" className="h-12 shrink-0 rounded-none border-0 bg-[#c1a7ff] px-8 text-sm font-bold uppercase tracking-wide text-black hover:bg-[#d4c2ff]">
          Search
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <label className={labelStyle}>
          <span className="mb-1 block text-xs text-text-secondary">Producer</span>
          <select aria-label="Filter beats by producer" value={draft.producer} onChange={(e) => update("producer", e.target.value)} className={selectStyle}>
            <option value="">All producers</option>
            {producers.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className={labelStyle}>
          <span className="mb-1 block text-xs text-text-secondary">Beat genre</span>
          <select aria-label="Filter beats by genre" value={draft.genre} onChange={(e) => update("genre", e.target.value)} className={selectStyle}>
            <option value="All">All genres</option>
            {genres.filter((name) => name !== "All").map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className={labelStyle}>
          <span className="mb-1 block text-xs text-text-secondary">BPM</span>
          <select aria-label="Filter beats by BPM" value={draft.bpm} onChange={(e) => update("bpm", e.target.value)} className={selectStyle}>
            <option value="">Any BPM</option>
            <option value="under80">Under 80</option>
            <option value="80to99">80–99</option>
            <option value="100to119">100–119</option>
            <option value="120to139">120–139</option>
            <option value="140to159">140–159</option>
            <option value="160plus">160+</option>
          </select>
        </label>
        <label className={labelStyle}>
          <span className="mb-1 block text-xs text-text-secondary">Vibe</span>
          <select aria-label="Filter beats by vibe" value={draft.vibe} onChange={(e) => update("vibe", e.target.value)} className={selectStyle}>
            <option value="">All vibes</option>
            {vibes.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className={labelStyle}>
          <span className="mb-1 block text-xs text-text-secondary">Starting price</span>
          <select aria-label="Filter beats by starting price" value={draft.price} onChange={(e) => update("price", e.target.value)} className={selectStyle}>
            <option value="">Any price</option>
            <option value="under25">Under $25</option>
            <option value="25to49">$25–$49</option>
            <option value="50to99">$50–$99</option>
            <option value="100plus">$100+</option>
          </select>
        </label>
        <label className={labelStyle}>
          <span className="mb-1 block text-xs text-text-secondary">Sort by</span>
          <select aria-label="Sort beats" value={draft.sort} onChange={(e) => update("sort", e.target.value)} className={selectStyle}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="popular">Popularity (30 days)</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={reset} className="text-xs font-semibold text-[#c1a7ff] underline underline-offset-4">
          Clear filters
        </button>
        <span className="text-xs text-text-secondary">
          {value.sort === "popular" && !popularityAvailable
            ? "Popularity data unavailable; showing newest first."
            : count + " matching " + (count === 1 ? "beat" : "beats")}
        </span>
      </div>
    </form>
  );
}
