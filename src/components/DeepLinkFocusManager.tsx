"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function normalize(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findFlowTarget(focusId: string) {
  if (!focusId) return null;

  const byId = document.getElementById(focusId);
  if (byId) return byId;

  for (const element of document.querySelectorAll<HTMLElement>("[data-flow-focus-id]")) {
    if (element.dataset.flowFocusId === focusId) return element;
  }

  return null;
}

function findLabelTarget(label: string) {
  const needle = normalize(label);
  if (!needle) return null;

  const headings = document.querySelectorAll<HTMLElement>(
    "article h1, article h2, article h3, [data-deep-link-title]",
  );

  for (const heading of headings) {
    if (normalize(heading.textContent) !== needle) continue;
    return (
      heading.closest<HTMLElement>("[data-flow-focus-id]") ||
      heading.closest<HTMLElement>("article") ||
      heading
    );
  }

  return null;
}

/**
 * Keeps deep discovery links honest: if a URL names a specific object, land on
 * that object rather than the top of a long creator/catalogue page.
 *
 * Explicit `focus` IDs win. Catalogue `q` is used as a safe fallback because
 * those links already carry the exact track/beat title and catalogue results
 * arrive asynchronously after the page shell renders.
 */
export default function DeepLinkFocusManager() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const focusId = params.get("focus") || "";
    const focusTitle = params.get("focus_title") || "";
    const catalogueTitle = pathname === "/catalogue" ? params.get("q") || "" : "";
    const label = focusTitle || catalogueTitle;

    if (!focusId && !label) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    let attempts = 0;

    const reveal = () => {
      if (cancelled) return;

      const target = findFlowTarget(focusId) || findLabelTarget(label);
      if (!target) {
        attempts += 1;
        if (attempts < 40) {
          timeoutId = window.setTimeout(reveal, 100);
        }
        return;
      }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const alreadyFocusable = target.matches(
        "a[href], button, input, select, textarea, [tabindex]",
      );
      if (!alreadyFocusable) target.tabIndex = -1;

      target.setAttribute("data-deep-link-target", "true");
      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });

      timeoutId = window.setTimeout(
        () => {
          if (cancelled) return;
          target.focus({ preventScroll: true });
          window.setTimeout(() => target.removeAttribute("data-deep-link-target"), 1800);
        },
        reducedMotion ? 0 : 260,
      );
    };

    window.requestAnimationFrame(reveal);

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [pathname, queryString]);

  return (
    <style jsx global>{`
      [data-deep-link-target="true"] {
        outline: 2px solid color-mix(in srgb, currentColor 45%, transparent);
        outline-offset: 4px;
      }
    `}</style>
  );
}
