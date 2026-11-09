"use client";

import { useEffect, useRef } from "react";
import { useStationPlayer } from "@/components/StationPlayer";
import { beatPlayAction } from "@/lib/beat-play-control";

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

// Calls, headphones and other apps can stop the audio without telling the player.
const audioIsRunning = () => {
  const element = document.querySelector<HTMLAudioElement>("audio[data-bvs-station-audio]");
  return !element || (!element.paused && !element.ended);
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
  // Press handlers are bound once per button, so they read the player from here.
  const playerRef = useRef(player);
  const beatIndex = useRef<{ byKey: Map<string, PublicBeat>; byTitle: Map<string, PublicBeat> } | null>(null);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") !== "beat") return;

    let disposed = false;
    const beatForCard = (title: string, producer: string) =>
      beatIndex.current?.byKey.get(`${normalize(title)}::${normalize(producer)}`) ||
      beatIndex.current?.byTitle.get(normalize(title));

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
        const beat = beatForCard(title, producer);

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

        const beatBadge = Array.from(card.querySelectorAll<HTMLElement>("span")).find(
          (node) => normalize(node.textContent) === "beat",
        );
        if (beatBadge) {
          Object.assign(beatBadge.style, {
            color: "rgb(192 132 252)",
            background: "rgba(216, 180, 254, 0.08)",
            borderColor: "rgba(216, 180, 254, 0.2)",
          });
        }

        const playButton = Array.from(card.querySelectorAll("button")).find((button) => {
          const label = button.textContent?.trim();
          return label === "Play" || label === "Pause" || label === "▶" || label === "Ⅱ";
        });
        const artwork = card.querySelector<HTMLElement>("div.relative.aspect-square");
        if (playButton instanceof HTMLButtonElement && artwork) {
          playButton.dataset.beatPlayControl = "true";
          const liveNow = playerRef.current;
          const shownText = playButton.textContent?.trim();
          const isPause = beat?.id
            ? beatPlayAction(liveNow.current?.id, liveNow.isPlaying && audioIsRunning(), beat.id) === "pause"
            : shownText === "Pause" || shownText === "Ⅱ";
          const glyph = isPause ? "Ⅱ" : "▶";
          if (playButton.textContent !== glyph) playButton.textContent = glyph;
          const playLabel = isPause ? `Pause ${title}` : `Play ${title}`;
          if (playButton.getAttribute("aria-label") !== playLabel) playButton.setAttribute("aria-label", playLabel);
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

                // React can reuse this element after sorting, so resolve the beat at press time.
                const pressedCard = playButton.closest("article");
                const pressed = beatForCard(
                  pressedCard?.querySelector("h2")?.textContent || "",
                  pressedCard?.querySelector("p")?.textContent || "",
                );
                if (!pressed?.previewUrl) return;

                const live = playerRef.current;
                const action = beatPlayAction(live.current?.id, live.isPlaying && audioIsRunning(), pressed.id);
                if (action === "pause") {
                  live.pause();
                  return;
                }
                if (action === "resume") {
                  void live.play();
                  return;
                }
                live.playNow(
                  {
                    id: pressed.id,
                    title: pressed.title || title,
                    artist: pressed.producer || producer,
                    src: pressed.previewUrl,
                    artwork: pressed.artworkUrl || undefined,
                    project: "BVS BeatStore",
                    genre: pressed.genre || undefined,
                    kind: "beat",
                  },
                  { from: "BeatStore" },
                );
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
        description.querySelectorAll<HTMLElement>("span,p").forEach((node) => {
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
          color: "rgb(163 230 53)",
          fontWeight: "400",
          background: "rgba(163, 230, 53, 0.08)",
          border: "0",
          borderRadius: "0",
          padding: "0.18rem 0.42rem",
          lineHeight: "1.2",
        });
      });
    };

    // This effect re-runs on every player change; the catalogue only needs loading once.
    const loadBeats = async () => {
      const beats: PublicBeat[] = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const response: Response = await fetch(`/api/beats?scope=public&offset=${offset}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Beat catalogue unavailable");
        const page = (await response.json()) as { beats?: PublicBeat[]; nextOffset?: number | null };
        beats.push(...(Array.isArray(page.beats) ? page.beats : []));
        const next: number | null | undefined = page.nextOffset;
        offset = typeof next === "number" && next > offset ? next : null;
      }
      return beats;
    };

    if (!beatIndex.current) {
      loadBeats()
        .then((beats) => {
          beatIndex.current = {
            byKey: new Map(beats.map((beat) => [`${normalize(beat.title)}::${normalize(beat.producer)}`, beat])),
            byTitle: new Map(beats.map((beat) => [normalize(beat.title), beat])),
          };
          if (!disposed) enhance();
        })
        .catch(() => enhance());
    }

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
    // Media events don't bubble, so listen on capture to catch the player's audio element.
    const mediaEvents = ["play", "pause", "ended"];
    mediaEvents.forEach((name) => document.addEventListener(name, enhance, true));
    enhance();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      mediaEvents.forEach((name) => document.removeEventListener(name, enhance, true));
    };
  }, [player]);

  return null;
}
