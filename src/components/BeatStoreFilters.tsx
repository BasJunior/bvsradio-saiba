"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

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

type MenuOption = { value: string; label: string };

function FilterDropdown({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: MenuOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value)?.label || options[0]?.label || label;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      onMouseEnter={(event) => {
        if (event.pointerType !== "touch" && window.matchMedia("(hover: hover)").matches) setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          rootRef.current?.querySelector<HTMLButtonElement>("[data-filter-trigger]")?.focus();
        }
      }}
    >
      <button
        type="button"
        data-filter-trigger
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className={"flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-none border bg-[#101010] px-3 text-left text-sm text-white outline-none transition-colors " +
          (open ? "border-[#c1a7ff]" : "border-white/20 hover:border-[#c1a7ff]/70") +
          " focus-visible:border-[#c1a7ff]"}
      >
        <span className="min-w-0 truncate">{current}</span>
        <span aria-hidden="true" className="shrink-0 text-[#c1a7ff]">⌄</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[11rem] overflow-y-auto border border-[#c1a7ff]/60 bg-[#17131e] py-1 shadow-xl shadow-black/70"
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={"block w-full px-3 py-2 text-left text-sm hover:bg-[#c1a7ff]/20 focus:bg-[#c1a7ff]/20 focus:outline-none " +
                (option.value === value ? "text-[#c1a7ff]" : "text-white")}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <FilterDropdown label="Producer" value={draft.producer} onChange={(next) => update("producer", next)}
          options={[{ value: "", label: "All producers" }, ...producers.map((name) => ({ value: name, label: name }))]}
        />
        <FilterDropdown label="Beat genre" value={draft.genre} onChange={(next) => update("genre", next)}
          options={[{ value: "All", label: "All genres" }, ...genres.filter((name) => name !== "All").map((name) => ({ value: name, label: name }))]}
        />
        <FilterDropdown label="BPM" value={draft.bpm} onChange={(next) => update("bpm", next)}
          options={[
            { value: "", label: "Any BPM" }, { value: "under80", label: "Under 80 BPM" },
            { value: "80to99", label: "80–99 BPM" }, { value: "100to119", label: "100–119 BPM" },
            { value: "120to139", label: "120–139 BPM" }, { value: "140to159", label: "140–159 BPM" },
            { value: "160plus", label: "160+ BPM" },
          ]}
        />
        <FilterDropdown label="Vibe" value={draft.vibe} onChange={(next) => update("vibe", next)}
          options={[{ value: "", label: "All vibes" }, ...vibes.map((name) => ({ value: name, label: name }))]}
        />
        <FilterDropdown label="Starting price" value={draft.price} onChange={(next) => update("price", next)}
          options={[
            { value: "", label: "Any price" }, { value: "under25", label: "Under $25" },
            { value: "25to49", label: "$25–$49" }, { value: "50to99", label: "$50–$99" },
            { value: "100plus", label: "$100+" },
          ]}
        />
        <FilterDropdown label="Sort beats" value={draft.sort} onChange={(next) => update("sort", next)}
          options={[
            { value: "newest", label: "Newest" }, { value: "oldest", label: "Oldest" },
            { value: "popular", label: "Popularity (30 days)" },
          ]}
        />
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
