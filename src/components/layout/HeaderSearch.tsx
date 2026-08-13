"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { discoveryItems } from "@/lib/discovery";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import { appExplore } from "@/lib/app-surface";

type Suggestion = { id: string; title: string; subtitle: string; href: string; kind: string };

export default function HeaderSearch() {
  const router = useRouter();
  const { surface, appChrome } = useAppSurface();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<Suggestion[]>([]);
  const [loadedRemote, setLoadedRemote] = useState(false);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!focused || loadedRemote) return;
    let active = true;
    Promise.all([
      fetch("/api/artists").then((response) => response.ok ? response.json() : { artists: [] }),
      fetch("/api/producers").then((response) => response.ok ? response.json() : { producers: [] }),
      fetch("/api/beats").then((response) => response.ok ? response.json() : { beats: [] }),
    ]).then(([artistsPayload, producersPayload, beatsPayload]) => {
      if (!active) return;
      const artists = (artistsPayload.artists || []).map((item: { id: string; name: string; username: string; role?: string }) => ({ id: `artist-${item.id}`, title: item.name, subtitle: item.role || "Published artist", href: `/artist/${item.username}`, kind: "Artist" }));
      const producers = (producersPayload.producers || []).map((item: { id: string; name: string; username: string; beatCount?: number }) => ({ id: `producer-${item.id}`, title: item.name, subtitle: `Producer · ${item.beatCount || 0} published beats`, href: `/artist/${item.username}`, kind: "Producer" }));
      const beats = (beatsPayload.beats || []).map((item: { id: string; title: string; producer?: string }) => ({ id: `beat-${item.id}`, title: item.title, subtitle: item.producer || "BVS BeatStore", href: `/catalogue?type=beat&q=${encodeURIComponent(item.title)}#beatstore`, kind: "Beat" }));
      setRemoteSuggestions([...artists, ...producers, ...beats]);
      setLoadedRemote(true);
    }).catch(() => setLoadedRemote(true));
    return () => { active = false; };
  }, [focused, loadedRemote]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!formRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    const local = discoveryItems.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, href: item.href, kind: item.kind }));
    const seen = new Set<string>();
    return [...remoteSuggestions, ...local].filter((item) => {
      if (seen.has(item.href)) return false;
      const matches = `${item.title} ${item.subtitle} ${item.kind}`.toLowerCase().includes(needle);
      if (matches) seen.add(item.href);
      return matches;
    }).slice(0, 6);
  }, [query, remoteSuggestions]);
  const expanded = focused || Boolean(query.trim());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    const base = appChrome && surface ? appExplore(surface) : "/search";
    router.push(value ? `${base}?q=${encodeURIComponent(value)}` : base);
    setFocused(false);
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className={`relative flex h-10 items-center rounded-full border bg-white/5 transition-[width,border-color,background-color] duration-300 ${expanded ? "w-72 border-brand/50 bg-white/[.07]" : "w-36 border-white/15"}`}
      role="search"
    >
      <button type="button" onClick={() => { if (expanded && query.trim()) formRef.current?.requestSubmit(); else inputRef.current?.focus(); }} className="grid h-10 w-10 shrink-0 place-items-center text-lg text-text-secondary hover:text-brand" aria-label={expanded && query.trim() ? "Submit search" : "Open search"}>⌕</button>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => { if (event.key === "Escape") { setFocused(false); inputRef.current?.blur(); } }}
        placeholder="Search BVS"
        aria-label="Search tracks, artists, producers, beats and stories"
        className="min-w-0 flex-1 bg-transparent pr-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
      />
      {query ? (
        <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm text-text-secondary hover:bg-white/10 hover:text-text-primary" aria-label="Clear search">×</button>
      ) : (
        <span className="mr-3 text-xs text-white/35" aria-hidden="true">/</span>
      )}
      {focused && query.trim().length >= 2 ? (
        <div className="absolute right-0 top-12 z-[70] w-[24rem] overflow-hidden rounded-2xl border border-white/15 bg-neutral-950/95 p-2 shadow-2xl backdrop-blur-xl" role="listbox" aria-label="Search suggestions">
          {suggestions.length ? suggestions.map((item) => (
            <Link key={item.id} href={item.href} onClick={() => setFocused(false)} className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 hover:bg-white/[.07] focus:bg-white/[.07] focus:outline-none" role="option">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-text-primary">{item.title}</span><span className="block truncate text-xs text-text-secondary">{item.subtitle}</span></span>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand">{item.kind}</span>
            </Link>
          )) : <p className="px-3 py-4 text-sm text-text-secondary">No quick matches. Press Enter to search all BVS content.</p>}
          <button type="submit" className="mt-1 w-full rounded-xl border-t border-white/10 px-3 py-3 text-left text-sm font-medium text-brand hover:bg-white/[.07]">Search all BVS for “{query.trim()}” →</button>
        </div>
      ) : null}
    </form>
  );
}
