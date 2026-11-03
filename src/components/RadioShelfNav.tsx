"use client";

import { useEffect, useState } from "react";

const shelves = [
  { id: "radio-on-air", label: "Listen" },
  { id: "radio-session", label: "Your session" },
  { id: "radio-context", label: "Behind the music" },
  { id: "radio-coming-up", label: "Programme" },
  { id: "radio-shows", label: "Shows" },
] as const;

export default function RadioShelfNav() {
  const [active, setActive] = useState<string>(shelves[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observed = new Set<HTMLElement>();
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        // Entries contain only changed intersections, not all visible sections.
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
          else visible.delete(entry.target.id);
        }
        const closest = [...visible].sort((a, b) => b[1] - a[1])[0];
        if (closest) setActive(closest[0]);
      },
      { rootMargin: "-24% 0px -62% 0px", threshold: [0.05, 0.2, 0.5] },
    );
    const observeSections = () => {
      for (const shelf of shelves) {
        const section = document.getElementById(shelf.id);
        if (section && !observed.has(section)) {
          observer.observe(section);
          observed.add(section);
        }
      }
    };
    observeSections();
    // Programme shelves stream behind Suspense and may not exist at mount.
    const root = document.getElementById("bvs-main-content");
    const mutations = typeof MutationObserver !== "undefined" ? new MutationObserver(() => {
      observeSections();
      if (observed.size === shelves.length) mutations?.disconnect();
    }) : null;
    if (root && observed.size < shelves.length) mutations?.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutations?.disconnect(); };

  }, []);

  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setActive(id);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${id}`);
  };

  return (
    <nav
      aria-label="Radio shelves"
      className="mb-5 overflow-x-auto border-b border-white/10 pb-3"
    >
      <div className="flex min-w-max items-center gap-1">
        {shelves.map((shelf) => (
          <a
            key={shelf.id}
            href={`#${shelf.id}`}
            onClick={(event) => jumpTo(event, shelf.id)}
            aria-current={active === shelf.id ? "location" : undefined}
            className={`min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              active === shelf.id
                ? "bg-white/10 text-white"
                : "text-text-secondary hover:bg-white/5 hover:text-white"
            }`}
          >
            {shelf.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
