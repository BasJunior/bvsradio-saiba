"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { shareBvs } from "@/lib/app-native";
import { canonicalBvsShareUrl } from "@/lib/share-url";

export type AppShareButtonProps = {
  title: string;
  text?: string;
  path: string;
  image?: string;
  kicker?: string;
  compact?: boolean;
  autoOpen?: boolean;
  hideTrigger?: boolean;
  triggerLabel?: string;
  onDismiss?: () => void;
};

const BVS_STORY_LOGO = "/branding/bvs-logo-cyan-2026.png";
const BVS_LIME = "#bbff65";
const BVS_BLACK = "#050605";
const BVS_CHARCOAL = "#1b1b1b";
const BVS_SHARE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

async function loadStoryImage(src?: string) {
  if (!src || typeof window === "undefined") return null;
  try {
    const base = /^https?:/.test(window.location.href) ? window.location.href : "https://bvsradio.com";
    const resolved = new URL(src, base);
    const response = await fetch(resolved.href, {
      cache: "force-cache",
      credentials: "same-origin",
      mode: "cors",
      signal: AbortSignal.timeout(8000),
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

function coverCrop(image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  return {
    sourceWidth,
    sourceHeight,
    sourceX: Math.max(0, (image.naturalWidth - sourceWidth) / 2),
    sourceY: Math.max(0, (image.naturalHeight - sourceHeight) / 2),
  };
}

function drawCoverFill(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { sourceX, sourceY, sourceWidth, sourceHeight } = coverCrop(image, width, height);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawSquareCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { sourceX, sourceY, sourceWidth, sourceHeight } = coverCrop(image, width, height);
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
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

function fitTextSize(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  preferred: number,
  minimum: number,
  weight = 800,
) {
  let size = preferred;
  do {
    context.font = `${weight} ${size}px ${BVS_SHARE_FONT}`;
    if (context.measureText(value).width <= maxWidth) return size;
    size -= 1;
  } while (size > minimum);
  return minimum;
}

function fitSingleLine(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) return value;
  let fitted = value.trim();
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > maxWidth) fitted = fitted.slice(0, -1).trimEnd();
  return `${fitted}…`;
}

function cleanCardText(value?: string) {
  if (!value) return "";
  return value
    .replace(/\s*·\s*Listen on BVS Radio\s*$/i, "")
    .replace(/^Listen on BVS Radio$/i, "")
    .trim();
}

function shareActionFor(kicker: string) {
  const category = kicker.toLowerCase();
  return category.includes("buy this beat") ? "BUY THIS BEAT ON BVS"
    : category.includes("listen and save") ? "LISTEN AND SAVE ON BVS"
      : category.includes("beat") ? "FIND YOUR NEXT RECORD"
        : /creator|artist|producer/.test(category) ? "MEET YOUR NEXT FAVOURITE"
          : category.includes("show") || category.includes("episode") ? "TUNE IN ON BVS"
            : category.includes("community") ? "JOIN THE CONVERSATION"
              : "LISTEN ON BVS";
}

export type ShareCardFormat = "story" | "square";

export async function makeStoryCard({ title, text, kicker, image, format = "story" }: { title: string; text?: string; kicker: string; image?: string; format?: ShareCardFormat }) {
  if (typeof document === "undefined") return null;
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = format === "story" ? 1920 : 1080;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const story = format === "story";
  const centerX = canvas.width / 2;
  const action = shareActionFor(kicker);
  const cardText = cleanCardText(text);
  const [logo, loaded] = await Promise.all([loadStoryImage(BVS_STORY_LOGO), loadStoryImage(image)]);

  context.fillStyle = BVS_BLACK;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // The artwork itself becomes the poster backdrop, heavily blurred and darkened.
  if (loaded?.image) {
    context.save();
    if ("filter" in context) context.filter = story ? "blur(56px) saturate(1.08) brightness(.58)" : "blur(42px) saturate(1.06) brightness(.54)";
    drawCoverFill(context, loaded.image, -100, -100, canvas.width + 200, canvas.height + 200);
    context.restore();
  }
  const backdropShade = context.createLinearGradient(0, 0, 0, canvas.height);
  backdropShade.addColorStop(0, "rgba(0,0,0,.18)");
  backdropShade.addColorStop(.58, "rgba(0,0,0,.36)");
  backdropShade.addColorStop(1, "rgba(0,0,0,.76)");
  context.fillStyle = backdropShade;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Poster geometry: square corners, thick black frame, no glass or waveform.
  const cardX = story ? 100 : 190;
  const cardWidth = story ? 880 : 700;
  const frame = story ? 18 : 14;
  const headerY = story ? 250 : 30;
  const headerHeight = story ? 120 : 70;
  const artworkY = headerY + headerHeight + frame;
  const artworkSize = cardWidth;
  const infoY = artworkY + artworkSize + frame;
  const infoHeight = story ? 220 : 114;
  const upperBottom = infoY + infoHeight;

  context.fillStyle = BVS_BLACK;
  context.fillRect(cardX - frame, headerY - frame, cardWidth + (frame * 2), upperBottom - headerY + (frame * 2));

  context.fillStyle = BVS_CHARCOAL;
  context.fillRect(cardX, headerY, cardWidth, headerHeight);

  context.textAlign = "center";
  context.fillStyle = BVS_LIME;
  const headlineSize = story ? 86 : 52;
  context.font = `900 ${headlineSize}px ${BVS_SHARE_FONT}`;
  context.fillText("NOW ON BVS", centerX, headerY + (story ? 88 : 53));

  context.fillStyle = BVS_BLACK;
  context.fillRect(cardX, artworkY, cardWidth, artworkSize);
  if (loaded?.image) {
    drawSquareCoverImage(context, loaded.image, cardX, artworkY, cardWidth, artworkSize);
  } else if (logo?.image) {
    context.fillStyle = "#111311";
    context.fillRect(cardX, artworkY, cardWidth, artworkSize);
    drawContainedImage(context, logo.image, cardX + (cardWidth * .2), artworkY + (artworkSize * .2), cardWidth * .6, artworkSize * .6);
  }

  context.fillStyle = BVS_CHARCOAL;
  context.fillRect(cardX, infoY, cardWidth, infoHeight);

  const textX = cardX + (story ? 48 : 34);
  const textWidth = cardWidth - (story ? 96 : 68);
  const titleSize = fitTextSize(context, title, textWidth, story ? 72 : 42, story ? 38 : 27, 900);
  context.textAlign = "left";
  context.fillStyle = "#ffffff";
  context.font = `900 ${titleSize}px ${BVS_SHARE_FONT}`;
  const fittedTitle = fitSingleLine(context, title, textWidth);
  context.fillText(fittedTitle, textX, infoY + (story ? 90 : 48));

  if (cardText) {
    const artistSize = fitTextSize(context, cardText, textWidth, story ? 42 : 25, story ? 28 : 18, 700);
    context.fillStyle = "rgba(255,255,255,.72)";
    context.font = `700 ${artistSize}px ${BVS_SHARE_FONT}`;
    const fittedArtist = fitSingleLine(context, cardText, textWidth);
    context.fillText(fittedArtist, textX, infoY + (story ? 166 : 88));
  }

  // The CTA is intentionally disconnected from the upper card, but its logo and action cells touch.
  const ctaY = story ? 1600 : 958;
  const ctaHeight = story ? 170 : 86;
  const ctaLogoWidth = story ? 200 : 110;
  context.fillStyle = BVS_BLACK;
  context.fillRect(cardX - frame, ctaY - frame, cardWidth + (frame * 2), ctaHeight + (frame * 2));

  context.fillStyle = "#deded9";
  context.fillRect(cardX, ctaY, ctaLogoWidth, ctaHeight);
  if (logo?.image) {
    const logoPad = story ? 18 : 10;
    drawContainedImage(context, logo.image, cardX + logoPad, ctaY + logoPad, ctaLogoWidth - (logoPad * 2), ctaHeight - (logoPad * 2));
  }

  const ctaContentX = cardX + ctaLogoWidth;
  const ctaContentWidth = cardWidth - ctaLogoWidth;
  context.fillStyle = BVS_CHARCOAL;
  context.fillRect(ctaContentX, ctaY, ctaContentWidth, ctaHeight);

  const ctaTextX = ctaContentX + (story ? 46 : 24);
  const ctaTextWidth = ctaContentWidth - (story ? 150 : 82);
  const ctaFont = fitTextSize(context, action, ctaTextWidth, story ? 56 : 29, story ? 34 : 20, 900);
  context.textAlign = "left";
  context.fillStyle = BVS_LIME;
  context.font = `900 ${ctaFont}px ${BVS_SHARE_FONT}`;
  context.fillText(action, ctaTextX, ctaY + (ctaHeight / 2) + (ctaFont * .35));

  context.textAlign = "right";
  context.font = `800 ${story ? 72 : 40}px ${BVS_SHARE_FONT}`;
  context.fillText("→", cardX + cardWidth - (story ? 30 : 18), ctaY + (ctaHeight / 2) + (story ? 24 : 14));
  context.textAlign = "left";

  if (logo?.objectUrl) URL.revokeObjectURL(logo.objectUrl);
  if (loaded?.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "share";
  return new File([blob], `bvs-${name}-${format}.png`, { type: "image/png" });
}

export default function AppShareButton({
  title,
  text,
  path,
  image,
  kicker = "BVS Radio",
  compact = false,
  autoOpen = false,
  hideTrigger = false,
  triggerLabel = "Share",
  onDismiss,
}: AppShareButtonProps) {
  const [open, setOpen] = useState(autoOpen);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const url = canonicalBvsShareUrl(path);
  const [format, setFormat] = useState<ShareCardFormat>("story");
  const [card, setCard] = useState<{ file: File; preview: string; format: ShareCardFormat } | null>(null);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); onDismiss?.(); };

  useEffect(() => {
    if (!open) return;
    let active = true;
    let preview = "";
    setCard(null);
    setMessage("");
    void makeStoryCard({ title, text, kicker, image, format }).then(file => {
      if (!active) return;
      if (!file) { setMessage("Couldn’t prepare the card. You can still share the link."); return; }
      preview = URL.createObjectURL(file);
      setCard({ file, preview, format });
    }).catch(() => { if (active) setMessage("Couldn’t prepare the card. You can still share the link."); });
    return () => { active = false; if (preview) URL.revokeObjectURL(preview); };
  }, [open, title, text, kicker, image, format]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); onDismiss?.(); }
      if (event.key === "Tab") {
        const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') || []);
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onDismiss]);

  const share = async () => {
    if (sharing || !card || card.format !== format) return;
    setSharing(true);
    const storyCard = card.file;
    const shareText = text || `${title} on BVS Radio`;
    try {
      if (navigator.canShare?.({ files: [storyCard] })) {
        // Start the system sheet during this tap, before awaiting any image work.
        const pending = navigator.share({ title: `${title} · BVS`, text: `${shareText}\n${url}`, url, files: [storyCard] });
        setOpen(false);
        await pending;
        onDismiss?.();
      } else {
        setMessage("Save the card, then add it to Instagram or WhatsApp. Use Copy link for a Story link sticker.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setOpen(true);
        setMessage("Sharing didn’t open. Save the card or share the link instead.");
      } else onDismiss?.();
    } finally { setSharing(false); }
  };

  const shareLink = async () => {
    setOpen(false);
    await shareBvs({ title: `${title} · BVS`, text: text || kicker, url });
    onDismiss?.();
  };

  const save = () => {
    if (!card || card.format !== format) return;
    const anchor = document.createElement("a");
    anchor.href = card.preview;
    anchor.download = card.file.name;
    anchor.click();
    setMessage("Card saved. Add it to your post or Story, then attach the BVS link.");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setMessage(format === "story" ? "Link copied. In Instagram, choose Stickers → Link, paste it and label it Listen on BVS." : "Link copied. Paste it into your post or message.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setMessage("Couldn’t copy the link. Try Share link."); }
  };

  const shareLayer = open && typeof document !== "undefined" ? createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${title}`}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#090b09]/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[30px] sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">BVS Share Card</p>
            <h2 className="mt-1 text-2xl font-semibold">Share your discovery.</h2>
          </div>
          <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.04] text-lg text-white/65" aria-label="Close share">×</button>
        </div>

        <div className="mt-4 flex gap-2 rounded-2xl bg-white/[.035] p-1.5" aria-label="Card format">
          {(["story", "square"] as const).map(value => <button key={value} type="button" aria-pressed={format === value} onClick={() => setFormat(value)} className={`min-h-10 flex-1 rounded-xl border px-4 text-xs font-medium transition ${format === value ? "border-[#bbff65]/70 bg-[#bbff65]/12 text-[#bbff65]" : "border-transparent text-white/55"}`}>{value === "story" ? "Story · 9:16" : "Post · 1:1"}</button>)}
        </div>
        <div className="mt-4 flex min-h-52 justify-center rounded-3xl border border-white/[.06] bg-white/[.025] p-3" aria-busy={!card || card.format !== format}>
          {card && card.format === format ? <img src={card.preview} alt={`${title} ${format} share card`} className={`max-h-[40dvh] w-auto rounded-2xl ${format === "story" ? "aspect-[9/16]" : "aspect-square"}`} /> : <p className="self-center text-sm text-white/50">Preparing your card…</p>}
        </div>
        <p className="mt-2 text-center text-[11px] text-white/45">The preview is the exact image you’ll share.</p>
        <button type="button" disabled={sharing || !card || card.format !== format} onClick={() => void share()} className="mt-4 min-h-12 w-full rounded-2xl bg-[#bbff65] px-5 text-sm font-bold text-black shadow-[0_0_32px_rgba(187,255,101,.12)] disabled:opacity-50">{sharing ? "Opening share…" : "Share card…"}</button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={!card || card.format !== format} onClick={save} className="min-h-11 rounded-2xl border border-white/10 bg-white/[.025] text-sm disabled:opacity-40">Save image</button>
          <button type="button" onClick={() => void copy()} className="min-h-11 rounded-2xl border border-white/10 bg-white/[.025] text-sm">{copied ? "Link copied ✓" : format === "story" ? "Copy Story link" : "Copy link"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${text || kicker}\n${url}`)}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[.025] text-sm">WhatsApp link ↗</a>
          <button type="button" onClick={() => void shareLink()} className="min-h-11 rounded-2xl border border-white/10 bg-white/[.025] text-sm">Share link…</button>
        </div>
        <p className="mt-3 text-center text-xs leading-5 text-white/50">For an Instagram Story: share or save the card, copy the Story link, then add a Link sticker in Instagram. The sticker opens this exact title on BVS.</p>
        {message ? <p role="status" className="mt-3 rounded-2xl border border-white/[.06] bg-white/[.04] p-3 text-sm text-white/75">{message}</p> : null}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      {!hideTrigger && <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "min-h-9 rounded-full border border-white/10 px-3 text-xs" : "min-h-10 rounded-full border border-white/15 px-4 text-sm"}
      >
        {triggerLabel}
      </button>}
      {shareLayer}
    </>
  );
}
