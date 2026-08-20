import type { BvsObjectKind } from "@/lib/bvs-object";

export type BvsActivityKind =
  | "release_published"
  | "track_added_to_rotation"
  | "beat_published"
  | "product_published"
  | "service_published"
  | "verified_credit_added"
  | "story_published"
  | "show_scheduled"
  | "show_live"
  | "show_archive_published";

export type BvsActivityReason =
  | "editorial"
  | "following"
  | "recent_relationship"
  | "fresh"
  | "live";

export type BvsActivityObject = {
  id: string;
  kind: BvsObjectKind;
  route: string;
  title: string;
  subtitle?: string;
  artwork?: string;
};

export type BvsActivityItem = {
  id: string;
  kind: BvsActivityKind;
  occurredAt: string;
  creatorId?: string;
  creatorName?: string;
  subject: BvsActivityObject;
  related?: BvsActivityObject;
  label: string;
  reason?: BvsActivityReason;
  priority?: number;
};
