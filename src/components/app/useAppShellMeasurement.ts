"use client";

import { useEffect, useRef } from "react";

type AppShellHeightVariable =
  | "--bvs-app-header-height-measured"
  | "--bvs-app-bottom-nav-height-measured"
  | "--bvs-app-player-height-measured";

/**
 * Keeps the listener shell's CSS layout model aligned with the rendered fixed
 * chrome, including safe-area padding and temporary player notices.
 */
export function useAppShellMeasurement<T extends HTMLElement>(
  variable: AppShellHeightVariable,
  active: boolean,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return;

    const root = document.documentElement;
    let animationFrame = 0;
    const measure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        root.style.setProperty(variable, `${Math.ceil(element.getBoundingClientRect().height)}px`);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.visualViewport?.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    measure();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      root.style.removeProperty(variable);
    };
  }, [active, variable]);

  return ref;
}
