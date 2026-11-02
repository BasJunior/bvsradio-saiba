export type PlaybackShortcut = "toggle" | "next" | "previous";

/** Leave typing, native controls, assistive shortcuts and other dialogs alone. */
export function playbackShortcut(event: KeyboardEvent): PlaybackShortcut | null {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return null;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('input, textarea, select, button, a, video, audio, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="textbox"], [role="combobox"]')) return null;
  const modal = target?.closest('[aria-modal="true"]');
  if (document.querySelector('[aria-modal="true"]') && !modal?.hasAttribute("data-now-playing-shell")) return null;
  if (event.code === "Space" && !event.shiftKey) return "toggle";
  if (event.shiftKey && event.key === "ArrowRight") return "next";
  if (event.shiftKey && event.key === "ArrowLeft") return "previous";
  return null;
}
