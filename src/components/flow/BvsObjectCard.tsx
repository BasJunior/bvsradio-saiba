"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { BvsAction, BvsCardVariant, BvsObject } from "@/lib/bvs-object";
import { objectKindLabel } from "@/lib/bvs-object";
import { recordFlowOpen } from "@/lib/flow-session";
import { trackEvent } from "@/lib/analytics";
import BvsActionSheet from "@/components/flow/BvsActionSheet";

function runQueueAction(action: BvsAction, object: BvsObject) {
  const media = action.media || object.media;
  if (!media?.src) return;
  const track = {
    id: object.id,
    src: media.src,
    title: object.title,
    artist: media.artist || object.subtitle || "BVS creator",
    project: media.project || object.contextLabel || "BVS Flow",
    genre: media.genre,
    artwork: media.artwork || object.artwork,
  };
  const intent = action.intent === "play-next" ? "play-next" : action.intent === "queue" ? "add" : "play";
  window.dispatchEvent(new CustomEvent("bvs:queue", { detail: { action: intent, track, from: object.contextLabel || "BVS Flow" } }));
}

const surfaceByVariant: Record<BvsCardVariant, string> = {
  "compact-row": "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-3",
  "rail-card": "w-[min(78vw,19rem)] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]",
  "feature-card": "overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[.06] to-white/[.015]",
  "grid-card": "overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]",
  "relationship-card": "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.02] p-3",
};

export default function BvsObjectCard({
  object,
  variant = "grid-card",
  relationship,
}: {
  object: BvsObject;
  variant?: BvsCardVariant;
  relationship?: string;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const overflowRef = useRef<HTMLButtonElement>(null);
  const artworkFailed = Boolean(object.artwork && failedArtwork === object.artwork);
  const compact = variant === "compact-row" || variant === "relationship-card";
  const feature = variant === "feature-card";

  function openObject() {
    recordFlowOpen(object, relationship);
    trackEvent(relationship ? "flow_relationship_open" : "flow_object_open", {
      object_id: object.id,
      object_kind: object.kind,
      source: variant,
      relationship: relationship || null,
    });
  }

  function primary(action: BvsAction) {
    if (["play", "play-next", "queue"].includes(action.intent)) {
      runQueueAction(action, object);
      recordFlowOpen(object, relationship);
      trackEvent("flow_object_play", { object_id: object.id, object_kind: object.kind, source: variant });
    }
  }

  function activateCard() {
    if (object.primaryAction && ["play", "play-next", "queue"].includes(object.primaryAction.intent)) {
      primary(object.primaryAction);
      return;
    }
    openObject();
  }

  const hasUsableArtwork = Boolean(object.artwork && !object.artwork.includes("default-avatar"));
  const image = hasUsableArtwork && !artworkFailed ? (
    <Image
      src={object.artwork!}
      alt=""
      fill
      unoptimized={/^https?:\/\//i.test(object.artwork!)}
      sizes={compact ? "72px" : feature ? "(max-width:768px) 100vw, 50vw" : "(max-width:768px) 78vw, 320px"}
      className="object-cover transition duration-300 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
      onError={() => setFailedArtwork(object.artwork || "")}
    />
  ) : (
    <span className="absolute inset-0 grid place-items-center text-xs font-semibold uppercase tracking-[.18em] text-brand">BVS</span>
  );

  const content = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">{object.contextLabel || objectKindLabel(object.kind)}</p>
      <h3 className={`${feature ? "text-2xl sm:text-3xl" : "text-lg"} mt-1 line-clamp-2 font-semibold`}>{object.title}</h3>
      {object.subtitle ? <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{object.subtitle}</p> : null}
      {object.metadata?.length ? <p className="mt-2 line-clamp-2 text-xs text-text-secondary">{object.metadata.join(" · ")}</p> : null}
      {object.availabilityLabel ? <p className="mt-2 text-xs text-emerald-200">{object.availabilityLabel}</p> : null}
    </>
  );

  return (
    <article className={`group ${surfaceByVariant[variant]}`} data-flow-focus-id={`${object.kind}:${object.id}`} tabIndex={-1}>
      {compact ? (
        <>
          {object.primaryAction && ["play", "play-next", "queue"].includes(object.primaryAction.intent) ? (
            <>
              <button type="button" onClick={activateCard} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{image}</button>
              <button type="button" onClick={activateCard} className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</button>
            </>
          ) : (
            <>
              <Link href={object.route} onClick={openObject} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{image}</Link>
              <Link href={object.route} onClick={openObject} className="min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</Link>
            </>
          )}
        </>
      ) : (
        <>
          {object.primaryAction && ["play", "play-next", "queue"].includes(object.primaryAction.intent) ? (
            <>
              <button type="button" onClick={activateCard} className={`relative block w-full overflow-hidden bg-white/5 text-left ${feature ? "aspect-[16/9] sm:aspect-[2/1]" : "aspect-square"}`}>{image}</button>
              <div className={feature ? "p-6 sm:p-8" : "p-4 sm:p-5"}>
                <button type="button" onClick={activateCard} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</button>
              </div>
            </>
          ) : (
            <>
              <Link href={object.route} onClick={openObject} className={`relative block overflow-hidden bg-white/5 ${feature ? "aspect-[16/9] sm:aspect-[2/1]" : "aspect-square"}`}>{image}</Link>
              <div className={feature ? "p-6 sm:p-8" : "p-4 sm:p-5"}>
                <Link href={object.route} onClick={openObject} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</Link>
              </div>
            </>
          )}
        </>
      )}

      <div className={`${compact ? "shrink-0" : "px-4 pb-4 sm:px-5 sm:pb-5"} flex items-center gap-2`}>
        {object.primaryAction ? (
          object.primaryAction.intent === "navigate" && object.primaryAction.href ? (
            <Link href={object.primaryAction.href} onClick={openObject} className="min-h-11 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {object.primaryAction.label}
            </Link>
          ) : (
            <button type="button" onClick={() => primary(object.primaryAction!)} className="min-h-11 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {object.primaryAction.label}
            </button>
          )
        ) : null}
        <button ref={overflowRef} type="button" onClick={() => setActionsOpen(true)} aria-haspopup="dialog" aria-label={`More actions for ${object.title}`} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-lg text-text-secondary transition hover:border-brand/40 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          •••
        </button>
      </div>

      <BvsActionSheet object={object} open={actionsOpen} onClose={() => setActionsOpen(false)} returnFocus={overflowRef} />
    </article>
  );
}
