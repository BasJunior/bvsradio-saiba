/** React 19 callback refs: measure complete border boxes, including safe areas.
 * Playback state stays in StationPlayer; these refs only publish layout sizes.
 */
export function observeChromeHeight(element: HTMLElement, property: string) {
  const root = element.ownerDocument.documentElement;
  const update = () => {
    const height = Math.ceil(element.getBoundingClientRect().height);
    root.style.setProperty(property, `${height}px`);
  };
  update();
  const observer = new ResizeObserver(update);
  // Safe-area changes alter padding, not the content box. Observing the
  // default content box misses rotation/home-indicator changes completely.
  observer.observe(element, { box: "border-box" });
  return () => {
    observer.disconnect();
    root.style.setProperty(property, "0px");
  };
}

export const measureHeader = (element: HTMLElement | null) =>
  element ? observeChromeHeight(element, "--bvs-header-height") : undefined;
export const measureBottomNav = (element: HTMLElement | null) =>
  element ? observeChromeHeight(element, "--bvs-nav-height") : undefined;
export const measurePlayer = (element: HTMLElement | null) =>
  element ? observeChromeHeight(element, "--bvs-player-height") : undefined;
