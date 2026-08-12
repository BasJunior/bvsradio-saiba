"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function HeaderSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };

  return (
    <form
      onSubmit={submit}
      className="flex h-10 w-64 items-center overflow-hidden rounded-full border border-white/15 bg-white/5 transition-colors focus-within:border-brand/60 focus-within:bg-white/[.07]"
      role="search"
    >
      <button type="submit" className="grid h-10 w-10 shrink-0 place-items-center text-lg text-text-secondary hover:text-brand" aria-label="Search BVS">⌕</button>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search BVS"
        aria-label="Search tracks, artists, producers, beats and stories"
        className="min-w-0 flex-1 bg-transparent pr-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
      />
      {query ? (
        <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm text-text-secondary hover:bg-white/10 hover:text-text-primary" aria-label="Clear search">×</button>
      ) : (
        <span className="mr-3 text-xs text-white/35" aria-hidden="true">/</span>
      )}
    </form>
  );
}
