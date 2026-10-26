"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal, flushSync } from "react-dom";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import { searchPageHref, type SearchSurface } from "@/lib/header-search";
import { containModalTab, lockPageScroll, registerModalLayer } from "@/lib/modal-layer";

import { useDiscoverySearch } from "@/lib/use-discovery-search";

export default function HeaderSearch({ iconOnly = false, surface: explicitSurface }: { iconOnly?: boolean; surface?: Exclude<SearchSurface, null> }) {
  const router = useRouter();
  const app = useAppSurface();
  const surface = explicitSurface || (app.appChrome ? app.surface : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalLayerRef = useRef<ReturnType<typeof registerModalLayer> | null>(null);
  const listId = useId();
  const panelId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const hasSearchIntent = query.trim().length >= 2;
  const search = useDiscoverySearch({ q: query, surface: surface || 'web', view: 'suggestions', limit: 8 }, open && hasSearchIntent);
  const loading = search.loading;
  const failed = search.unavailable.length > 0;
  const suggestions = search.items;

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    // Mobile/icon-only search already has an explicit visible trigger. Avoid a
    // global keyboard listener on that first-frame path.
    if (iconOnly) return;
    const shortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!rootRef.current?.getClientRects().length) return;
      event.preventDefault();
      flushSync(() => setOpen(true));
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [iconOnly]);

  useEffect(() => {
    if (iconOnly) return;
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [iconOnly, open]);

  useEffect(() => {
    if (!iconOnly || !open) return;
    const unlockPage = lockPageScroll();
    const modalLayer = registerModalLayer();
    modalLayerRef.current = modalLayer;
    return () => {
      if (modalLayerRef.current === modalLayer) modalLayerRef.current = null;
      modalLayer.release();
      unlockPage();
    };
  }, [iconOnly, open]);

  const close = () => { setOpen(false); if (iconOnly) triggerRef.current?.focus(); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(searchPageHref(query, surface));
    close();
    inputRef.current?.blur();
  };

  const searchForm = (
    <form onSubmit={submit} role="search" aria-label="Search BVS" className={iconOnly ? "relative" : "relative w-40 md:w-64"}>
      <div className="flex min-h-11 items-center rounded-full border border-white/15 bg-white/5 focus-within:border-brand/50">
        <span className="pl-4 text-lg text-text-secondary" aria-hidden="true">⌕</span>
        <input ref={inputRef} maxLength={160} value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setOpen(true)} placeholder="Search BVS" aria-label="Search music, artists, producers and beats" aria-controls={open ? listId : undefined} autoComplete="off" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-text-primary outline-none" />
        {query ? <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="mr-1 h-9 w-9 shrink-0 rounded-full text-text-secondary" aria-label="Clear search">×</button> : null}
        {iconOnly ? <button type="button" onClick={close} className="mr-3 min-h-9 rounded-full px-2 text-xs text-brand">Close</button> : null}
      </div>
      {open ? <div id={listId} className={iconOnly ? "mt-2 max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain" : "absolute right-0 top-14 z-[80] max-h-[60dvh] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-bg-primary p-2 shadow-2xl"}>
        {query.trim().length < 2 ? <p className="px-3 py-4 text-sm text-text-secondary">Type at least 2 characters to find music, artists, producers and beats.</p> : <>
          {loading ? <p role="status" className="px-3 py-3 text-sm text-text-secondary">Finding published content…</p> : null}
          <ul aria-label="Search suggestions">{suggestions.map((item) => <li key={item.id}>
            <Link data-search-result href={item.href} prefetch={false} onClick={close} className="flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-white/[.07] focus:bg-white/[.07] focus:outline-brand">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-text-primary">{item.title}</span><span className="block truncate text-xs text-text-secondary">{item.subtitle}</span></span>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand">{item.kind}</span>
            </Link>
          </li>)}</ul>
          {!loading && !suggestions.length ? <p role="status" className="px-3 py-4 text-sm text-text-secondary">{failed ? "Some suggestions are unavailable. Try again or search all BVS." : "No quick matches. Try another name or search all BVS."}</p> : null}
          {failed && !loading ? <button type="button" onClick={() => search.retry()} className="min-h-11 rounded-xl px-3 py-2 text-sm text-brand">Retry suggestions</button> : null}
          <button type="submit" className="mt-1 min-h-11 w-full rounded-xl border-t border-white/10 px-3 py-3 text-left text-sm font-medium text-brand hover:bg-white/[.07]">Search all BVS for “{query.trim()}” →</button>
        </>}
      </div> : null}
    </form>
  );

  return (
    <div ref={rootRef} className="relative" onBlur={(event) => {
      const next = event.relatedTarget as Node | null;
      if (!rootRef.current?.contains(next) && !panelRef.current?.contains(next)) setOpen(false);
    }} onKeyDown={(event) => {
      if (iconOnly && open && !modalLayerRef.current?.isTop()) return;
      if (event.key === "Escape") { event.preventDefault(); close(); inputRef.current?.blur(); }
      if (iconOnly && containModalTab(event, panelRef.current)) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const searchRoot = panelRef.current || rootRef.current;
        const links = Array.from(searchRoot?.querySelectorAll<HTMLAnchorElement>("[data-search-result]") || []);
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
      }} aria-label="Search" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} className="grid h-11 w-11 place-items-center rounded-full text-white/62 transition hover:bg-white/[.055] hover:text-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-6 w-6" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.25" /><path strokeLinecap="round" d="m15.5 15.5 4.25 4.25" /></svg>
      </button> : null}
      {!iconOnly ? searchForm : null}
      {iconOnly && open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[120] bg-black/65 px-3 pt-[calc(env(safe-area-inset-top)+4.25rem)] backdrop-blur-sm" role="presentation" onClick={(event) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) close();
        }}>
          <div ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-label="Search BVS" tabIndex={-1} className="mx-auto max-w-xl rounded-2xl border border-white/15 bg-bg-primary p-3 shadow-2xl">
            {searchForm}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
