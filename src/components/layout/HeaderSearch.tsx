"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import { buildSearchSuggestions, filterSearchSuggestions, searchPageHref, type SearchSurface } from "@/lib/header-search";

export default function HeaderSearch({ iconOnly = false, surface: explicitSurface }: { iconOnly?: boolean; surface?: Exclude<SearchSurface, null> }) {
  const router = useRouter();
  const app = useAppSurface();
  const surface = explicitSurface || (app.appChrome ? app.surface : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<Parameters<typeof buildSearchSuggestions>[0]>({});
  const [loadedSurface, setLoadedSurface] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const surfaceKey = surface || "web";
  const loading = open && loadedSurface !== surfaceKey;

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!rootRef.current?.getClientRects().length) return;
      event.preventDefault();
      flushSync(() => setOpen(true));
      inputRef.current?.focus();
    };
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", shortcut);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", shortcut);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);

  useEffect(() => {
    if (!open || loadedSurface === surfaceKey) return;
    const controller = new AbortController();
    let partialFailure = false;
    const read = async (path: string) => {
      try {
        const response = await fetch(path, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Catalogue unavailable");
        return await response.json();
      } catch {
        partialFailure = true;
        return {};
      }
    };
    Promise.all([
      read("/api/artists"), read("/api/producers"), read("/api/beats"),
      read(`/api/station/tracks${surface ? `?surface=${surface}` : ""}`),
    ]).then(([artists, producers, beats, tracks]) => {
      if (controller.signal.aborted) return;
      setCatalogue({ artists: artists.artists, producers: producers.producers, beats: beats.beats, tracks: tracks.tracks });
      setFailed(partialFailure);
      setLoadedSurface(surfaceKey);
    });
    return () => controller.abort();
  }, [open, loadedSurface, surface, surfaceKey]);

  const suggestions = useMemo(() => loadedSurface === surfaceKey ? filterSearchSuggestions(buildSearchSuggestions(catalogue, surface), query) : [], [catalogue, query, surface, loadedSurface, surfaceKey]);
  const close = () => { setOpen(false); if (iconOnly) triggerRef.current?.focus(); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(searchPageHref(query, surface));
    close();
    inputRef.current?.blur();
  };

  return (
    <div ref={rootRef} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); inputRef.current?.blur(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const links = Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>("[data-search-result]") || []);
        if (!links.length) return;
        event.preventDefault();
        const current = links.indexOf(document.activeElement as HTMLAnchorElement);
        const next = event.key === "ArrowDown" ? (current + 1) % links.length : (current <= 0 ? links.length - 1 : current - 1);
        links[next]?.focus();
      }
    }}>
      {iconOnly ? <button ref={triggerRef} type="button" onClick={() => {
        // Focus within the tap event so iOS also opens the on-screen keyboard.
        flushSync(() => setOpen((value) => !value));
        if (!open) inputRef.current?.focus();
      }} aria-label="Search" aria-expanded={open} aria-controls={open ? listId : undefined} className="grid h-11 w-11 place-items-center rounded-full text-white/62 transition hover:bg-white/[.055] hover:text-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.25" /><path strokeLinecap="round" d="m15.5 15.5 4.25 4.25" /></svg>
      </button> : null}
      {(!iconOnly || open) ? <form onSubmit={submit} role="search" aria-label="Search BVS" className={iconOnly ? "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[80] mx-auto max-w-xl rounded-2xl border border-white/15 bg-bg-primary p-3 shadow-2xl" : "relative w-40 md:w-64"}>
        <div className="flex min-h-11 items-center rounded-full border border-white/15 bg-white/5 focus-within:border-brand/50">
          <span className="pl-4 text-lg text-text-secondary" aria-hidden="true">⌕</span>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setOpen(true)} placeholder="Search BVS" aria-label="Search music, artists, producers and beats" aria-controls={open ? listId : undefined} autoComplete="off" maxLength={160} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-text-primary outline-none" />
          {query ? <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="mr-1 h-9 w-9 shrink-0 rounded-full text-text-secondary" aria-label="Clear search">×</button> : null}
          {iconOnly ? <button type="button" onClick={close} className="mr-3 text-xs text-brand">Close</button> : null}
        </div>
        {open ? <div id={listId} className={iconOnly ? "mt-2 max-h-[min(60dvh,28rem)] overflow-y-auto" : "absolute right-0 top-14 z-[80] max-h-[60dvh] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-white/15 bg-bg-primary p-2 shadow-2xl"}>
          {query.trim().length < 2 ? <p className="px-3 py-4 text-sm text-text-secondary">Type at least 2 characters to find music, artists, producers and beats.</p> : <>
            {loading ? <p role="status" className="px-3 py-3 text-sm text-text-secondary">Finding published content…</p> : null}
            <ul aria-label="Search suggestions">{suggestions.map((item) => <li key={item.id}>
              <Link data-search-result href={item.href} prefetch={false} onClick={close} className="flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-white/[.07] focus:bg-white/[.07] focus:outline-brand">
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-text-primary">{item.title}</span><span className="block truncate text-xs text-text-secondary">{item.subtitle}</span></span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand">{item.kind}</span>
              </Link>
            </li>)}</ul>
            {!loading && !suggestions.length ? <p role="status" className="px-3 py-4 text-sm text-text-secondary">{failed ? "Some suggestions are unavailable. Try again or search all BVS." : "No quick matches. Try another name or search all BVS."}</p> : null}
            {failed && !loading ? <button type="button" onClick={() => setLoadedSurface(null)} className="px-3 py-2 text-sm text-brand">Retry suggestions</button> : null}
            <button type="submit" className="mt-1 w-full rounded-xl border-t border-white/10 px-3 py-3 text-left text-sm font-medium text-brand hover:bg-white/[.07]">Search all BVS for “{query.trim()}” →</button>
          </>}
        </div> : null}
      </form> : null}
    </div>
  );
}
