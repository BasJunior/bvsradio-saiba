"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const DIALOG_SELECTOR = '[role="dialog"][aria-label="Now Playing World"]';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type CreatorSummary = {
  name?: string;
  username?: string;
};

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function visibleFocusable(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((node) => {
    if (node.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

async function resolveCreatorRoute(name: string, signal: AbortSignal) {
  const normalized = normalize(name);
  if (!normalized || normalized === "bvs radio") return null;

  try {
    const [artistsResponse, producersResponse] = await Promise.all([
      fetch("/api/artists", { signal }),
      fetch("/api/producers", { signal }),
    ]);

    const [artistsPayload, producersPayload] = await Promise.all([
      artistsResponse.ok ? artistsResponse.json() : Promise.resolve({ artists: [] }),
      producersResponse.ok ? producersResponse.json() : Promise.resolve({ producers: [] }),
    ]);

    const candidates: CreatorSummary[] = [
      ...(Array.isArray(artistsPayload?.artists) ? artistsPayload.artists : []),
      ...(Array.isArray(producersPayload?.producers) ? producersPayload.producers : []),
    ];

    const exact = candidates.find((candidate) => normalize(candidate.name) === normalized && candidate.username);
    return exact?.username ? `/artist/${encodeURIComponent(exact.username)}` : null;
  } catch {
    return null;
  }
}

/**
 * Accessibility + canonical-navigation guard for the existing global Now Playing
 * world. It deliberately does not own playback or modal state; StationPlayer
 * remains the single source of truth.
 */
export default function NowPlayingExperienceGuard() {
  const router = useRouter();
  const returnFocus = useRef<HTMLElement | null>(null);
  const activeDialog = useRef<HTMLElement | null>(null);
  const navigating = useRef(false);

  useEffect(() => {
    let creatorController: AbortController | null = null;
    let cleanupDialog: (() => void) | null = null;

    const detach = () => {
      creatorController?.abort();
      creatorController = null;
      cleanupDialog?.();
      cleanupDialog = null;
      activeDialog.current = null;

      if (!navigating.current && returnFocus.current?.isConnected) {
        window.requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true }));
      }
      returnFocus.current = null;
      navigating.current = false;
    };

    const attach = (dialog: HTMLElement) => {
      if (activeDialog.current === dialog) return;
      if (activeDialog.current) detach();

      activeDialog.current = dialog;
      navigating.current = false;
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const title = dialog.querySelector<HTMLElement>("h2");
      if (title) {
        title.id ||= "bvs-now-playing-title";
        dialog.setAttribute("aria-labelledby", title.id);
      }

      const closeButton = dialog.querySelector<HTMLElement>('[aria-label="Close Now Playing"]');
      window.requestAnimationFrame(() => (closeButton || visibleFocusable(dialog)[0] || dialog).focus({ preventScroll: true }));

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Tab") return;
        const focusable = visibleFocusable(dialog);
        if (!focusable.length) {
          event.preventDefault();
          dialog.focus({ preventScroll: true });
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement;

        if (event.shiftKey && (current === first || !dialog.contains(current))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && current === last) {
          event.preventDefault();
          first.focus();
        }
      };

      dialog.tabIndex = -1;
      dialog.addEventListener("keydown", onKeyDown);

      creatorController = new AbortController();
      const artistLinks = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('a[href^="/search?q="]'));
      const artistName = artistLinks[0]?.textContent?.trim() || "";

      void resolveCreatorRoute(artistName, creatorController.signal).then((route) => {
        if (!route || creatorController?.signal.aborted || activeDialog.current !== dialog) return;

        for (const anchor of artistLinks) {
          anchor.setAttribute("href", route);
          anchor.setAttribute("data-bvs-canonical-creator", route);
        }

        const onCreatorClick = (event: Event) => {
          const target = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[data-bvs-canonical-creator]");
          if (!target) return;
          event.preventDefault();
          navigating.current = true;
          dialog.querySelector<HTMLButtonElement>('[aria-label="Close Now Playing"]')?.click();
          router.push(route);
        };

        dialog.addEventListener("click", onCreatorClick, true);
        const previousCleanup = cleanupDialog;
        cleanupDialog = () => {
          previousCleanup?.();
          dialog.removeEventListener("click", onCreatorClick, true);
        };
      });

      const baseCleanup = () => dialog.removeEventListener("keydown", onKeyDown);
      const previousCleanup = cleanupDialog;
      cleanupDialog = () => {
        previousCleanup?.();
        baseCleanup();
      };
    };

    const sync = () => {
      const dialog = document.querySelector<HTMLElement>(DIALOG_SELECTOR);
      if (dialog) attach(dialog);
      else if (activeDialog.current) detach();
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      detach();
    };
  }, [router]);

  return null;
}
