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

        const beatMatch = label.match(/^(?:Beats\s*[·°]\s*|All\s+)(\d+)(?:\s+beats?)?$/i);
        if (!beatMatch) return;

        const count = Number(beatMatch[1]);
        button.textContent = `All ${count} ${count === 1 ? "beat" : "beats"}`;
        button.style.background = "var(--bvs-culture-lilac, #c1a7ff)";
        button.style.color = "#0a0a0a";
        button.style.border = "0";
        button.style.borderRadius = "0";
        button.style.fontWeight = "600";
        button.style.cursor = "pointer";
        button.setAttribute(
          "aria-label",
          `Browse all ${count} ${count === 1 ? "beat" : "beats"}`,
        );

        if (button.dataset.beatBrowseJump === "true") return;
        button.dataset.beatBrowseJump = "true";
        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            const browseSection = document.getElementById("browse");
            if (!browseSection) return;

            browseSection.scrollIntoView({ behavior: "smooth", block: "start" });
            window.history.replaceState(
              {},
              "",
              `${window.location.pathname}${window.location.search}#browse`,
            );
          },
          true,
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
