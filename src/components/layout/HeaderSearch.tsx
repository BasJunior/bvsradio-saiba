"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function HeaderSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      setOpen(true);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
    setOpen(false);
  };

  return (
    <form
      onSubmit={submit}
      className={`flex h-10 items-center overflow-hidden rounded-full border bg-white/5 transition-[width,border-color] duration-300 ${open ? "w-72 border-brand/50" : "w-36 border-white/10"}`}
      role="search"
    >
      <button type="button" onClick={() => { setOpen(true); window.requestAnimationFrame(() => inputRef.current?.focus()); }} className="grid h-10 w-10 shrink-0 place-items-center text-lg text-text-secondary hover:text-brand" aria-label="Search BVS">⌕</button>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (!query.trim()) window.setTimeout(() => setOpen(false), 120); }}
        placeholder="Search BVS"
        aria-label="Search tracks, artists, producers, beats and stories"
        className="min-w-0 flex-1 bg-transparent pr-2 text-sm text-text-primary outline-none placeholder:text-text-secondary"
      />
      {open ? <button type="submit" className="mr-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-black">Go</button> : <span className="mr-3 text-xs text-white/35">/</span>}
    </form>
  );
}
