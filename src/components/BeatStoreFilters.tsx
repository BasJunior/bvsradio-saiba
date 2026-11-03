"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export type BeatFilterFields = {
  query: string;
  producers: string[];
  genres: string[];
  bpms: string[];
  vibes: string[];
  prices: string[];
  sort: "newest" | "oldest" | "popular";
};

export const emptyBeatFilters: BeatFilterFields = {
  query: "", producers: [], genres: [], bpms: [], vibes: [], prices: [], sort: "newest",
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

function FilterMenu({
  label, values, options, allLabel, onChange,
}: {
  label: string;
  values: string[];
  options: MenuOption[];
  allLabel: string;
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedNames = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const summary = !selectedNames.length ? allLabel :
    selectedNames.length === 1 ? selectedNames[0] : selectedNames.length + " selected";

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative min-w-0"
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover)").matches) setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          ref.current?.querySelector<HTMLButtonElement>("[data-filter-trigger]")?.focus();
        }
      }}
    >
      <button
        type="button"
        data-filter-trigger
        aria-label={label + ": " + summary}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((previous) => !previous)}
        className={"flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-none border bg-[#101010] px-3 text-left text-sm text-white " +
          (open ? "border-[#c1a7ff]" : "border-white/20 hover:border-[#c1a7ff]/70")}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <span aria-hidden="true" className="text-[#c1a7ff]">⌄</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 max-h-72 w-full min-w-[12rem] overflow-y-auto border border-[#c1a7ff]/60 bg-[#17131e] p-1 shadow-xl shadow-black/70">
          <button
            type="button"
            onClick={() => onChange([])}
            className={"block w-full px-3 py-2 text-left text-sm hover:bg-[#c1a7ff]/20 " +
              (!values.length ? "text-[#c1a7ff]" : "text-white")}
          >
            {!values.length ? "✓ " : ""}{allLabel}
          </button>
          {options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white hover:bg-[#c1a7ff]/20">
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                onChange={(event) => onChange(event.target.checked ?
                  [...values, option.value] : values.filter((value) => value !== option.value))}
                className="h-4 w-4 shrink-0 accent-[#c1a7ff]"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SortMenu({
  value, onChange,
}: {
  value: BeatFilterFields["sort"];
  onChange: (value: BeatFilterFields["sort"]) => void;
}) {
  return (
    <select
      aria-label="Sort beats"
      value={value}
      onChange={(event) => onChange(event.target.value as BeatFilterFields["sort"])}
      className="h-11 w-full min-w-0 rounded-none border border-white/20 bg-[#101010] px-2 text-sm text-white focus:border-[#c1a7ff]"
    >
      <option value="newest">Newest</option>
      <option value="oldest">Oldest</option>
      <option value="popular">Popularity (30 days)</option>
    </select>
  );
}

export default function BeatStoreFilters({
  value, producers, genres, vibes, count, popularityAvailable, onApply, onReset,
}: Props) {
  const [draft, setDraft] = useState<BeatFilterFields>(value);
  useEffect(() => { setDraft(value); }, [value]);
  const update = <K extends keyof BeatFilterFields>(field: K, next: BeatFilterFields[K]) =>
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
        <FilterMenu label="Producer" allLabel="All producers" values={draft.producers}
          onChange={(next) => update("producers", next)}
          options={producers.map((name) => ({ value: name, label: name }))} />
        <FilterMenu label="Beat genre" allLabel="All genres" values={draft.genres}
          onChange={(next) => update("genres", next)}
          options={genres.filter((name) => name !== "All").map((name) => ({ value: name, label: name }))} />
        <FilterMenu label="BPM" allLabel="Any BPM" values={draft.bpms}
          onChange={(next) => update("bpms", next)}
          options={[
            { value: "under80", label: "Under 80 BPM" },
            { value: "80to99", label: "80–99 BPM" },
            { value: "100to119", label: "100–119 BPM" },
            { value: "120to139", label: "120–139 BPM" },
            { value: "140to159", label: "140–159 BPM" },
            { value: "160plus", label: "160+ BPM" },
          ]} />
        <FilterMenu label="Vibe" allLabel="All vibes" values={draft.vibes}
          onChange={(next) => update("vibes", next)}
          options={vibes.map((name) => ({ value: name, label: name }))} />
        <FilterMenu label="Starting price" allLabel="Any price" values={draft.prices}
          onChange={(next) => update("prices", next)}
          options={[
            { value: "under25", label: "Under $25" },
            { value: "25to49", label: "$25–$49" },
            { value: "50to99", label: "$50–$99" },
            { value: "100plus", label: "$100+" },
          ]} />
        <SortMenu value={draft.sort} onChange={(next) => update("sort", next)} />
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
