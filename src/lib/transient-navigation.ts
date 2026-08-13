export type BvsTransientLayer = "queue" | "now-playing" | "action-sheet";

export const BVS_DISMISS_TRANSIENTS_EVENT = "bvs:dismiss-transients-before-navigation";

const LAYER_KEY = "__bvsTransientLayer";
const BASE_URL_KEY = "__bvsTransientBaseUrl";

function stateRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function currentRoute() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function layerHash(layer: BvsTransientLayer) {
  return `#bvs-${layer}`;
}

export function currentTransientLayer(state: unknown = window.history.state): BvsTransientLayer | null {
  const layer = stateRecord(state)[LAYER_KEY];
  return layer === "queue" || layer === "now-playing" || layer === "action-sheet" ? layer : null;
}

export function openTransientLayer(layer: BvsTransientLayer) {
  const current = stateRecord(window.history.state);
  const active = currentTransientLayer(current);
  const baseUrl = typeof current[BASE_URL_KEY] === "string" ? current[BASE_URL_KEY] as string : currentRoute();
  const nextState = { ...current, [LAYER_KEY]: layer, [BASE_URL_KEY]: baseUrl };
  const baseWithoutHash = baseUrl.split("#")[0];
  if (active) {
    window.history.replaceState(nextState, "", `${baseWithoutHash}${layerHash(layer)}`);
  } else {
    window.history.pushState(nextState, "", `${baseWithoutHash}${layerHash(layer)}`);
  }
}

export function dismissTransientLayer(layer: BvsTransientLayer) {
  if (currentTransientLayer() !== layer) return false;
  window.history.back();
  return true;
}

export function clearCurrentTransientLayer(layer?: BvsTransientLayer) {
  const current = stateRecord(window.history.state);
  const active = currentTransientLayer(current);
  if (!active || (layer && active !== layer)) return false;
  const baseUrl = typeof current[BASE_URL_KEY] === "string"
    ? current[BASE_URL_KEY] as string
    : `${window.location.pathname}${window.location.search}`;
  const nextState = { ...current };
  delete nextState[LAYER_KEY];
  delete nextState[BASE_URL_KEY];
  window.history.replaceState(nextState, "", baseUrl);
  return true;
}
