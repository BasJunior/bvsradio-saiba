type ScrollLockSnapshot = {
  scrollX: number;
  scrollY: number;
  body: Partial<Record<"overflow" | "position" | "top" | "left" | "right" | "width" | "paddingRight", string>>;
  rootOverflow: string;
};

let scrollLockCount = 0;
let scrollLockSnapshot: ScrollLockSnapshot | null = null;
let pendingUnlock: number | null = null;
let nextModalLayerId = 0;
const modalLayerStack: number[] = [];

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function visibleFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    if (element.closest('[inert], [aria-hidden="true"]')) return false;
    if (window.getComputedStyle(element).visibility === "hidden") return false;
    return element.getClientRects().length > 0;
  });
}

/**
 * Registers a modal in opening order. Global keyboard handlers use the handle
 * so Escape and Tab only affect the uppermost modal when layers overlap.
 */
export function registerModalLayer() {
  const id = ++nextModalLayerId;
  modalLayerStack.push(id);
  let released = false;
  return {
    isTop: () => modalLayerStack[modalLayerStack.length - 1] === id,
    release: () => {
      if (released) return;
      released = true;
      const index = modalLayerStack.lastIndexOf(id);
      if (index >= 0) modalLayerStack.splice(index, 1);
    },
  };
}

/**
 * Locks the document without losing the current iOS/WKWebView scroll position.
 * Locks are reference counted so handing off from one sheet to another cannot
 * accidentally re-enable the page underneath the new sheet.
 */
export function lockPageScroll() {
  if (typeof document === "undefined") return () => undefined;

  if (pendingUnlock !== null) {
    window.clearTimeout(pendingUnlock);
    pendingUnlock = null;
  }
  scrollLockCount += 1;
  if (!scrollLockSnapshot) {
    const body = document.body;
    const root = document.documentElement;
    const scrollbarGap = Math.max(0, window.innerWidth - root.clientWidth);
    scrollLockSnapshot = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      body: {
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight,
      },
      rootOverflow: root.style.overflow,
    };

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollLockSnapshot.scrollY}px`;
    body.style.left = `-${scrollLockSnapshot.scrollX}px`;
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarGap > 0) {
      const existingPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${existingPadding + scrollbarGap}px`;
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount !== 0 || !scrollLockSnapshot) return;
    // Passive effect cleanups run before the next modal's effect. Deferring one
    // task lets that hand-off retain the same lock without a visible scroll jump.
    pendingUnlock = window.setTimeout(() => {
      pendingUnlock = null;
      if (scrollLockCount !== 0 || !scrollLockSnapshot) return;
      const snapshot = scrollLockSnapshot;
      scrollLockSnapshot = null;
      const body = document.body;
      const root = document.documentElement;
      root.style.overflow = snapshot.rootOverflow;
      body.style.overflow = snapshot.body.overflow || "";
      body.style.position = snapshot.body.position || "";
      body.style.top = snapshot.body.top || "";
      body.style.left = snapshot.body.left || "";
      body.style.right = snapshot.body.right || "";
      body.style.width = snapshot.body.width || "";
      body.style.paddingRight = snapshot.body.paddingRight || "";
      window.scrollTo(snapshot.scrollX, snapshot.scrollY);
    }, 0);
  };
}

export function focusFirstElement(container: HTMLElement | null) {
  if (!container) return;
  const first = visibleFocusableElements(container)[0];
  if (first) first.focus({ preventScroll: true });
  else container.focus({ preventScroll: true });
}

export function restoreFocus(element: HTMLElement | null | undefined) {
  if (!element) return;
  queueMicrotask(() => {
    if (!element.isConnected) return;
    const openModals = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]'));
    if (openModals.length > 0 && !openModals.some((modal) => modal.contains(element))) return;
    element.focus({ preventScroll: true });
  });
}

/** Returns true when a Tab key was contained by the modal. */
export function containModalTab(event: KeyboardEvent | React.KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab" || !container) return false;
  const focusable = visibleFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus({ preventScroll: true });
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  return false;
}
