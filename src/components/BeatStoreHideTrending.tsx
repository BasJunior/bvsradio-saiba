"use client";

import { useEffect } from "react";

const normalize = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export default function BeatStoreHideTrending() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") !== "beat") return;

    let disposed = false;

    const hideSection = () => {
      if (disposed) return;
      const heading = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,p")).find(
        (node) => normalize(node.textContent) === "what listeners are opening now.",
      );
      if (!heading) return;

      const section = heading.closest<HTMLElement>("section");
      if (section) {
        section.style.display = "none";
        section.setAttribute("aria-hidden", "true");
      }
    };

    hideSection();
    const observer = new MutationObserver(hideSection);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
