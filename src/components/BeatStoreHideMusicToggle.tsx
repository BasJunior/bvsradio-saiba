"use client";

import { useEffect } from "react";

export default function BeatStoreHideMusicToggle() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") !== "beat") return;

    const hideMusicToggle = () => {
      document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        const label = button.textContent?.replace(/\s+/g, " ").trim() || "";
        if (/^Music\s*[·°]\s*\d+$/i.test(label)) {
          button.style.display = "none";
          button.setAttribute("aria-hidden", "true");
          button.tabIndex = -1;
        }
      });
    };

    hideMusicToggle();
    const observer = new MutationObserver(hideMusicToggle);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
