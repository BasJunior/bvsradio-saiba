import type { FlowTrailItem } from "@/lib/flow-session";

const RECENT_KEY = "bvs.flow.recent.v1";
const MAX_RECENT = 30;

function safeRead(): FlowTrailItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as FlowTrailItem[]) : [];
  } catch {
    return [];
  }
}

export function readRecentFlowObjects() {
  return safeRead();
}

export function recordRecentFlowObject(item: FlowTrailItem) {
  if (typeof window === "undefined") return;
  const current = safeRead();
  const next = [
    item,
    ...current.filter(
      (entry) => !(entry.id === item.id && entry.kind === item.kind),
    ),
  ].slice(0, MAX_RECENT);

  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("bvs:recent-flow-change", { detail: { item } }));
}

export function clearRecentFlowObjects() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RECENT_KEY);
  window.dispatchEvent(new CustomEvent("bvs:recent-flow-change"));
}
