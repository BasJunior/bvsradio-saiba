"use client";

import { useEffect, useMemo, useState } from "react";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import type { BvsObject } from "@/lib/bvs-object";

type GraphNode = {
  id: string;
  kind: "creator" | "track" | "beat";
  route: string;
  title: string;
  artwork?: string;
  metadata?: string[];
};

type GraphEdge = {
  relationship: string;
  verified?: boolean;
  node: GraphNode;
};

type GraphPayload = {
  node?: GraphNode;
  edges?: GraphEdge[];
};

type PublicBeat = {
  id: string;
  title: string;
  producer_user_id: string;
  producer?: string;
  producer_username?: string;
  artworkUrl?: string;
  previewUrl?: string;
  startingPrice?: number;
  genre?: string;
  mood?: string;
  bpm?: number;
  musical_key?: string;
};

function creatorObject(edge: GraphEdge): BvsObject {
  return {
    id: edge.node.id,
    kind: "creator",
    route: edge.node.route,
    title: edge.node.title,
    artwork: edge.node.artwork,
    contextLabel: edge.relationship === "produced_by" ? "Verified producer" : "Verified creator",
    primaryAction: { id: "open", label: "Open", intent: "navigate", href: edge.node.route },
    overflowActions: [{ id: "profile", label: "View creator profile", intent: "navigate", href: edge.node.route }],
    rightsState: "published",
  };
}

function beatObject(beat: PublicBeat): BvsObject {
  const route = `/catalogue?type=beat&q=${encodeURIComponent(beat.title)}#beatstore`;
  const hasPreview = Boolean(beat.previewUrl);
  const metadata = [
    beat.genre,
    beat.mood,
    beat.bpm ? `${beat.bpm} BPM` : undefined,
    beat.musical_key,
  ].filter(Boolean) as string[];
  return {
    id: beat.id,
    kind: "beat",
    route,
    title: beat.title,
    subtitle: beat.producer || "BVS producer",
    artwork: beat.artworkUrl,
    contextLabel: "BVS BeatStore",
    metadata,
    availabilityLabel: Number(beat.startingPrice) > 0 ? `Licences from $${Number(beat.startingPrice).toFixed(2)}` : undefined,
    primaryAction: hasPreview
      ? { id: "preview", label: "Preview", intent: "play", media: { src: beat.previewUrl, artist: beat.producer, project: "BVS BeatStore", artwork: beat.artworkUrl, genre: beat.genre } }
      : { id: "licence", label: "View licence", intent: "navigate", href: route },
    overflowActions: [
      ...(hasPreview ? [
        { id: "next", label: "Preview next", intent: "play-next" as const, media: { src: beat.previewUrl, artist: beat.producer, project: "BVS BeatStore", artwork: beat.artworkUrl, genre: beat.genre } },
      ] : []),
      { id: "licence", label: "View licence options", intent: "navigate", href: route },
      ...(beat.producer_username ? [{ id: "producer", label: "Go to producer", intent: "navigate" as const, href: `/artist/${beat.producer_username}` }] : []),
    ],
    rightsState: "preview",
    media: hasPreview ? { src: beat.previewUrl, artist: beat.producer, project: "BVS BeatStore", artwork: beat.artworkUrl, genre: beat.genre } : undefined,
  };
}

export default function FlowRelationships({ kind, id, compact = false }: { kind: "track" | "creator"; id?: string | null; compact?: boolean }) {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [beats, setBeats] = useState<PublicBeat[]>([]);
  const [producerEdges, setProducerEdges] = useState<GraphEdge[]>([]);

  useEffect(() => {
    if (!id) {
      setGraph(null);
      setBeats([]);
      setProducerEdges([]);
      return;
    }
    let active = true;
    const load = async () => {
      const response = await fetch(`/api/graph/${kind}/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as GraphPayload;
      if (!active) return;
      setGraph(payload);
      if (kind !== "creator") return;

      const beatResponse = await fetch("/api/beats", { cache: "no-store" }).catch(() => null);
      if (beatResponse?.ok) {
        const beatPayload = (await beatResponse.json()) as { beats?: PublicBeat[] };
        if (active) setBeats((beatPayload.beats || []).filter((beat) => beat.producer_user_id === id));
      }

      const trackIds = (payload.edges || []).filter((edge) => edge.verified && edge.node.kind === "track").slice(0, 6).map((edge) => edge.node.id);
      const trackGraphs = await Promise.all(trackIds.map(async (trackId) => {
        const result = await fetch(`/api/graph/track/${encodeURIComponent(trackId)}`, { cache: "no-store" }).catch(() => null);
        return result?.ok ? (await result.json()) as GraphPayload : null;
      }));
      if (!active) return;
      const unique = new Map<string, GraphEdge>();
      for (const result of trackGraphs) {
        for (const edge of result?.edges || []) {
          if (edge.verified && edge.relationship === "produced_by" && edge.node.kind === "creator" && edge.node.id !== id) unique.set(edge.node.id, edge);
        }
      }
      setProducerEdges([...unique.values()]);
    };
    void load();
    return () => { active = false; };
  }, [id, kind]);

  const trackCreators = useMemo(() => (graph?.edges || []).filter((edge) => edge.verified && edge.node.kind === "creator"), [graph]);

  if (!id) return null;
  if (kind === "track") {
    if (!trackCreators.length) return null;
    return (
      <section className="mt-4 border-t border-white/10 pt-4" aria-label="Verified relationships for this track">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Explore this track</p>
        <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2"}>
          {trackCreators.map((edge) => <BvsObjectCard key={`${edge.relationship}-${edge.node.id}`} object={creatorObject(edge)} variant="relationship-card" relationship={edge.relationship} />)}
        </div>
      </section>
    );
  }

  if (!producerEdges.length && !beats.length) return null;
  return (
    <div className="mt-8 space-y-8">
      {producerEdges.length ? (
        <section>
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[.18em] text-brand">Verified relationships</p>
            <h2 className="mt-1 text-2xl font-semibold">Creators behind the sound</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {producerEdges.map((edge) => <BvsObjectCard key={edge.node.id} object={creatorObject(edge)} variant="relationship-card" relationship="produced_by" />)}
          </div>
        </section>
      ) : null}
      {beats.length ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[.18em] text-brand">BVS BeatStore</p>
              <h2 className="mt-1 text-2xl font-semibold">Beats by this creator</h2>
            </div>
            <span className="text-sm text-text-secondary">{beats.length} published</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {beats.slice(0, 8).map((beat) => <BvsObjectCard key={beat.id} object={beatObject(beat)} variant="grid-card" relationship="offered_by" />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
