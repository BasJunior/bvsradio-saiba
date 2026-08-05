"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  PRICE_SINGLE_DOWNLOAD,
  catalogueUnitPrice,
  offerLabel as pricingOfferLabel,
  priceBadge,
  rightsSummary as pricingRightsSummary,
} from "@/lib/catalogue-pricing";
import { rankCollections, type CollectionCard } from "@/lib/catalogue-trending";
import { trackEvent } from "@/lib/analytics";
import PublishedArtistsShelf from "@/components/PublishedArtistsShelf";
import PublishedProducersShelf from "@/components/PublishedProducersShelf";
import PublishedAlbumsShelf from "@/components/PublishedAlbumsShelf";
import { producerKeysMatch, resolvePublicHandle } from "@/lib/public-name";
import { curatedCatalogueTracks } from "@/data/catalogue-curated-tracks";

type TrackType = "single" | "beat" | "mix";

interface Track {
  id: number | string;
  title: string;
  artist: string;
  genre: string;
  collection: string;
  duration: string;
  description: string;
  type: TrackType;
  src: string;
  artwork: string;
  bpm?: string;
  price?: number | null;
  externalUrl?: string;
  streamOnly?: boolean;
  /** Full album zip product (not a $2 single) */
  albumPackage?: boolean;
  /** DB-backed producer BeatStore listing */
  producerBeat?: boolean;
  producerUsername?: string;
  packId?: string | null;
}

type ShelfAction =
  | { type: "live-beatstore" }
  | { type: "filter"; query: string; lane?: "music" | "beat" | "all" }
  | { type: "pack"; packId: string }
  | { type: "release"; releaseId: string }
  | { type: "href"; href: string };

type ShelfCard = CollectionCard & {
  id?: string;
  source?: "live" | "pack" | "release" | "curated";
  itemCount?: number;
  action?: ShelfAction;
};

const coverArt = "/music/Bvs-3000x3000%202.png";
const junePackArt = "/images/music-packs/june-pack.jpg";
const mayPackArt = "/images/music-packs/may-pack-1-2.jpg";
const straighteninArt = "/images/albums/straightenin.jpg";
const howlingArt = "/images/albums/howling-in-the-hills-2.jpg";
const wolfBeenBadArt = "/images/albums/wolf-been-bad.jpg";
const previewLimitSeconds = 30;

// Album product cards stay as commerce items; member songs below use the same covers
// so catalogue, station rotation, and player artwork stay aligned (see music-projects.ts).

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

// Curated archive/stream/sample listings live in src/data/catalogue-curated-tracks.ts
// Live approved tracks come from /api/catalogue/listings.

/** Canonical live BeatStore shelf — stats filled from published DB beats. */
const LIVE_BEATSTORE_NAME = "Live BeatStore";
const LEGACY_LIVE_BEATSTORE_NAMES = new Set([
  "Producer Picks",
  LIVE_BEATSTORE_NAME,
  "Producer BeatStore",
]);

/** Offline fallback if /api/catalogue/shelves is unavailable. */
const fallbackCollectionCards: ShelfCard[] = [
  {
    id: "live-beatstore",
    name: LIVE_BEATSTORE_NAME,
    detail: "Published producer beats · live from BeatStore",
    img: "/images/hero-studio.jpg",
    launchedAt: "2026-08-05",
    shelfKind: "live-beatstore",
    source: "live",
    action: { type: "live-beatstore" },
  },
  {
    id: "curated-albums",
    name: "Albums",
    detail: `Full albums + $${PRICE_SINGLE_DOWNLOAD} singles`,
    img: "/images/albums/lord-album.jpg",
    launchedAt: "2026-06-01",
    shelfKind: "music",
    source: "curated",
    action: { type: "filter", query: "Albums", lane: "music" },
  },
  {
    id: "curated-lord",
    name: "LORD Album",
    detail: `$${PRICE_SINGLE_DOWNLOAD}/song · full album $19`,
    img: "/images/albums/lord-album.jpg",
    launchedAt: "2026-06-15",
    shelfKind: "music",
    source: "curated",
    action: { type: "filter", query: "LORD Album", lane: "music" },
  },
  {
    id: "curated-16bit",
    name: "Album 16 Bit",
    detail: `$${PRICE_SINGLE_DOWNLOAD}/song · full album $14`,
    img: "/images/albums/album-16-bit.jpg",
    launchedAt: "2026-06-20",
    shelfKind: "music",
    source: "curated",
    action: { type: "filter", query: "Album 16 Bit", lane: "music" },
  },
  {
    id: "curated-straightenin",
    name: "STRAIGHTENIN",
    detail: "Stream only · no BVS download sale",
    img: straighteninArt,
    launchedAt: "2025-11-01",
    shelfKind: "music",
    source: "curated",
    action: { type: "filter", query: "STRAIGHTENIN", lane: "music" },
  },
  {
    id: "curated-howling",
    name: "HOWLING IN THE HILLS 2",
    detail: "Stream only · no BVS download sale",
    img: howlingArt,
    launchedAt: "2025-12-01",
    shelfKind: "music",
    source: "curated",
    action: { type: "filter", query: "HOWLING IN THE HILLS 2", lane: "music" },
  },
  {
    id: "curated-wolf-been-bad",
    name: "WOLF BEEN BAD",
    detail: "Stream only · no BVS download sale",
    img: wolfBeenBadArt,
    launchedAt: "2026-01-15",
    shelfKind: "music",
    source: "curated",
    action: { type: "filter", query: "WOLF BEEN BAD", lane: "music" },
  },
  {
    id: "curated-wolf-projects",
    name: "Wolf Bridges Projects",
    detail: "Streaming discovery (regulated platforms)",
    img: straighteninArt,
    launchedAt: "2025-11-01",
    shelfKind: "music",
    source: "curated",
    action: { type: "filter", query: "Wolf Bridges Projects", lane: "music" },
  },
  {
    id: "curated-bvs-archive",
    name: "BVS Archive",
    detail: `$${PRICE_SINGLE_DOWNLOAD} singles / archive downloads`,
    img: coverArt,
    launchedAt: "2025-10-01",
    shelfKind: "music",
    source: "curated",
    action: { type: "filter", query: "BVS Archive", lane: "music" },
  },
  {
    id: "curated-june-pack",
    name: "June Pack",
    detail: "Sample pack · site listings (not full live crate)",
    img: junePackArt,
    launchedAt: "2026-06-01",
    shelfKind: "archive-sample",
    source: "curated",
    action: { type: "filter", query: "June Pack", lane: "all" },
  },
  {
    id: "curated-may-pack",
    name: "May Pack",
    detail: "Sample pack · site listings (not full live crate)",
    img: mayPackArt,
    launchedAt: "2026-05-01",
    shelfKind: "archive-sample",
    source: "curated",
    action: { type: "filter", query: "May Pack", lane: "all" },
  },
  {
    id: "curated-march-pack",
    name: "March Pack",
    detail: "Sample pack · site listings (not full live crate)",
    img: "/images/mic-closeup.jpg",
    launchedAt: "2026-03-01",
    shelfKind: "archive-sample",
    source: "curated",
    action: { type: "filter", query: "March Pack", lane: "all" },
  },
];

function trackPrice(track: Track) {
  return catalogueUnitPrice(track);
}

function offerLabel(track: Track) {
  return pricingOfferLabel(track);
}

function rightsSummary(track: Track) {
  return pricingRightsSummary(track);
}

function CataloguePageContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") || "";
  });
  const [genreFilter, setGenreFilter] = useState("All");
  const [producerFilter, setProducerFilter] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("producer") || "";
  });
  const [collectionJump, setCollectionJump] = useState("");
  const [packFilter, setPackFilter] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("pack") || "";
  });
  const [shelfMode, setShelfMode] = useState<"featured" | "trending" | "new">(
    "featured",
  );
  const [shelvesExpanded, setShelvesExpanded] = useState(true);
  const [remoteShelves, setRemoteShelves] = useState<ShelfCard[] | null>(null);
  const [trendingScores, setTrendingScores] = useState<
    Record<string, { score: number; plays: number }>
  >({});
  /** Music nav defaults to non-beats; Beats nav forces type=beat. */
  const [typeFilter, setTypeFilter] = useState<
    "music" | "beat" | "all" | TrackType
  >(() => {
    if (typeof window === "undefined") return "music";
    const requestedType = new URLSearchParams(window.location.search).get(
      "type",
    );
    if (requestedType === "beat") return "beat";
    if (requestedType === "single" || requestedType === "mix")
      return requestedType;
    if (requestedType === "all") return "all";
    return "music";
  });
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewElapsed, setPreviewElapsed] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(previewLimitSeconds);
  const [dbBeats, setDbBeats] = useState<Track[]>([]);
  const [dbMusic, setDbMusic] = useState<Track[]>([]);
  const [musicLoaded, setMusicLoaded] = useState(false);
  const [cart, setCart] = useState<Track[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const savedCart = window.localStorage.getItem("bvs_cart");
    if (!savedCart) return [];
    try {
      return JSON.parse(savedCart);
    } catch {
      return [];
    }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const requestedType = searchParams.get("type");
    const requestedProducer = searchParams.get("producer") || "";
    const requestedPack = searchParams.get("pack") || "";
    setSearch(searchParams.get("q") || "");
    setProducerFilter(requestedProducer);
    setPackFilter(requestedPack);
    if (requestedType === "beat" || requestedPack) {
      setTypeFilter("beat");
      // Producer deep-links should land on the filtered crate, not the shelf chrome.
      const anchor = requestedProducer || requestedPack ? "browse" : "beatstore";
      window.requestAnimationFrame(() => {
        document.getElementById(anchor)?.scrollIntoView({ block: "start" });
      });
      return;
    }
    if (requestedType === "single" || requestedType === "mix") {
      setTypeFilter(requestedType);
      return;
    }
    if (requestedType === "all") {
      setTypeFilter("all");
      return;
    }
    setTypeFilter("music");
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem("bvs_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalogue/shelves", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload.shelves) ? payload.shelves : [];
        if (cancelled || !rows.length) return;
        setRemoteShelves(
          rows.map(
            (row: ShelfCard & { name?: string; detail?: string; img?: string }) => ({
              id: row.id,
              name: row.name || "Shelf",
              detail: row.detail || "",
              img: row.img || coverArt,
              launchedAt: row.launchedAt,
              shelfKind: row.shelfKind,
              source: row.source,
              itemCount: row.itemCount,
              action: row.action,
            }),
          ),
        );
      })
      .catch(() => {
        /* shelves API optional — fallback cards remain */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/beats?scope=public", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload.beats) ? payload.beats : [];
        if (cancelled) return;
        setDbBeats(
          rows.map(
            (
              b: {
                id: string;
                title?: string;
                description?: string;
                genre?: string;
                mood?: string;
                bpm?: number | null;
                artworkUrl?: string | null;
                previewUrl?: string | null;
                startingPrice?: number | null;
                producer?: string;
                producer_username?: string;
                packId?: string | null;
              },
              index: number,
            ) => ({
              id: b.id || `db-beat-${index}`,
              title: b.title || "Untitled beat",
              artist: b.producer || "BVS Producer",
              genre: b.genre || "Beat",
              collection: "Live BeatStore",
              duration: b.bpm ? `${b.bpm} BPM` : "Preview",
              description:
                b.description ||
                b.mood ||
                "Producer beat listing on BVS BeatStore.",
              type: "beat" as const,
              src: b.previewUrl || "",
              artwork: b.artworkUrl || coverArt,
              bpm: b.bpm ? String(b.bpm) : undefined,
              price: b.startingPrice ?? 29,
              producerBeat: true,
              producerUsername: b.producer_username || undefined,
              packId: b.packId || null,
            }),
          ),
        );
      })
      .catch(() => {
        /* tables may not be applied yet */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalogue/listings", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload.listings) ? payload.listings : [];
        if (cancelled) return;
        setDbMusic(
          rows.map(
            (
              row: {
                id?: string;
                title?: string;
                artist?: string;
                genre?: string;
                collection?: string;
                duration?: string;
                description?: string;
                type?: TrackType;
                src?: string;
                artwork?: string;
                bpm?: string;
                price?: number | null;
                externalUrl?: string;
                streamOnly?: boolean;
                albumPackage?: boolean;
                releaseId?: string | null;
              },
              index: number,
            ): Track => ({
              id: row.id || `db-music-${index}`,
              title: row.title || "Untitled track",
              artist: row.artist || "BVS artist",
              genre: row.genre || "Music",
              collection: row.collection || "Published on BVS",
              duration: row.duration || "Preview",
              description:
                row.description || "Published BVS catalogue listing.",
              type: row.type === "mix" || row.type === "beat" ? row.type : "single",
              src: row.src || "",
              artwork: row.artwork || coverArt,
              bpm: row.bpm,
              price: row.price,
              externalUrl: row.externalUrl,
              streamOnly: Boolean(row.streamOnly),
              albumPackage: Boolean(row.albumPackage),
            }),
          ),
        );
      })
      .catch(() => {
        /* listings optional */
      })
      .finally(() => {
        if (!cancelled) setMusicLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const releasePreviewAudio = (event: Event) => {
      const owner = (event as CustomEvent<{ owner?: string }>).detail?.owner;
      if (owner !== "station") return;
      audioRef.current?.pause();
      setIsPlaying(false);
    };

    window.addEventListener("bvs:audio-claim", releasePreviewAudio);
    return () =>
      window.removeEventListener("bvs:audio-claim", releasePreviewAudio);
  }, []);

  const listingKey = (track: Track) =>
    `${String(track.title || "").trim().toLowerCase()}::${String(track.artist || "").trim().toLowerCase()}`;

  const allTracks = useMemo(() => {
    // Live beats + live music first; curated fills gaps (archive/stream/sample packs).
    const merged: Track[] = [...dbBeats, ...dbMusic];
    const seen = new Set(merged.map(listingKey));
    for (const track of curatedCatalogueTracks as Track[]) {
      // Prefer live DB beats over curated sample beat rows with same title.
      const key = listingKey(track);
      if (seen.has(key)) continue;
      // If live music loaded and this curated row is a sample beat pack item,
      // still keep sample packs for shelf filters — only skip exact title dupes.
      seen.add(key);
      merged.push(track);
    }
    return merged;
  }, [dbBeats, dbMusic]);

  const isBeatListing = (track: Track) =>
    track.type === "beat" || Boolean(track.producerBeat);

  const isMusicListing = (track: Track) => !isBeatListing(track);

  const liveBeatStats = useMemo(() => {
    const count = dbBeats.length;
    const prices = dbBeats
      .map((beat) => Number(beat.price))
      .filter((n) => Number.isFinite(n) && n > 0);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const producers = new Set(
      dbBeats
        .map((beat) => beat.producerUsername || beat.artist)
        .filter(Boolean),
    );
    const cover =
      dbBeats.find(
        (beat) =>
          beat.artwork &&
          !beat.artwork.includes("Bvs-3000") &&
          !beat.artwork.includes("default"),
      )?.artwork || "/images/hero-studio.jpg";
    return {
      count,
      minPrice,
      producerCount: producers.size,
      cover,
      loading: count === 0,
    };
  }, [dbBeats]);

  const activeCollectionCards = useMemo((): ShelfCard[] => {
    const base = remoteShelves?.length
      ? remoteShelves
      : fallbackCollectionCards;

    return base.map((card) => {
      const isLive =
        card.shelfKind === "live-beatstore" ||
        card.action?.type === "live-beatstore" ||
        LEGACY_LIVE_BEATSTORE_NAMES.has(card.name);
      if (!isLive || card.action?.type === "pack") return card;
      if (!liveBeatStats.count) {
        return {
          ...card,
          detail: remoteShelves ? card.detail : "Loading published BeatStore…",
        };
      }
      const priceBit =
        liveBeatStats.minPrice != null
          ? ` · from $${liveBeatStats.minPrice}`
          : "";
      return {
        ...card,
        detail: `${liveBeatStats.count} live beat${liveBeatStats.count === 1 ? "" : "s"} · ${liveBeatStats.producerCount} producer${liveBeatStats.producerCount === 1 ? "" : "s"}${priceBit}`,
        img: liveBeatStats.cover || card.img,
        itemCount: liveBeatStats.count,
        action: card.action || { type: "live-beatstore" },
      };
    });
  }, [remoteShelves, liveBeatStats]);

  useEffect(() => {
    let cancelled = false;
    const names = Array.from(
      new Set([
        ...activeCollectionCards.map((c) => c.name),
        ...LEGACY_LIVE_BEATSTORE_NAMES,
      ]),
    )
      .map((name) => encodeURIComponent(name))
      .join(",");
    if (!names) return;
    fetch(`/api/catalogue/trending?names=${names}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        if (cancelled || !payload?.scores || typeof payload.scores !== "object")
          return;
        setTrendingScores(
          payload.scores as Record<string, { score: number; plays: number }>,
        );
      })
      .catch(() => {
        /* trending is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [activeCollectionCards]);

  const scopeTracks = useMemo(() => {
    // Beats lane: producer beats + typed beat licences only (never BVS archive songs)
    if (typeFilter === "beat") return allTracks.filter(isBeatListing);
    // Music lane default: songs/streams/archive — exclude beats
    if (
      typeFilter === "music" ||
      typeFilter === "single" ||
      typeFilter === "mix"
    ) {
      return allTracks.filter(isMusicListing);
    }
    return allTracks;
  }, [allTracks, typeFilter]);

  const genres = useMemo(
    () => [
      "All",
      ...Array.from(new Set(scopeTracks.map((track) => track.genre))),
    ],
    [scopeTracks],
  );

  const shelfCards = useMemo(
    () => rankCollections(activeCollectionCards, trendingScores, shelfMode),
    [activeCollectionCards, trendingScores, shelfMode],
  );

  const jumpToCollection = (collectionName: string) => {
    const card =
      activeCollectionCards.find((entry) => entry.name === collectionName) ||
      fallbackCollectionCards.find((entry) => entry.name === collectionName);
    const action = card?.action;

    setGenreFilter("All");
    setProducerFilter("");
    try {
      trackEvent("player_start", {
        collection: collectionName,
        source: "catalogue_shelf",
        shelf_mode: shelfMode,
        shelf_kind: card?.shelfKind || "music",
        shelf_source: card?.source || "curated",
      });
    } catch {
      /* ignore */
    }

    if (action?.type === "release") {
      window.location.href = `/album/${encodeURIComponent(action.releaseId)}`;
      return;
    }
    if (action?.type === "href") {
      window.location.href = action.href;
      return;
    }

    if (
      action?.type === "live-beatstore" ||
      (!action && LEGACY_LIVE_BEATSTORE_NAMES.has(collectionName))
    ) {
      setCollectionJump(LIVE_BEATSTORE_NAME);
      setPackFilter("");
      setSearch("");
      setTypeFilter("beat");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("type", "beat");
        url.searchParams.delete("producer");
        url.searchParams.delete("pack");
        url.searchParams.delete("q");
        window.history.replaceState(
          {},
          "",
          `${url.pathname}?type=beat#browse`,
        );
      }
      window.requestAnimationFrame(() => {
        document
          .getElementById("browse")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    if (action?.type === "pack") {
      setCollectionJump(collectionName);
      setPackFilter(action.packId);
      setSearch("");
      setTypeFilter("beat");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("type", "beat");
        url.searchParams.set("pack", action.packId);
        url.searchParams.delete("producer");
        url.searchParams.delete("q");
        window.history.replaceState(
          {},
          "",
          `${url.pathname}?${url.searchParams.toString()}#browse`,
        );
      }
      window.requestAnimationFrame(() => {
        document
          .getElementById("browse")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    const query =
      action?.type === "filter" ? action.query : collectionName;
    const lane =
      action?.type === "filter"
        ? action.lane || "music"
        : card?.shelfKind === "archive-sample"
          ? "all"
          : "music";

    setCollectionJump(collectionName);
    setPackFilter("");
    setSearch(query);
    setTypeFilter(lane);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (lane === "music") url.searchParams.delete("type");
      else url.searchParams.set("type", lane);
      url.searchParams.delete("producer");
      url.searchParams.delete("pack");
      url.searchParams.set("q", query);
      window.history.replaceState(
        {},
        "",
        `${url.pathname}?${url.searchParams.toString()}#browse`,
      );
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById("browse")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const filteredTracks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return scopeTracks.filter((track) => {
      const matchesSearch =
        !normalizedSearch ||
        [track.title, track.artist, track.collection, track.genre].some(
          (field) => field.toLowerCase().includes(normalizedSearch),
        );

      const matchesGenre = genreFilter === "All" || track.genre === genreFilter;
      const matchesProducer =
        !producerFilter ||
        producerKeysMatch(producerFilter, track.producerUsername, track.artist);
      const matchesPack = !packFilter || track.packId === packFilter;
      // typeFilter music/beat already applied in scopeTracks; single/mix narrow further
      const matchesType =
        typeFilter === "all" ||
        typeFilter === "music" ||
        typeFilter === "beat" ||
        track.type === typeFilter;
      return (
        matchesSearch &&
        matchesGenre &&
        matchesProducer &&
        matchesPack &&
        matchesType
      );
    });
  }, [scopeTracks, genreFilter, producerFilter, packFilter, search, typeFilter]);

  const openExternalStream = (track: Track) => {
    if (!track.externalUrl) return;
    window.open(track.externalUrl, "_blank", "noopener,noreferrer");
  };

  const previewTrack = (track: Track) => {
    // Stream-only without a hostable clip: no fake "open stream" here — caller uses Open stream.
    if (track.streamOnly && !track.src) {
      return;
    }

    if (!track.src) return;

    if (currentTrack?.id === track.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(track.src);
    audioRef.current = audio;
    setCurrentTrack(track);
    setIsPlaying(true);
    setPreviewElapsed(0);
    setPreviewDuration(previewLimitSeconds);
    trackEvent("player_start", {
      track_id: track.id,
      content_type: track.type,
      source: track.producerBeat ? "beatstore_preview" : "catalogue_preview",
    });

    audio.addEventListener("loadedmetadata", () => {
      setPreviewDuration(
        Math.min(audio.duration || previewLimitSeconds, previewLimitSeconds),
      );
    });

    audio.addEventListener("timeupdate", () => {
      const snippetDuration = Math.min(
        audio.duration || previewLimitSeconds,
        previewLimitSeconds,
      );
      const elapsed = Math.min(audio.currentTime, snippetDuration);
      setPreviewElapsed(elapsed);
      setPreviewDuration(snippetDuration);

      if (audio.currentTime >= snippetDuration) {
        audio.pause();
        audio.currentTime = snippetDuration;
        setPreviewElapsed(snippetDuration);
        setIsPlaying(false);
      }
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setPreviewElapsed(
        Math.min(audio.duration || previewLimitSeconds, previewLimitSeconds),
      );
    });

    window.dispatchEvent(
      new CustomEvent("bvs:audio-claim", { detail: { owner: "catalogue" } }),
    );
    audio.play().catch(() => {
      setIsPlaying(false);
      setCurrentTrack(null);
    });
  };

  const stopPreview = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentTrack(null);
    setPreviewElapsed(0);
  };

  const toStationTrack = (track: Track) => ({
    id: String(track.id),
    title: track.title,
    artist: track.artist,
    src: track.src,
    artwork: track.artwork,
    project: track.collection,
    genre: track.genre,
  });

  const queueAction = (
    action: "play" | "play-next" | "add" | "play-all",
    track: Track,
    list?: Track[],
  ) => {
    if (action !== "play-all" && (!track.src || track.streamOnly)) {
      previewTrack(track);
      return;
    }
    stopPreview();
    window.dispatchEvent(
      new CustomEvent("bvs:queue", {
        detail:
          action === "play-all"
            ? {
                action,
                tracks: (list || [])
                  .filter((t) => t.src && !t.streamOnly)
                  .map(toStationTrack),
                from: track.collection || track.artist,
              }
            : {
                action,
                track: toStationTrack(track),
                from: track.collection || track.artist,
              },
      }),
    );
  };

  const addToCart = (track: Track) => {
    if (track.streamOnly || trackPrice(track) === null) {
      return;
    }

    if (cart.some((item) => item.id === track.id)) {
      return;
    }

    setCart([...cart, { ...track, price: trackPrice(track) }]);
  };

  const collectionTracks = selectedTrack
    ? allTracks.filter((track) => {
        if (track.collection !== selectedTrack.collection) return false;
        // Keep same-lane siblings: beats with beats, music with music
        if (isBeatListing(selectedTrack)) return isBeatListing(track);
        return isMusicListing(track);
      })
    : [];

  const beatsMode = typeFilter === "beat";
  const musicCount = allTracks.filter(isMusicListing).length;
  const beatCount = allTracks.filter(isBeatListing).length;
  const producerMode = Boolean(producerFilter && beatsMode);
  const producerLabel =
    resolvePublicHandle(
      filteredTracks.find((track) => track.artist)?.artist || producerFilter,
    ) || producerFilter;
  const producerProfileSlug =
    filteredTracks.find((track) => track.producerUsername)?.producerUsername ||
    resolvePublicHandle(producerFilter) ||
    producerFilter;
  const heroCount = producerMode
    ? filteredTracks.length
    : beatsMode
      ? beatCount
      : musicCount;

  const clearProducerFilter = () => {
    setTypeFilter("beat");
    setSearch("");
    setProducerFilter("");
    setGenreFilter("All");
    const url = new URL(window.location.href);
    url.searchParams.set("type", "beat");
    url.searchParams.delete("producer");
    url.searchParams.delete("q");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}?${url.searchParams.toString()}#beatstore`,
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 pb-28">
      <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-end mb-10">
        <div>
          <p className="text-xs tracking-[3px] text-brand uppercase mb-3">
            {producerMode
              ? "Producer crate"
              : beatsMode
                ? "BVS BeatStore"
                : "BVS Music"}
          </p>
          <h1 className="text-5xl font-semibold mb-4">
            {producerMode
              ? producerLabel
              : beatsMode
                ? "Beats for artists and producers."
                : "Music from the BVS library."}
          </h1>
          <p className="max-w-2xl text-text-secondary text-lg">
            {producerMode
              ? `Only published BeatStore licences from ${producerLabel.startsWith("@") ? producerLabel : `@${producerLabel}`}. Other producers and album shelves are hidden on this view.`
              : beatsMode
                ? "Producer beat licences only — no archive songs mixed in. Preview tagged clips on BVS, then lease when ready."
                : "Songs, archive cuts, and streaming discovery. Beats live under Beats — not mixed into Music."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {producerMode ? (
              <>
                <button
                  type="button"
                  onClick={clearProducerFilter}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black hover:bg-brand-dark"
                >
                  Show all beats
                </button>
                <Link
                  href={`/artist/${encodeURIComponent(producerProfileSlug)}`}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-white/5"
                >
                  Producer profile
                </Link>
                <Link
                  href="/music/producers"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-white/5"
                >
                  All producers
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("music");
                    setSearch("");
                    setProducerFilter("");
                    setGenreFilter("All");
                    if (typeof window !== "undefined") {
                      const url = new URL(window.location.href);
                      url.searchParams.delete("type");
                      url.searchParams.delete("producer");
                      window.history.replaceState(
                        {},
                        "",
                        url.pathname + (url.hash || ""),
                      );
                    }
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${!beatsMode ? "bg-brand text-black" : "border border-white/15 text-text-secondary hover:bg-white/5"}`}
                >
                  Music · {musicCount}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("beat");
                    setSearch("");
                    setProducerFilter("");
                    setGenreFilter("All");
                    if (typeof window !== "undefined") {
                      const url = new URL(window.location.href);
                      url.searchParams.set("type", "beat");
                      url.searchParams.delete("producer");
                      window.history.replaceState(
                        {},
                        "",
                        `${url.pathname}?type=beat#beatstore`,
                      );
                    }
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${beatsMode ? "bg-brand text-black" : "border border-white/15 text-text-secondary hover:bg-white/5"}`}
                >
                  Beats · {beatCount}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-white/10">
          <Image
            src={
              producerMode && filteredTracks[0]?.artwork
                ? filteredTracks[0].artwork
                : beatsMode
                  ? junePackArt
                  : "/images/mic-closeup.jpg"
            }
            alt={
              producerMode
                ? `${producerLabel} BeatStore crate`
                : beatsMode
                  ? "Wolf Bridges June Pack beat artwork"
                  : "BVS music catalogue"
            }
            fill
            unoptimized={
              producerMode &&
              /^https?:\/\//i.test(filteredTracks[0]?.artwork || "")
            }
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-semibold">{heroCount}</div>
              <div className="text-sm text-text-secondary">
                {producerMode
                  ? heroCount === 1
                    ? "beat in this crate"
                    : "beats in this crate"
                  : beatsMode
                    ? "beat listings"
                    : "music titles"}
              </div>
            </div>
            <Link
              href="/radio"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-brand"
            >
              Open Radio
            </Link>
          </div>
        </div>
      </section>

      {beatsMode && !producerMode && (
        <section
          id="beatstore"
          className="mb-10 scroll-mt-24 rounded-3xl border border-white/10 bg-bg-card/45 p-5 sm:p-7"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[3px] text-brand">
                Browse BeatStore
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Browse beats from your favorite producer.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                Live published crates only
                {liveBeatStats.count
                  ? ` · ${liveBeatStats.count} beat${liveBeatStats.count === 1 ? "" : "s"} from ${liveBeatStats.producerCount} producer${liveBeatStats.producerCount === 1 ? "" : "s"}${liveBeatStats.minPrice != null ? ` · from $${liveBeatStats.minPrice}` : ""}`
                  : " · loading…"}
                . Sample pack shelves below are site listings, not this full crate.
              </p>
            </div>
            <button
              type="button"
              onClick={clearProducerFilter}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-dark"
            >
              Show all beats
            </button>
          </div>
          <PublishedProducersShelf
            onBrowse={(producer) => {
              setSearch("");
              const browseKey =
                resolvePublicHandle(producer.name.replace(/^@/, "")) ||
                resolvePublicHandle(producer.username) ||
                producer.username;
              setProducerFilter(browseKey);
              setGenreFilter("All");
              setTypeFilter("beat");
              const url = new URL(window.location.href);
              url.searchParams.set("type", "beat");
              url.searchParams.set("producer", browseKey);
              url.searchParams.delete("q");
              window.history.replaceState(
                {},
                "",
                `${url.pathname}?${url.searchParams.toString()}#browse`,
              );
              window.requestAnimationFrame(() => {
                document
                  .getElementById("browse")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
          />
        </section>
      )}

      {producerMode && (
        <section
          id="beatstore"
          className="mb-6 scroll-mt-24 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 sm:px-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white">
              Viewing{" "}
              <span className="font-semibold">
                {producerLabel.startsWith("@")
                  ? producerLabel
                  : `@${producerLabel}`}
              </span>
              's published BeatStore catalogue only.
            </p>
            <button
              type="button"
              onClick={clearProducerFilter}
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-brand"
            >
              Clear producer filter
            </button>
          </div>
        </section>
      )}

      {!beatsMode && <PublishedArtistsShelf />}
      {!beatsMode && <PublishedAlbumsShelf />}

      {!producerMode && (
        <section className="mb-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              aria-expanded={shelvesExpanded}
              aria-controls="catalogue-shelves-content"
              onClick={() => setShelvesExpanded((expanded) => !expanded)}
              className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/10 bg-black/30 text-brand transition-transform ${shelvesExpanded ? "rotate-180" : ""}`}
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="m5 7.5 5 5 5-5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-[0.2em] text-brand">
                  Catalogue shelves
                </span>
                <span className="mt-1 block text-sm text-text-secondary">
                  {shelvesExpanded
                    ? "Live BeatStore updates from published data. Pack cards are sample listings. Trending ranks by plays."
                    : "Expand to browse featured, trending and new shelves."}
                </span>
              </span>
            </button>
            <span className="text-xs font-medium text-text-secondary">
              {shelvesExpanded ? "Hide shelves" : "Show shelves"}
            </span>
            {shelvesExpanded && (
              <div className="inline-flex rounded-full border border-white/10 bg-black/30 p-1 text-xs font-medium">
                {(
                  [
                    ["featured", "Featured"],
                    ["trending", "Trending"],
                    ["new", "New"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setShelfMode(id)}
                    className={`rounded-full px-3.5 py-1.5 transition ${shelfMode === id ? "bg-brand text-black" : "text-text-secondary hover:text-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {shelvesExpanded && (
            <div
              id="catalogue-shelves-content"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {shelfCards.map((collection) => {
                const isTop =
                  shelfMode === "trending" &&
                  collection.rank === 1 &&
                  (collection.score || 0) > 0;
                const isActive = collectionJump === collection.name;
                return (
                  <button
                    type="button"
                    key={collection.id || collection.name}
                    onClick={() => jumpToCollection(collection.name)}
                    className={`group relative flex items-center gap-3 rounded-xl border bg-bg-card/40 p-3 text-left transition ${
                      isTop || isActive
                        ? "border-brand/70 ring-1 ring-brand/30"
                        : "border-white/10 hover:border-brand/40"
                    }`}
                  >
                    {collection.badge && (
                      <span className="absolute right-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                        {collection.badge}
                      </span>
                    )}
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={collection.img}
                        alt=""
                        fill
                        unoptimized={
                          /^https?:\/\//i.test(collection.img) ||
                          collection.img.startsWith("/api/media/")
                        }
                        className="object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="min-w-0 pr-8">
                      <div className="truncate text-sm font-semibold">
                        {collection.name}
                      </div>
                      <div className="truncate text-xs text-text-secondary">
                        {collection.detail}
                      </div>
                      {collection.shelfKind === "archive-sample" && (
                        <div className="mt-0.5 truncate text-[11px] text-white/45">
                          Sample shelf
                        </div>
                      )}
                      {collection.shelfKind === "live-beatstore" && (
                        <div className="mt-0.5 truncate text-[11px] text-brand/90">
                          Live data
                        </div>
                      )}
                      {shelfMode === "trending" && collection.statLine && (
                        <div className="mt-0.5 truncate text-[11px] text-brand/90">
                          {collection.statLine}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section id="browse" className="scroll-mt-24">
        <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-3 shadow-2xl shadow-black/20 md:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="group relative min-w-0 flex-1">
              <span className="sr-only">Search the BVS catalogue</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary transition group-focus-within:text-brand"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search tracks, artists, genres or packs"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/35 py-3.5 pl-13 pr-12 text-sm outline-none transition placeholder:text-white/35 hover:border-white/20 focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-text-secondary hover:bg-white/10 hover:text-white"
                >
                  Clear
                </button>
              )}
            </label>
            {!producerMode && (
              <select
                value={collectionJump}
                onChange={(event) => {
                  if (event.target.value) jumpToCollection(event.target.value);
                }}
                aria-label="Jump to a catalogue collection"
                className="rounded-xl border border-white/10 bg-black/35 px-4 py-3.5 text-sm outline-none focus:border-brand"
              >
                <option value="">Jump to collection</option>
                {activeCollectionCards.map((collection) => (
                  <option key={collection.id || collection.name} value={collection.name}>
                    {collection.name} — {collection.detail}
                  </option>
                ))}
              </select>
            )}
            <select
              value={genreFilter}
              onChange={(event) => setGenreFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/35 px-4 py-3.5 text-sm outline-none focus:border-brand"
            >
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
            <select
              value={
                typeFilter === "single" || typeFilter === "mix"
                  ? typeFilter
                  : beatsMode
                    ? "beat"
                    : "music"
              }
              onChange={(event) => {
                const value = event.target.value as
                  "music" | "beat" | "single" | "mix";
                setTypeFilter(value);
                if (value !== "beat") setProducerFilter("");
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  if (value === "beat") {
                    url.searchParams.set("type", "beat");
                    if (producerFilter) {
                      url.searchParams.set("producer", producerFilter);
                    } else {
                      url.searchParams.delete("producer");
                    }
                    window.history.replaceState(
                      {},
                      "",
                      `${url.pathname}?${url.searchParams.toString()}#${producerFilter ? "browse" : "beatstore"}`,
                    );
                  } else if (value === "music") {
                    url.searchParams.delete("type");
                    url.searchParams.delete("producer");
                    window.history.replaceState({}, "", url.pathname);
                  } else {
                    url.searchParams.set("type", value);
                    url.searchParams.delete("producer");
                    window.history.replaceState(
                      {},
                      "",
                      `${url.pathname}?${url.searchParams.toString()}`,
                    );
                  }
                }
              }}
              aria-label="Filter by content type"
              className="rounded-xl border border-white/10 bg-black/35 px-4 py-3.5 text-sm outline-none focus:border-brand"
            >
              <option value="music">Music only</option>
              <option value="single">Track downloads</option>
              <option value="mix">Archive & streams</option>
              <option value="beat">Beats only</option>
            </select>
            <Link
              href="/checkout"
              className="rounded-xl bg-brand px-5 py-3.5 text-center text-sm font-semibold text-black shadow-lg shadow-brand/10 hover:bg-brand-light"
            >
              View cart · {cart.length}
            </Link>
          </div>
        </div>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[2px] text-brand">
              {beatsMode ? "Beat licences" : "Music catalogue"}
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              {producerFilter
                ? `Producer catalogue · ${producerLabel.startsWith("@") ? producerLabel : `@${producerLabel}`}`
                : search
                  ? `Results for “${search}”`
                  : beatsMode
                    ? "Browse beats"
                    : "Browse music"}
            </h2>
          </div>
          <span className="flex-shrink-0 text-sm text-text-secondary">
            {filteredTracks.length}{" "}
            {filteredTracks.length === 1 ? "result" : "results"}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredTracks.map((track) => {
          const active = currentTrack?.id === track.id && isPlaying;

          return (
            <article
              key={track.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-bg-card/45 transition hover:border-brand/40"
            >
              <button
                type="button"
                onClick={() => setSelectedTrack(track)}
                className="block w-full text-left"
              >
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={track.artwork}
                    alt={track.title}
                    fill
                    unoptimized={/^https?:\/\//i.test(track.artwork)}
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-[1.5px] text-white">
                    {offerLabel(track)}
                  </span>
                </div>
              </button>

              <div className="p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate text-[15px] font-semibold leading-tight">
                    {track.title}
                  </h2>
                  <span className="flex-shrink-0 rounded bg-brand/10 px-1.5 py-px text-[10px] tracking-widest text-brand">
                    HiFi
                  </span>
                </div>
                <p className="truncate text-sm text-text-secondary">
                  {track.artist}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-secondary">
                  <span className="truncate">{track.genre}</span>
                  <span className="flex-shrink-0">{priceBadge(track)}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {track.streamOnly ? (
                    <>
                      {track.src ? (
                        <button
                          type="button"
                          onClick={() => previewTrack(track)}
                          className="flex-1 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-black hover:bg-brand-dark"
                        >
                          {active ? "Pause preview" : "Preview stream"}
                        </button>
                      ) : null}
                      {track.externalUrl ? (
                        <a
                          href={track.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${track.src ? "" : "flex-1 "}rounded-full border border-[#1DB954]/50 bg-[#1DB954]/15 px-3 py-2 text-center text-xs font-semibold text-[#1DB954] hover:bg-[#1DB954]/25`}
                        >
                          Open stream
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => previewTrack(track)}
                        className="flex-1 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-black hover:bg-brand-dark"
                      >
                        {active ? "Pause" : "Preview"}
                      </button>
                      {track.src && (
                        <>
                          <button
                            type="button"
                            onClick={() => queueAction("play", track)}
                            className="rounded-full border border-brand/40 px-3 py-2 text-xs text-brand hover:bg-brand/10"
                            title="Play in site player"
                          >
                            Play
                          </button>
                          <button
                            type="button"
                            onClick={() => queueAction("play-next", track)}
                            className="rounded-full border border-white/20 px-3 py-2 text-xs hover:bg-white/5"
                            title="Play next"
                          >
                            Next
                          </button>
                        </>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedTrack(track)}
                    className="rounded-full border border-white/20 px-3 py-2 text-xs hover:bg-white/5"
                  >
                    Details
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {filteredTracks.length === 0 && (
          <div className="col-span-full rounded-2xl border border-white/10 bg-bg-card/40 px-6 py-12 text-center text-text-secondary">
            No catalogue matches yet. Clear the search or browse the live radio
            rotation.
          </div>
        )}
      </section>

      {!producerMode && (
        <section className="mt-14 grid gap-6 border-t border-white/10 pt-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <p className="text-xs tracking-[3px] text-brand uppercase mb-3">
              Next on video
            </p>
            <h2 className="text-3xl font-semibold mb-3">
              Studio sessions and live drops.
            </h2>
            <p className="text-text-secondary">
              Music and beats are available to preview and buy here now. Video
              from the BVS studio will join this space as each clip is cleared
              for public release.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                title: "Studio Sessions",
                detail: "Behind-the-scenes when ready",
                img: "/images/hero-studio.jpg",
              },
              {
                title: "Live Drops",
                detail: "Show & stage moments when ready",
                img: "/images/festival-crowd.jpg",
              },
            ].map((item) => (
              <div key={item.title}>
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10">
                  <Image
                    src={item.img}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Soon
                  </span>
                </div>
                <div className="mt-2 text-sm font-medium">{item.title}</div>
                <div className="text-xs text-text-secondary">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/15 bg-black/95">
          {/* Runtime line: fills white as preview plays; full white at end */}
          <div
            className="h-1 w-full bg-white/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.round(previewDuration)}
            aria-valuenow={Math.round(previewElapsed)}
            aria-label="Preview progress"
          >
            <div
              className="h-full bg-white transition-[width] duration-150 ease-linear"
              style={{
                width: `${previewDuration > 0 ? Math.min(100, (previewElapsed / previewDuration) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="px-4 py-3">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                  <Image
                    src={currentTrack.artwork}
                    alt=""
                    fill
                    unoptimized={/^https?:\/\//i.test(currentTrack.artwork)}
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {currentTrack.title}
                  </div>
                  <div className="truncate text-xs text-text-secondary">
                    {currentTrack.artist}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block text-xs text-brand">
                    {isPlaying
                      ? "Previewing"
                      : previewElapsed >= previewDuration
                        ? "Preview complete"
                        : "Paused"}
                  </span>
                  <span
                    className="block tabular-nums text-xs text-text-secondary"
                    aria-label={`${formatTime(previewElapsed)} elapsed of ${formatTime(previewDuration)} preview`}
                  >
                    {formatTime(previewElapsed)} / {formatTime(previewDuration)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopPreview}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs hover:bg-white/5"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTrack && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedTrack(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-bg-primary shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-square">
                <Image
                  src={selectedTrack.artwork}
                  alt={selectedTrack.title}
                  fill
                  unoptimized={/^https?:\/\//i.test(selectedTrack.artwork)}
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSelectedTrack(null)}
                  className="absolute right-4 top-4 h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Close details"
                >
                  x
                </button>
              </div>

              <div className="flex flex-col p-7">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-[2px] text-brand">
                    {selectedTrack.genre}
                  </span>
                  <span className="rounded bg-brand/10 px-2 py-1 text-[10px] tracking-widest text-brand">
                    {selectedTrack.collection}
                  </span>
                </div>
                <h2 className="text-4xl font-semibold mb-2">
                  {selectedTrack.title}
                </h2>
                <p className="text-xl text-text-secondary">
                  {selectedTrack.artist}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {selectedTrack.duration}
                  {selectedTrack.bpm ? ` · ${selectedTrack.bpm}` : ""}
                  {selectedTrack.streamOnly
                    ? " · Streaming"
                    : ` · $${trackPrice(selectedTrack)}`}
                </p>
                <p className="mt-5 text-text-secondary">
                  {selectedTrack.description}
                </p>

                <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[2px] text-brand">
                    {offerLabel(selectedTrack)}
                  </div>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {rightsSummary(selectedTrack)}
                  </p>
                  {selectedTrack.type === "beat" && (
                    <p className="mt-2 text-xs text-text-secondary">
                      Need exclusivity, stems or sync use? Contact BVS for a
                      written quote before checkout.
                    </p>
                  )}
                </div>

                <div className="mt-7">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[2px]">
                    Same collection
                  </h3>
                  <div className="space-y-1">
                    {collectionTracks.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => setSelectedTrack(track)}
                        className={`flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${
                          track.id === selectedTrack.id
                            ? "bg-brand/10 text-brand"
                            : ""
                        }`}
                      >
                        <span className="min-w-0 truncate">{track.title}</span>
                        <span className="ml-4 flex-shrink-0 text-text-secondary">
                          {track.bpm || track.duration}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:flex-wrap">
                  {selectedTrack.streamOnly ? (
                    <>
                      {selectedTrack.src ? (
                        <button
                          type="button"
                          onClick={() => previewTrack(selectedTrack)}
                          className="flex-1 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black hover:bg-brand-dark"
                        >
                          {currentTrack?.id === selectedTrack.id && isPlaying
                            ? "Pause preview stream"
                            : "Preview stream"}
                        </button>
                      ) : (
                        <p className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text-secondary">
                          No on-site clip yet — open the full stream on the
                          platform.
                        </p>
                      )}
                      {selectedTrack.externalUrl && (
                        <a
                          href={selectedTrack.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center rounded-full bg-[#1DB954] px-5 py-3 text-center text-sm font-semibold text-black hover:bg-[#1ed760]"
                        >
                          Open stream
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => previewTrack(selectedTrack)}
                        className="flex-1 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black hover:bg-brand-dark"
                      >
                        {currentTrack?.id === selectedTrack.id && isPlaying
                          ? "Pause preview"
                          : "Preview track"}
                      </button>
                      {selectedTrack.src && (
                        <>
                          <button
                            type="button"
                            onClick={() => queueAction("play", selectedTrack)}
                            className="flex-1 rounded-full border border-brand/40 px-5 py-3 text-sm font-semibold text-brand hover:bg-brand/10"
                          >
                            Play on BVS
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              queueAction("play-next", selectedTrack)
                            }
                            className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/5"
                          >
                            Play next
                          </button>
                          <button
                            type="button"
                            onClick={() => queueAction("add", selectedTrack)}
                            className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/5"
                          >
                            Add to queue
                          </button>
                          {collectionTracks.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                queueAction(
                                  "play-all",
                                  selectedTrack,
                                  collectionTracks,
                                )
                              }
                              className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/5"
                            >
                              Play collection
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => addToCart(selectedTrack)}
                        className="flex-1 rounded-full border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/5"
                      >
                        Add{" "}
                        {selectedTrack.type === "beat"
                          ? "licence"
                          : selectedTrack.albumPackage
                            ? "full album"
                            : "single"}{" "}
                        · ${trackPrice(selectedTrack)}
                      </button>
                      <Link
                        href="/checkout"
                        onClick={() => addToCart(selectedTrack)}
                        className="flex flex-1 items-center justify-center rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-black hover:bg-white/90"
                      >
                        Continue to checkout
                      </Link>
                    </>
                  )}
                </div>

                <Link
                  href="/contact"
                  className="mt-4 text-center text-sm text-brand hover:underline"
                >
                  Ask BVS about rights, exclusive licensing, or audio services
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CataloguePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-7xl px-6 py-16 text-text-secondary">
          Loading catalogue…
        </main>
      }
    >
      <CataloguePageContent />
    </Suspense>
  );
}
