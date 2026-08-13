import type { BvsObject, BvsObjectKind } from "@/lib/bvs-object";

export type FlowTrailItem = {
  id: string;
  kind: BvsObjectKind;
  route: string;
  title: string;
  artwork?: string;
  relationship?: string;
  openedAt: string;
};

type FlowScrollState = {
  x: number;
  y: number;
  focusId?: string;
  scrollers: Record<string, { left: number; top: number }>;
};

const TRAIL_KEY = "bvs.flow.trail.v1";
const RESTORE_PREFIX = "bvs.flow.restore.v1:";
const BACK_PREFIX = "bvs.flow.back.v1:";
const MAX_TRAIL = 12;

function routeKey(route: string) {
  return route || "/";
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readFlowTrail(): FlowTrailItem[] {
  return safeRead<FlowTrailItem[]>(TRAIL_KEY, []);
}

export function clearFlowTrail() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TRAIL_KEY);
  window.dispatchEvent(new CustomEvent("bvs:flow-trail-change"));
}

export function recordFlowOpen(object: BvsObject, relationship?: string) {
  if (typeof window === "undefined") return;
  const current = readFlowTrail();
  const nextItem: FlowTrailItem = {
    id: object.id,
    kind: object.kind,
    route: object.route,
    title: object.title,
    artwork: object.artwork,
    relationship,
    openedAt: new Date().toISOString(),
  };
  const last = current[current.length - 1];
  const next = last && last.id === nextItem.id && last.kind === nextItem.kind
    ? [...current.slice(0, -1), nextItem]
    : [...current, nextItem].slice(-MAX_TRAIL);
  window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("bvs:flow-trail-change", { detail: { item: nextItem } }));
}

export function captureFlowScroll(route: string, focusId?: string) {
  if (typeof window === "undefined") return;
  const scrollers: Record<string, { left: number; top: number }> = {};
  document.querySelectorAll<HTMLElement>("[data-flow-scroll-key]").forEach((element) => {
    const key = element.dataset.flowScrollKey;
    if (key) scrollers[key] = { left: element.scrollLeft, top: element.scrollTop };
  });
  const state: FlowScrollState = {
    x: window.scrollX,
    y: window.scrollY,
    focusId,
    scrollers,
  };
  window.sessionStorage.setItem(`${RESTORE_PREFIX}${routeKey(route)}`, JSON.stringify(state));
}

export function recordFlowBackTarget(destination: string, previous: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${BACK_PREFIX}${routeKey(destination)}`, previous);
}

export function readFlowBackTarget(route: string) {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(`${BACK_PREFIX}${routeKey(route)}`);
}

export function restoreFlowScroll(route: string) {
  if (typeof window === "undefined") return false;
  const state = safeRead<FlowScrollState | null>(`${RESTORE_PREFIX}${routeKey(route)}`, null);
  if (!state) return false;
  let attempt = 0;
  const apply = () => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ left: state.x, top: state.y, behavior: "auto" });
      Object.entries(state.scrollers || {}).forEach(([key, position]) => {
        const element = document.querySelector<HTMLElement>(`[data-flow-scroll-key="${CSS.escape(key)}"]`);
        if (element) {
          element.scrollLeft = position.left;
          element.scrollTop = position.top;
        }
      });
      if (state.focusId) {
        document.querySelector<HTMLElement>(`[data-flow-focus-id="${CSS.escape(state.focusId)}"]`)?.focus({ preventScroll: true });
      }
      attempt += 1;
      // Async rails and artwork can increase the document height after the
      // route first paints. Retry only while the saved position is unreachable.
      if (Math.abs(window.scrollY - state.y) > 2 && attempt < 5) {
        window.setTimeout(apply, attempt * 140);
      }
    });
  };
  apply();
  return true;
}
