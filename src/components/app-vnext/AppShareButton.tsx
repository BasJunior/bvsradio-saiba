"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { shareBvs } from "@/lib/app-native";
import { canonicalBvsShareUrl } from "@/lib/share-url";

type AppShareButtonProps = {
  title: string;
  text?: string;
  path: string;
  image?: string;
  kicker?: string;
  compact?: boolean;
};

function drawWrappedText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  lines.forEach((line, index) => context.fillText(line, x, y + (index * lineHeight)));
  return y + (lines.length * lineHeight);
}

async function makeStoryCard({ title, text, kicker }: { title: string; text?: string; kicker: string }) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const background = context.createLinearGradient(0, 0, 1080, 1920);
  background.addColorStop(0, "#18130a");
  background.addColorStop(0.48, "#08090c");
  background.addColorStop(1, "#020204");
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1920);

  const glow = context.createRadialGradient(850, 250, 20, 850, 250, 700);
  glow.addColorStop(0, "rgba(231,187,53,.32)");
  glow.addColorStop(1, "rgba(231,187,53,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1080, 1100);

  context.fillStyle = "#f2ce65";
  context.fillRect(72, 72, 250, 154);
  context.fillStyle = "#050505";
  context.font = "900 56px Arial, sans-serif";
  context.fillText("BVS", 96, 140);
  context.font = "900 48px Arial, sans-serif";
  context.fillText("radio", 96, 197);

  context.fillStyle = "#e8bd38";
  context.font = "700 30px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText(kicker.toUpperCase().slice(0, 46), 78, 1020);
  context.letterSpacing = "0px";

  context.fillStyle = "#ffffff";
  context.font = "700 92px Arial, sans-serif";
  const afterTitle = drawWrappedText(context, title, 78, 1125, 920, 106, 4);

  if (text) {
    context.fillStyle = "rgba(255,255,255,.70)";
    context.font = "400 40px Arial, sans-serif";
    drawWrappedText(context, text, 82, Math.min(afterTitle + 46, 1580), 900, 56, 3);
  }

  context.fillStyle = "rgba(232,189,56,.98)";
  context.font = "700 31px Arial, sans-serif";
  context.letterSpacing = "4px";
  context.fillText("B V S R A D I O . C O M", 78, 1780);
  context.letterSpacing = "0px";
  context.fillStyle = "rgba(255,255,255,.38)";
  context.font = "400 27px Arial, sans-serif";
  context.fillText("Listen · discover · create", 78, 1832);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.96));
  if (!blob) return null;
  const filename = `bvs-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "share"}.png`;
  return new File([blob], filename, { type: "image/png" });
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

export default function AppShareButton({
  title,
  text,
  path,
  image,
  kicker = "BVS Radio",
  compact = false,
}: AppShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const url = canonicalBvsShareUrl(path);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    const shareText = text || `${title} on BVS Radio`;
    try {
      const storyCard = await makeStoryCard({ title, text: shareText, kicker });
      const canShareStory = Boolean(storyCard && navigator.share && navigator.canShare?.({ files: [storyCard] }));

      // Dismiss BVS chrome before asking iOS/Android to present its own share sheet.
      // This avoids a WKWebView stacking/focus deadlock where only our blurred backdrop remains visible.
      setOpen(false);
      await nextPaint();

      if (storyCard && canShareStory) {
        try {
          await navigator.share({
            title: `${title} · BVS`,
            text: `${shareText}\n${url}`,
            files: [storyCard],
          });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      await shareBvs({ title: `${title} · BVS`, text: shareText, url });
    } finally {
      setSharing(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const shareLayer = open && typeof document !== "undefined" ? createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${title}`}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0b0b0d] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Share on social</p>
            <h2 className="mt-1 text-2xl font-semibold">Put BVS in the story.</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-lg text-white/55" aria-label="Close share">×</button>
        </div>

        <div
          className="relative mt-5 min-h-52 overflow-hidden rounded-[1.6rem] border border-brand/25 bg-black bg-cover bg-center p-5"
          style={image ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.92)), url(${JSON.stringify(image)})` } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-black/70" />
          <div className="relative flex min-h-42 flex-col justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-brand">{kicker}</p>
            <div>
              <h3 className="line-clamp-2 text-3xl font-semibold tracking-tight text-white">{title}</h3>
              {text ? <p className="mt-2 line-clamp-2 text-sm text-white/65">{text}</p> : null}
              <p className="mt-4 text-xs font-semibold uppercase tracking-[.18em] text-brand">bvsradio.com</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center" aria-label="Story-ready destinations">
          <div className="rounded-2xl border border-white/10 bg-white/[.03] px-2 py-3"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-black text-black">IG</span><p className="mt-2 text-xs">Instagram</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] px-2 py-3"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-black text-black">TT</span><p className="mt-2 text-xs">TikTok</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] px-2 py-3"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-base font-black text-black">↗</span><p className="mt-2 text-xs">Stories + more</p></div>
        </div>

        <button type="button" disabled={sharing} onClick={() => void share()} className="mt-3 min-h-12 w-full rounded-2xl bg-brand px-5 text-sm font-semibold text-black disabled:opacity-60">
          {sharing ? "Preparing story card…" : "Share story card"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-5 text-white/35">BVS prepares a 9:16 card when your phone supports file sharing. Otherwise it opens the normal system share sheet with the canonical BVS link.</p>
        <button type="button" onClick={() => void copy()} className="mt-3 min-h-11 w-full rounded-2xl border border-white/12 px-5 text-sm font-semibold text-white/70">
          {copied ? "Link copied ✓" : "Copy bvsradio.com link"}
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "min-h-9 rounded-full border border-white/10 px-3 text-xs" : "min-h-10 rounded-full border border-white/15 px-4 text-sm"}
      >
        Share
      </button>
      {shareLayer}
    </>
  );
}
