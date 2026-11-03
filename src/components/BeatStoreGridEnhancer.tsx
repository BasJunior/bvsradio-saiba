"use client";

import { useEffect } from "react";

type PublicBeat = {
  title?: string;
  producer?: string;
  bpm?: number | string | null;
};

const normalize = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export default function BeatStoreGridEnhancer() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") !== "beat") return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let beatsByKey = new Map<string, PublicBeat>();
    let beatsByTitle = new Map<string, PublicBeat>();

    const enhance = () => {
      if (disposed) return;
      const directory = document.querySelector<HTMLElement>(
        'section[data-beat-directory="true"]',
      );
      if (!directory) return;

      directory.setAttribute("data-beat-grid-enhanced", "true");

      const previous = directory.previousElementSibling;
      if (
        previous instanceof HTMLParagraphElement &&
        previous.textContent?.includes("Swipe or scroll sideways")
      ) {
        previous.textContent = "All available beats are shown below.";
      }

      directory.querySelectorAll<HTMLElement>("article").forEach((card) => {
        const title = card.querySelector("h2")?.textContent || "";
        const paragraphs = Array.from(card.querySelectorAll("p"));
        const producer = paragraphs[0]?.textContent || "";
        const beat =
          beatsByKey.get(`${normalize(title)}::${normalize(producer)}`) ||
          beatsByTitle.get(normalize(title));
        const bpm = beat?.bpm;
        if (!bpm) return;

        const metaRow = card.querySelector<HTMLElement>("div.mt-3");
        if (!metaRow) return;

        let bpmNode = metaRow.querySelector<HTMLElement>("[data-beat-bpm]");
        if (!bpmNode) {
          bpmNode = document.createElement("span");
          bpmNode.setAttribute("data-beat-bpm", "true");
          bpmNode.className = "flex-shrink-0 text-white/70";
          const priceNode = metaRow.lastElementChild;
          metaRow.insertBefore(bpmNode, priceNode);
        }
        bpmNode.textContent = `${bpm} BPM`;
      });
    };

    fetch("/api/beats?scope=public", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: { beats?: PublicBeat[] }) => {
        if (disposed) return;
        const beats = Array.isArray(payload.beats) ? payload.beats : [];
        beatsByKey = new Map(
          beats.map((beat) => [
            `${normalize(beat.title)}::${normalize(beat.producer)}`,
            beat,
          ]),
        );
        beatsByTitle = new Map(
          beats.map((beat) => [normalize(beat.title), beat]),
        );
        enhance();
      })
      .catch(() => {
        enhance();
      });

    const startObserver = () => {
      const directory = document.querySelector<HTMLElement>(
        'section[data-beat-directory="true"]',
      );
      if (!directory || observer) return;
      observer = new MutationObserver(enhance);
      observer.observe(directory, { childList: true, subtree: true });
      enhance();
    };

    startObserver();
    const timer = window.setInterval(startObserver, 250);
    const stopTimer = window.setTimeout(() => window.clearInterval(timer), 5000);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.clearInterval(timer);
      window.clearTimeout(stopTimer);
    };
  }, []);

  return (
    <style jsx global>{`
      section[data-beat-directory="true"][data-beat-grid-enhanced="true"] {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 0.9rem !important;
      }

      section[data-beat-directory="true"][data-beat-grid-enhanced="true"] article > div.p-4 {
        padding: 0.8rem !important;
      }

      section[data-beat-directory="true"][data-beat-grid-enhanced="true"] article div.mt-3 {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto auto !important;
        align-items: center !important;
        gap: 0.5rem !important;
      }

      @media (min-width: 768px) {
        section[data-beat-directory="true"][data-beat-grid-enhanced="true"] {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
      }

      @media (min-width: 1024px) {
        section[data-beat-directory="true"][data-beat-grid-enhanced="true"] {
          grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
        }
      }
    `}</style>
  );
}
