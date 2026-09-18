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

const BVS_STORY_LOGO = "/branding/bvs-logo.png";

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

async function loadStoryImage(src?: string) {
  if (!src || typeof window === "undefined") return null;
  try {
    const resolved = new URL(src, "https://bvsradio.com");
    const response = await fetch(resolved.href, {
      cache: "force-cache",
      credentials: "same-origin",
      mode: "cors",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => resolve(null);
      candidate.src = objectUrl;
    });
    return { image, objectUrl };
  } catch {
    return null;
  }
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (image.naturalWidth - sourceWidth) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) / 2);
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  const shade = context.createLinearGradient(0, y, 0, y + height);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,.22)");
  context.fillStyle = shade;
  context.fillRect(x, y, width, height);
  context.restore();
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    x + ((width - renderedWidth) / 2),
    y + ((height - renderedHeight) / 2),
    renderedWidth,
    renderedHeight,
  );
}

function drawArtworkFallback(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const panel = context.createLinearGradient(x, y, x + width, y + height);
  panel.addColorStop(0, "#241b08");
  panel.addColorStop(0.55, "#111116");
  panel.addColorStop(1, "#050506");
  context.fillStyle = panel;
  context.beginPath();
  context.roundRect(x, y, width, height, 48);
  context.fill();
  context.strokeStyle = "rgba(232,189,56,.35)";
  context.lineWidth = 3;
  context.stroke();

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const heights = [110, 210, 320, 430, 290, 170, 90];
  heights.forEach((barHeight, index) => {
    const barX = centerX - 162 + (index * 54);
    context.fillStyle = index === 3 ? "#f1c94a" : "rgba(241,201,74,.7)";
    context.beginPath();
    context.roundRect(barX, centerY - barHeight / 2, 26, barHeight, 13);
    context.fill();
  });
}

async function makeStoryCard({ title, text, kicker, image }: { title: string; text?: string; kicker: string; image?: string }) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const background = context.createLinearGradient(0, 0, 1080, 1920);
  background.addColorStop(0, "#211708");
  background.addColorStop(0.32, "#0c0b0b");
  background.addColorStop(1, "#020204");
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1920);

  const glow = context.createRadialGradient(820, 180, 20, 820, 180, 760);
  glow.addColorStop(0, "rgba(231,187,53,.34)");
  glow.addColorStop(1, "rgba(231,187,53,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1080, 1050);

  // Use the production BVS mark rather than recreating it with canvas text.
  // A contained image box keeps the mark consistent and prevents header clipping.
  const storyLogo = await loadStoryImage(BVS_STORY_LOGO);
  context.fillStyle = "#f2ce65";
  context.beginPath();
  context.roundRect(72, 64, 250, 154, 26);
  context.fill();
  if (storyLogo?.image) drawContainedImage(context, storyLogo.image, 88, 78, 218, 126);
  else {
    // This only covers an unavailable image asset; it deliberately avoids branded text fragments.
    context.fillStyle = "#050505";
    context.beginPath();
    context.roundRect(171, 111, 52, 52, 14);
    context.fill();
  }
  if (storyLogo?.objectUrl) URL.revokeObjectURL(storyLogo.objectUrl);

  context.fillStyle = "rgba(255,255,255,.48)";
  context.font = "700 25px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText("SHARED FROM BVS", 1002, 132);
  context.textAlign = "left";

  const loaded = await loadStoryImage(image);
  if (loaded?.image) drawCoverImage(context, loaded.image, 72, 278, 936, 936, 54);
  else drawArtworkFallback(context, 72, 278, 936, 936);
  if (loaded?.objectUrl) URL.revokeObjectURL(loaded.objectUrl);

  context.fillStyle = "#e8bd38";
  context.font = "700 28px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText(kicker.toUpperCase().slice(0, 46), 78, 1315);
  context.letterSpacing = "0px";

  context.fillStyle = "#ffffff";
  context.font = "700 82px Arial, sans-serif";
  const afterTitle = drawWrappedText(context, title, 78, 1415, 924, 92, 3);

  if (text) {
    context.fillStyle = "rgba(255,255,255,.68)";
    context.font = "400 36px Arial, sans-serif";
    drawWrappedText(context, text, 82, Math.min(afterTitle + 32, 1670), 900, 50, 2);
  }

  context.fillStyle = "rgba(232,189,56,.14)";
  context.beginPath();
  context.roundRect(78, 1733, 924, 104, 36);
  context.fill();
  context.strokeStyle = "rgba(232,189,56,.28)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#f0c94f";
  context.font = "700 28px Arial, sans-serif";
  context.letterSpacing = "3px";
  context.fillText("OPEN ON BVS", 112, 1797);
  context.letterSpacing = "0px";
  context.fillStyle = "rgba(255,255,255,.68)";
  context.font = "600 30px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText("bvsradio.com", 968, 1797);
  context.textAlign = "left";

  context.fillStyle = "rgba(255,255,255,.30)";
  context.font = "400 24px Arial, sans-serif";
  context.fillText("Music · creators · culture", 80, 1880);

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
      const storyCard = await makeStoryCard({ title, text: shareText, kicker, image });
      const canShareStory = Boolean(storyCard && navigator.canShare?.({ files: [storyCard] }));

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
          className="relative mt-5 min-h-72 overflow-hidden rounded-[1.6rem] border border-brand/25 bg-black bg-cover bg-center p-5"
          style={image ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.88)), url(${JSON.stringify(image)})` } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-black/70" />
          <div className="relative flex min-h-64 flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-brand">{kicker}</p>
              <span className="rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[9px] font-semibold uppercase tracking-[.12em] text-white/60">BVS Radio</span>
            </div>
            <div>
              <h3 className="line-clamp-2 text-3xl font-semibold tracking-tight text-white">{title}</h3>
              {text ? <p className="mt-2 line-clamp-2 text-sm text-white/70">{text}</p> : null}
              <p className="mt-4 text-xs font-semibold uppercase tracking-[.18em] text-brand">Open on BVS · bvsradio.com</p>
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
        <p className="mt-2 text-center text-[11px] leading-5 text-white/35">BVS prepares a 9:16 artwork card for supported apps, then hands it to the native share sheet with the canonical BVS link.</p>
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
