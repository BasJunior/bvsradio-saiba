"use client";

import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { BvsAction, BvsObject } from "@/lib/bvs-object";
import { recordFlowOpen } from "@/lib/flow-session";
import { trackEvent } from "@/lib/analytics";
import { clearCurrentTransientLayer, currentTransientLayer, dismissTransientLayer, openTransientLayer } from "@/lib/transient-navigation";

const IOS_ROOT = "/app/ios";

function openOutsideNativeIosShell(href: string) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return false;

  const url = new URL(href, window.location.origin);
  const contained = url.origin === window.location.origin
    && (url.pathname === IOS_ROOT || url.pathname.startsWith(`${IOS_ROOT}/`));
  if (contained) return false;

  const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
  return true;
}

function queueAction(action: BvsAction, object: BvsObject) {
  const media = action.media || object.media;
  if (!media?.src) return false;
  const track = {
    id: object.id,
    src: media.src,
    title: object.title,
    artist: media.artist || object.subtitle || "BVS creator",
    project: media.project || object.contextLabel || "BVS",
    genre: media.genre,
    artwork: media.artwork || object.artwork,
  };
  const queueAction = action.intent === "play-next" ? "play-next" : action.intent === "queue" ? "add" : "play";
  window.dispatchEvent(new CustomEvent("bvs:queue", { detail: { action: queueAction, track, from: object.contextLabel || "BVS Flow" } }));
  return true;
}

async function shareObject(object: BvsObject) {
  const url = new URL(object.route, window.location.origin).href;
  if (navigator.share) {
    await navigator.share({ title: object.title, text: object.subtitle || object.contextLabel || "BVS Radio", url });
    return;
  }
  await navigator.clipboard.writeText(url);
}

export default function BvsActionSheet({
  object,
  open,
  onClose,
  returnFocus,
}: {
  object: BvsObject;
  open: boolean;
  onClose: () => void;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    if (!dismissTransientLayer("action-sheet")) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    openTransientLayer("action-sheet");
    trackEvent("flow_action_sheet_open", { object_id: object.id, object_kind: object.kind });
    const previousOverflow = document.body.style.overflow;
    const focusTarget = returnFocus?.current;
    document.body.style.overflow = "hidden";
    const first = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("button,a")?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const onPopState = (event: PopStateEvent) => {
      if (currentTransientLayer(event.state) !== "action-sheet") onClose();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.clearTimeout(first);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
      focusTarget?.focus({ preventScroll: true });
    };
  }, [dismiss, object.id, object.kind, onClose, open, returnFocus]);

  if (!open) return null;
  const actions = object.overflowActions || [];

  async function run(action: BvsAction) {
    try {
      if (action.intent === "navigate" && action.href) {
        recordFlowOpen(object);
        trackEvent("flow_object_open", { object_id: object.id, object_kind: object.kind, source: "action_sheet" });
        clearCurrentTransientLayer("action-sheet");
        onClose();
        if (openOutsideNativeIosShell(action.href)) return;
        router.push(action.href);
        return;
      }
      if (["play", "play-next", "queue"].includes(action.intent)) {
        queueAction(action, object);
        dismiss();
        return;
      }
      if (action.intent === "share") {
        await shareObject(object);
        dismiss();
      }
    } catch {
      dismiss();
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={`bvs-actions-${object.id}`} className="w-full max-w-lg rounded-t-[2rem] border border-white/10 bg-bg-primary p-5 shadow-2xl sm:rounded-[2rem] sm:p-6">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[.18em] text-brand">{object.contextLabel || object.kind}</p>
            <h2 id={`bvs-actions-${object.id}`} className="mt-1 truncate text-xl font-semibold">{object.title}</h2>
            {object.subtitle ? <p className="mt-1 truncate text-sm text-text-secondary">{object.subtitle}</p> : null}
          </div>
          <button type="button" onClick={dismiss} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 text-lg text-text-secondary hover:border-brand hover:text-brand" aria-label="Close actions">×</button>
        </div>
        <div className="mt-5 grid gap-2">
          {actions.map((action) => (
            <button key={action.id} type="button" onClick={() => void run(action)} className="min-h-12 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-left text-sm font-medium transition hover:border-brand/40 hover:bg-brand/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {action.label}
            </button>
          ))}
          <button type="button" onClick={() => void shareObject(object).finally(dismiss)} className="min-h-12 rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-text-secondary hover:border-brand/40 hover:text-brand">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
