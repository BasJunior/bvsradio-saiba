"use client";

import { useEffect } from "react";
import { useStationPlayer } from "@/components/StationPlayer";

type BeatLicence = {
  licence_code?: string | null;
  price_usd?: number | string | null;
  is_active?: boolean | null;
  is_sold_out?: boolean | null;
};

type PublicBeat = {
  id?: string;
  title?: string;
  producer?: string;
  genre?: string | null;
  bpm?: number | string | null;
  artworkUrl?: string | null;
  previewUrl?: string | null;
  startingPrice?: number | string | null;
  licences?: BeatLicence[];
};

const normalize = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const producerPrice = (beat?: PublicBeat) => {
  if (!beat) return null;
  const licences = Array.isArray(beat.licences) ? beat.licences : [];
  const active = licences.filter(
    (licence) => licence.is_active !== false && licence.is_sold_out !== true,
  );
  const standard = active.find((licence) => licence.licence_code === "standard_lease");
  const selected = standard || active.find((licence) => {
    const value = Number(licence.price_usd);
    return Number.isFinite(value) && value > 0;
  });
  const selectedValue = Number(selected?.price_usd);
  if (Number.isFinite(selectedValue) && selectedValue > 0) return selectedValue;

  const fallback = Number(beat.startingPrice);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
};

export default function BeatStoreCardLayout() {
  const player = useStationPlayer();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") !== "beat") return;

    let disposed = false;
    let beatsByKey = new Map<string, PublicBeat>();
    let beatsByTitle = new Map<string, PublicBeat>();

    const enhance = () => {
      if (disposed) return;
      const directory = document.querySelector<HTMLElement>(
        'section[data-beat-directory="true"]',
      );
      if (!directory) return;

      directory.querySelectorAll<HTMLElement>("article").forEach((card) => {
        const title = card.querySelector("h2")?.textContent || "";
        const paragraphs = Array.from(card.querySelectorAll("p"));
        const producer = paragraphs[0]?.textContent || "";
        const beat =
          beatsByKey.get(`${normalize(title)}::${normalize(producer)}`) ||
          beatsByTitle.get(normalize(title));

        const beatId = beat?.id;
        card.style.position = "relative";
        card.style.cursor = beatId ? "pointer" : "default";

        if (beatId && card.dataset.beatDetailNavigation !== "true") {
          card.dataset.beatDetailNavigation = "true";
          card.setAttribute("role", "link");
          card.tabIndex = 0;

          card.addEventListener(
            "click",
            (event) => {
              const target = event.target as HTMLElement;
              if (target.closest('[data-beat-play-control="true"]')) return;
              event.preventDefault();
              event.stopPropagation();
              window.location.assign(`/beat/${beatId}`);
            },
            true,
          );

          card.addEventListener("keydown", (event) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-beat-play-control="true"]')) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            window.location.assign(`/beat/${beatId}`);
          });
        }

        const detailsButton = Array.from(card.querySelectorAll("button")).find(
          (button) => button.textContent?.trim() === "Details",
        );
        if (detailsButton instanceof HTMLButtonElement) {
          detailsButton.style.display = "none";
          detailsButton.setAttribute("aria-hidden", "true");
          detailsButton.tabIndex = -1;
        }

        card.querySelectorAll<HTMLElement>("span,div,p,button").forEach((node) => {
          if (normalize(node.textContent) === "standard lease") node.remove();
        });

        const playButton = Array.from(card.querySelectorAll("button")).find((button) => {
          const label = button.textContent?.trim();
          return label === "Play" || label === "Pause" || label === "▶" || label === "Ⅱ";
        });
        const artwork = card.querySelector<HTMLElement>("div.relative.aspect-square");
        if (playButton instanceof HTMLButtonElement && artwork) {
          playButton.dataset.beatPlayControl = "true";
          const isPause = playButton.textContent?.trim() === "Pause" || playButton.textContent?.trim() === "Ⅱ";
          playButton.textContent = isPause ? "Ⅱ" : "▶";
          playButton.setAttribute(
            "aria-label",
            isPause ? `Pause ${title}` : `Play ${title}`,
          );
          Object.assign(playButton.style, {
            position: "absolute",
            left: "auto",
            right: "0.5rem",
            top: `${Math.max(8, artwork.offsetHeight - 27)}px`,
            width: "0.5cm",
            height: "0.5cm",
            minWidth: "0.5cm",
            minHeight: "0.5cm",
            maxWidth: "0.5cm",
            maxHeight: "0.5cm",
            aspectRatio: "1 / 1",
            padding: "0",
            display: "grid",
            placeItems: "center",
            zIndex: "8",
            borderRadius: "0",
            fontSize: "15px",
            fontWeight: "900",
            lineHeight: "1",
            pointerEvents: "auto",
          });

          if (beat?.previewUrl && playButton.dataset.beatDirectPlay !== "true") {
            playButton.dataset.beatDirectPlay = "true";
            playButton.addEventListener(
              "click",
              (event) => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                const currentlyPaused = playButton.textContent?.trim() === "Ⅱ";
                if (currentlyPaused) {
                  player.pause();
                  playButton.textContent = "▶";
                  playButton.setAttribute("aria-label", `Play ${title}`);
                  return;
                }

                directory
                  .querySelectorAll<HTMLButtonElement>('[data-beat-play-control="true"]')
                  .forEach((button) => {
                    button.textContent = "▶";
                    const buttonTitle = button.closest("article")?.querySelector("h2")?.textContent || "beat";
                    button.setAttribute("aria-label", `Play ${buttonTitle}`);
                  });

                player.playNow(
                  {
                    id: beat.id,
                    title: beat.title || title,
                    artist: beat.producer || producer,
                    src: beat.previewUrl!,
                    artwork: beat.artworkUrl || undefined,
                    project: "BVS BeatStore",
                    genre: beat.genre || undefined,
                    kind: "beat",
                  },
                  { from: "BeatStore" },
                );
                playButton.textContent = "Ⅱ";
                playButton.setAttribute("aria-label", `Pause ${title}`);
              },
              true,
            );
          }

          const actionRow = playButton.parentElement;
          if (actionRow instanceof HTMLElement) {
            actionRow.style.marginTop = "0";
            actionRow.style.height = "0";
            actionRow.style.minHeight = "0";
          }
        }

        const description = card.querySelector<HTMLElement>("div.p-4");
        const metaRow = card.querySelector<HTMLElement>("div.mt-3");
        if (!description || !metaRow) return;

        description.style.display = "flex";
        description.style.flexDirection = "column";
        description.style.minHeight = "0";

        const genreNode = metaRow.firstElementChild as HTMLElement | null;

        Array.from(metaRow.children).forEach((node) => {
          if (node === genreNode) return;
          const text = node.textContent?.trim() || "";
          if (
            /^[-–—]?\s*\d*\s*BPM$/i.test(text) ||
            (node instanceof HTMLElement && node.dataset.beatBpm === "true") ||
            /^from\s+\$?/i.test(text) ||
            /^standard\s+lease$/i.test(text)
          ) {
            node.remove();
          }
        });

        description.querySelectorAll<HTMLElement>('[data-beat-bpm="true"]').forEach((node) => node.remove());
        description.querySelectorAll<HTMLElement>("span,div,p").forEach((node) => {
          if (node === genreNode) return;
          const text = node.textContent?.trim() || "";
          if (/^from\s+\$?/i.test(text) || /^standard\s+lease$/i.test(text)) {
            node.remove();
          }
        });

        const bpmNode = document.createElement("span");
        bpmNode.dataset.beatBpm = "true";
        const rawBpm = beat?.bpm;
        const bpmValue = Number(String(rawBpm ?? "").replace(/\s*BPM$/i, ""));
        const hasBpm = Number.isFinite(bpmValue) && bpmValue > 0;
        bpmNode.textContent = hasBpm ? `${Math.round(bpmValue)} BPM` : "- BPM";

        const exactPrice = producerPrice(beat);

        metaRow.style.display = "block";
        metaRow.style.marginTop = "0.35rem";
        if (genreNode) {
          genreNode.style.display = "block";
          genreNode.style.width = "100%";
          genreNode.style.marginBottom = "0.2rem";
        }

        let footer = description.querySelector<HTMLElement>("[data-beat-card-footer]");
        if (!footer) {
          footer = document.createElement("div");
          footer.dataset.beatCardFooter = "true";
          description.appendChild(footer);
        }
        footer.className = "flex items-center justify-between gap-2 text-xs text-text-secondary";
        Object.assign(footer.style, {
          marginTop: "0.15rem",
          paddingTop: "0",
        });

        let priceNode = footer.querySelector<HTMLElement>('[data-beat-price="true"]');
        if (!priceNode) {
          priceNode = document.createElement("span");
          priceNode.dataset.beatPrice = "true";
        }

        footer.replaceChildren(bpmNode, priceNode);

        Object.assign(bpmNode.style, {
          flexShrink: "0",
          textAlign: "left",
          margin: "0",
        });

        priceNode.textContent = exactPrice !== null ? `From $${exactPrice.toFixed(2)}` : "From —";
        priceNode.className = "text-[10px] uppercase tracking-wider";
        Object.assign(priceNode.style, {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: "auto",
          flexShrink: "0",
          textAlign: "right",
          color: "rgb(192 132 252)",
          fontWeight: "400",
          background: "rgba(216, 180, 254, 0.08)",
          border: "0",
          borderRadius: "0",
          padding: "0.18rem 0.42rem",
          lineHeight: "1.2",
        });
      });
    };

    fetch("/api/beats?scope=public", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: { beats?: PublicBeat[] }) => {
        if (disposed) return;
        const beats = Array.isArray(payload.beats) ? payload.beats : [];
        beatsByKey = new Map(
          beats.map((beat) => [
            `${normalize(beat.title)}::${normalize(beat.producer)}`,
            beat,
          ]),
        );
        beatsByTitle = new Map(
          beats.map((beat) => [normalize(beat.title), beat]),
        );
        enhance();
      })
      .catch(() => enhance());

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        enhance();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const onResize = () => enhance();
    window.addEventListener("resize", onResize);
    enhance();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [player]);

  return null;
}
