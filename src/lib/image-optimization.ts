export function shouldBypassImageOptimizer(src?: string | null) {
  const value = String(src || "").trim();
  return /^(?:https?:|blob:|data:)/i.test(value);
}
