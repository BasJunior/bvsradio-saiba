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
  onDismiss?: () => void;
};

const BVS_STORY_LOGO = "/branding/bvs-share-logo.png";

function drawWrappedText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = value.trim().split(/\s+/).filter(Boolean).flatMap(word => {
    const chunks: string[] = [];
    let chunk = "";
    for (const letter of word) {
      if (chunk && context.measureText(chunk + letter).width > maxWidth) { chunks.push(chunk); chunk = ""; }
      chunk += letter;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
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
  const lime = "#bbff65";
  context.fillStyle = "#101211";
  context.fillRect(0, 0, canvas.width, canvas.height);
  // All important content stays inside Story controls' top and bottom zones.
  const top = story ? 220 : 64;
  const [logo, loaded] = await Promise.all([loadStoryImage(BVS_STORY_LOGO), loadStoryImage(image)]);
  if (logo?.image) drawContainedImage(context, logo.image, 72, top, 112, 112);
  context.fillStyle = lime;
  context.font = "700 24px Arial, sans-serif";
  drawWrappedText(context, kicker.toUpperCase(), 216, top + 46, 770, 32, 2);
  context.fillStyle = "#a6aca6";
  context.font = "400 22px Arial, sans-serif";
  context.fillText("BEST VIRTUAL SOUND", 216, top + 94);

  const coverX = story ? 110 : 72, coverY = story ? 370 : 236;
  const coverSize = story ? 860 : 480;
  if (loaded?.image) drawCoverImage(context, loaded.image, coverX, coverY, coverSize, coverSize, 24);
  else {
    context.fillStyle = "#20281b";
    context.fillRect(coverX, coverY, coverSize, coverSize);
    if (logo?.image) drawContainedImage(context, logo.image, coverX + coverSize * .16, coverY + coverSize * .16, coverSize * .68, coverSize * .68);
  }
  if (logo?.objectUrl) URL.revokeObjectURL(logo.objectUrl);
  if (loaded?.objectUrl) URL.revokeObjectURL(loaded.objectUrl);

  const titleX = story ? 72 : 596;
  const titleY = story ? 1320 : 296;
  const titleWidth = story ? 936 : 410;
  context.fillStyle = "#ffffff";
  context.font = `700 ${story ? 72 : 54}px Arial, sans-serif`;
  const afterTitle = drawWrappedText(context, title, titleX, titleY, titleWidth, story ? 82 : 64, 3);
  if (text) {
    context.fillStyle = "#b6bcb6";
    context.font = `400 ${story ? 30 : 27}px Arial, sans-serif`;
    drawWrappedText(context, text, titleX, afterTitle + 24, titleWidth, 40, story ? 2 : 4);
  }
  const footerY = story ? 1732 : 910;
  context.fillStyle = lime;
  context.fillRect(72, footerY - 35, 5, 58);
  context.font = "700 25px Arial, sans-serif";
  const category = kicker.toLowerCase();
  const action = category.includes("beat") ? "FIND YOUR NEXT RECORD" : /creator|artist|producer/.test(category) ? "MEET YOUR NEXT FAVOURITE" : category.includes("show") || category.includes("episode") ? "TUNE IN ON BVS" : category.includes("community") ? "JOIN THE CONVERSATION" : "PRESS PLAY ON BVS";
  context.fillText(action, 98, footerY);
  context.textAlign = "right";
  context.fillStyle = "#ffffff";
  context.font = "600 24px Arial, sans-serif";
  context.fillText("bvsradio.com", 1008, footerY);
  context.textAlign = "left";
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
        const pending = navigator.share({ title: `${title} · BVS`, text: `${shareText}\n${url}`, files: [storyCard] });
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
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setMessage("Couldn’t copy the link. Try Share link."); }
  };

  const shareLayer = open && typeof document !== "undefined" ? createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${title}`}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0b0b0d] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Share on social</p>
            <h2 className="mt-1 text-2xl font-semibold">Share your discovery.</h2>
          </div>
          <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-lg text-white/55" aria-label="Close share">×</button>
        </div>

        <div className="mt-4 flex gap-2" aria-label="Card format">
          {(["story", "square"] as const).map(value => <button key={value} type="button" aria-pressed={format === value} onClick={() => setFormat(value)} className={`min-h-10 flex-1 rounded-full border px-4 text-xs ${format === value ? "border-[#bbff65] bg-[#bbff65]/10 text-[#bbff65]" : "border-white/15 text-white/60"}`}>{value === "story" ? "Story · 9:16" : "Post · 1:1"}</button>)}
        </div>
        <div className="mt-4 flex min-h-52 justify-center rounded-2xl bg-white/[.03] p-3" aria-busy={!card || card.format !== format}>
          {card && card.format === format ? <img src={card.preview} alt={`${title} ${format} share card`} className={`max-h-[40dvh] w-auto rounded-lg ${format === "story" ? "aspect-[9/16]" : "aspect-square"}`} /> : <p className="self-center text-sm text-white/50">Preparing your card…</p>}
        </div>
        <p className="mt-2 text-center text-[11px] text-white/45">The preview is the exact image you’ll share.</p>
        <button type="button" disabled={sharing || !card || card.format !== format} onClick={() => void share()} className="mt-4 min-h-12 w-full rounded-2xl bg-[#bbff65] px-5 text-sm font-semibold text-black disabled:opacity-50">{sharing ? "Opening share…" : "Share card…"}</button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={!card || card.format !== format} onClick={save} className="min-h-11 rounded-xl border border-white/15 text-sm disabled:opacity-40">Save image</button>
          <button type="button" onClick={() => void copy()} className="min-h-11 rounded-xl border border-white/15 text-sm">{copied ? "Copied ✓" : "Copy link"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${text || kicker}\n${url}`)}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-white/15 text-sm">WhatsApp link ↗</a>
          <button type="button" onClick={() => void shareLink()} className="min-h-11 rounded-xl border border-white/15 text-sm">Share link…</button>
        </div>
        <p className="mt-3 text-center text-xs leading-5 text-white/50">Choose Instagram, WhatsApp or another app from your phone’s share sheet. For Stories, copy the link and add a link sticker.</p>
        {message ? <p role="status" className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-white/75">{message}</p> : null}
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
        Share
      </button>}
      {shareLayer}
    </>
  );
}
