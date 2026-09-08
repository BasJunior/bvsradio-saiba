"use client";

import { useEffect, useState } from "react";
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
    const ok = await shareBvs({
      title: `${title} · BVS`,
      text: text || `${title} on BVS Radio`,
      url,
    });
    if (ok) setOpen(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "min-h-9 rounded-full border border-white/10 px-3 text-xs" : "min-h-10 rounded-full border border-white/15 px-4 text-sm"}
      >
        Share
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div role="dialog" aria-modal="true" aria-label={`Share ${title}`} className="w-full max-w-md rounded-t-[2rem] border border-white/10 bg-[#0b0b0d] p-5 shadow-2xl sm:rounded-[2rem]">
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

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/[.03] px-2 py-3"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-black text-black">IG</span><p className="mt-2 text-xs">Instagram</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[.03] px-2 py-3"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-black text-black">TT</span><p className="mt-2 text-xs">TikTok</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[.03] px-2 py-3"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-base font-black text-black">↗</span><p className="mt-2 text-xs">Stories + more</p></div>
            </div>

            <button type="button" onClick={() => void share()} className="mt-3 min-h-12 w-full rounded-2xl bg-brand px-5 text-sm font-semibold text-black">
              Open social share sheet
            </button>
            <p className="mt-2 text-center text-[11px] leading-5 text-white/35">Choose Instagram Story, TikTok, Messages or any installed app from your phone’s share sheet.</p>
            <button type="button" onClick={() => void copy()} className="mt-3 min-h-11 w-full rounded-2xl border border-white/12 px-5 text-sm font-semibold text-white/70">
              {copied ? "Link copied ✓" : "Copy bvsradio.com link"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
