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
  "compact-row": "bvs-surface bvs-surface-hover flex items-center gap-3 rounded-[1.35rem] p-3",
  "rail-card": "bvs-surface bvs-surface-hover w-[min(78vw,19rem)] shrink-0 overflow-hidden rounded-[1.75rem]",
  "feature-card": "bvs-surface bvs-surface-hover overflow-hidden rounded-[2rem]",
  "grid-card": "bvs-surface bvs-surface-hover overflow-hidden rounded-[1.75rem]",
  "relationship-card": "bvs-surface bvs-surface-hover flex items-center gap-3 rounded-[1.35rem] p-3",
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
  const compact = variant === "compact-row" || variant === "relationship-card";
  const feature = variant === "feature-card";
  const supportsDetails = object.kind === "track" || object.kind === "beat" || object.kind === "release";

  function openObject() {
    recordFlowOpen(object, relationship);
    trackEvent(relationship ? "flow_relationship_open" : "flow_object_open", {
      object_id: object.id,
      object_kind: object.kind,
      source: variant,
      relationship: relationship || null,
    });
    if (["beat", "product", "service"].includes(object.kind)) {
      trackEvent("contextual_commerce_open", {
        object_id: object.id,
        object_kind: object.kind,
        source: variant,
        relationship: relationship || null,
      });
    }
  }

  function primary(action: BvsAction) {
    if (["play", "play-next", "queue"].includes(action.intent)) runQueueAction(action, object);
  }

  const detailProps = supportsDetails
    ? {
        "data-flow-detail-trigger": object.kind,
        "data-flow-detail-id": object.id,
        "data-flow-detail-title": object.title,
        "data-flow-detail-artist": object.media?.artist || object.subtitle || "BVS creator",
        "data-flow-detail-image": object.artwork || "",
        "data-flow-detail-collection": object.media?.project || object.contextLabel || "",
        "data-flow-detail-src": object.media?.src || "",
        "data-flow-detail-href": object.route,
      }
    : {};

  const hasUsableArtwork = Boolean(object.artwork && !object.artwork.includes("default-avatar"));
  const image = hasUsableArtwork && failedArtwork !== object.artwork ? (
    <Image
      src={object.artwork!}
      alt=""
      fill
      unoptimized={/^https?:\/\//i.test(object.artwork!)}
      sizes={compact ? "72px" : feature ? "(max-width:768px) 100vw, 50vw" : "(max-width:768px) 78vw, 320px"}
      className="object-cover transition duration-300 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
      onError={() => setFailedArtwork(object.artwork || null)}
    />
  ) : (
    <span className="absolute inset-0 grid place-items-center text-xs font-semibold uppercase tracking-[.18em] text-brand">BVS</span>
  );

  const content = (
    <>
      <p className="bvs-chip bvs-chip-brand">{object.contextLabel || objectKindLabel(object.kind)}</p>
      <h3 className={`${feature ? "text-2xl sm:text-3xl" : "text-lg"} mt-2 line-clamp-2 font-semibold tracking-tight`}>{object.title}</h3>
      {object.subtitle ? <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-secondary">{object.subtitle}</p> : null}
      {object.metadata?.length ? <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-secondary/90">{object.metadata.join(" · ")}</p> : null}
      {object.availabilityLabel ? <p className="mt-2 text-xs font-medium text-emerald-200/90">{object.availabilityLabel}</p> : null}
    </>
  );

  return (
    <article className={`group ${surfaceByVariant[variant]}`} data-flow-focus-id={`${object.kind}:${object.id}`} tabIndex={-1}>
      {compact ? (
        <>
          <Link {...detailProps} href={object.route} onClick={openObject} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{image}</Link>
          <Link {...detailProps} href={object.route} onClick={openObject} className="min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</Link>
        </>
      ) : (
        <>
          <Link {...detailProps} href={object.route} onClick={openObject} className={`relative block overflow-hidden bg-gradient-to-br from-white/[.07] to-white/[.02] ${feature ? "aspect-[16/9] sm:aspect-[2/1]" : "aspect-square"}`}>{image}</Link>
          <div className={feature ? "p-6 sm:p-8" : "p-4 sm:p-5"}>
            <Link {...detailProps} href={object.route} onClick={openObject} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{content}</Link>
          </div>
        </>
      )}

      <div className={`${compact ? "shrink-0" : "px-4 pb-4 sm:px-5 sm:pb-5"} flex items-center gap-2`}>
        {object.primaryAction ? (
          object.primaryAction.intent === "navigate" && object.primaryAction.href ? (
            <Link data-flow-detail-skip="true" href={object.primaryAction.href} onClick={openObject} className="min-h-11 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(212,175,55,.22)] transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {object.primaryAction.label}
            </Link>
          ) : (
            <button type="button" onClick={() => primary(object.primaryAction!)} className="min-h-11 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(212,175,55,.22)] transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {object.primaryAction.label}
            </button>
          )
        ) : null}
        <button ref={overflowRef} type="button" onClick={() => setActionsOpen(true)} aria-haspopup="dialog" aria-label={`More actions for ${object.title}`} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[.03] text-lg text-text-secondary transition hover:border-brand/40 hover:bg-brand/[.08] hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          •••
        </button>
      </div>

      <BvsActionSheet object={object} open={actionsOpen} onClose={() => setActionsOpen(false)} returnFocus={overflowRef} />
    </article>
  );
}
