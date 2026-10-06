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
    const sections = shelves
      .map((shelf) => document.getElementById(shelf.id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-24% 0px -62% 0px", threshold: [0.05, 0.2, 0.5] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
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
