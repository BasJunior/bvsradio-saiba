/**
 * iOS-style tab memory for the app's bottom tabs.
 *
 * Each tab remembers the last screen the listener had open inside it (for
 * example a Discover search or a Library collection) and how far down they had
 * scrolled. Returning to the tab reopens that screen at that position. Tapping
 * the tab you are already on goes back to its top. Memory lasts for the app
 * session only, so a fresh launch starts every tab at the top.
 */

export type TabMemory = { route: string; top: number };

const memory = new Map<string, TabMemory>();

export function rememberTab(tab: string, route: string, top?: number) {
  const previous = memory.get(tab);
  memory.set(tab, { route, top: typeof top === "number" ? Math.max(0, Math.round(top)) : previous?.route === route ? previous.top : 0 });
}

export function recallTab(tab: string): TabMemory | undefined {
  return memory.get(tab);
}

export function forgetTab(tab: string) {
  memory.delete(tab);
}

/**
 * Scroll to `top` once the page is tall enough. Feed, Discover and Library
 * load their content after the route renders, so a single immediate scroll
 * lands short. Keep trying for a few seconds, and stop as soon as the listener
 * touches, scrolls or types so we never fight them.
 */
export function restoreScroll(top: number, { timeoutMs = 4000 }: { timeoutMs?: number } = {}) {
  if (typeof window === "undefined") return () => {};
  if (top <= 0) {
    window.scrollTo({ top: 0, left: 0 });
    return () => {};
  }
  let done = false;
  const started = performance.now();
  const stop = () => {
    done = true;
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("keydown", stop);
  };
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("keydown", stop);

  const attempt = () => {
    if (done) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const reachable = max >= top - 4;
    window.scrollTo({ top: Math.min(top, Math.max(0, max)), left: 0 });
    if (reachable && Math.abs(window.scrollY - top) <= 4) {
      // Hold the position for a beat in case late content shifts the layout.
      window.setTimeout(() => {
        if (!done && Math.abs(window.scrollY - top) > 4) window.scrollTo({ top, left: 0 });
        stop();
      }, 250);
      return;
    }
    if (performance.now() - started > timeoutMs) { stop(); return; }
    window.setTimeout(attempt, 80);
  };
  window.setTimeout(attempt, 0);
  return stop;
}

