"use client";

import { useEffect, useRef, useState } from "react";

/** Offers rotate only while visible and idle, never while someone is reading or choosing. */
export function useOfferRotation(count: number) {
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setMotionAllowed(!preference.matches);
    const syncPage = () => setPageVisible(!document.hidden);
    syncMotion(); syncPage();
    preference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncPage);
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { threshold: 0.25 }) : null;
    if (ref.current) observer?.observe(ref.current);
    return () => { observer?.disconnect(); preference.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", syncPage); };
  }, []);

  useEffect(() => {
    if (count < 2 || paused || hovered || focused || !visible || !motionAllowed || !pageVisible) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % count), 10000);
    return () => window.clearInterval(timer);
  }, [count, paused, hovered, focused, visible, motionAllowed, pageVisible]);

  return {
    index, paused, toggle: () => setPaused(value => !value),
    select: (value: number) => { setIndex(value); setPaused(true); },
    sectionProps: {
      ref,
      onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false),
      onFocusCapture: () => setFocused(true),
      onBlurCapture: (event: React.FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); },
    },
  };
}
