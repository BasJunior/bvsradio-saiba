"use client";

import { useEffect } from "react";

export default function BeatStoreHideMusicToggle() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") !== "beat") return;

    const refineCatalogueToggles = () => {
      document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        const label = button.textContent?.replace(/\s+/g, " ").trim() || "";

        if (/^Music\s*[·°]\s*\d+$/i.test(label)) {
          button.style.display = "none";
          button.setAttribute("aria-hidden", "true");
          button.tabIndex = -1;
          return;
        }

        const beatMatch = label.match(/^Beats\s*[·°]\s*(\d+)$/i);
        if (!beatMatch) return;

        const count = Number(beatMatch[1]);
        button.textContent = `All ${count} ${count === 1 ? "beat" : "beats"}`;
        button.style.background = "var(--bvs-culture-lilac, #c1a7ff)";
        button.style.color = "#0a0a0a";
        button.style.border = "0";
        button.style.borderRadius = "0";
        button.style.fontWeight = "600";
        button.setAttribute(
          "aria-label",
          `Show all ${count} ${count === 1 ? "beat" : "beats"}`,
        );
      });
    };

    refineCatalogueToggles();
    const observer = new MutationObserver(refineCatalogueToggles);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
