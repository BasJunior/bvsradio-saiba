export type BvsObjectKind =
  | "track"
  | "release"
  | "creator"
  | "beat"
  | "story"
  | "show"
  | "product"
  | "service";

export type BvsActionIntent =
  | "navigate"
  | "play"
  | "play-next"
  | "queue"
  | "save"
  | "share";

export type BvsMediaRef = {
  src?: string;
  artist?: string;
  project?: string;
  genre?: string;
  artwork?: string;
};

export type BvsAction = {
  id: string;
  label: string;
  intent: BvsActionIntent;
  href?: string;
  media?: BvsMediaRef;
};

export type BvsRelationship = {
  kind: BvsObjectKind;
  id: string;
  label: string;
  route: string;
  relationship:
    | "performed_by"
    | "released_on"
    | "produced_by"
    | "written_by"
    | "mixed_by"
    | "mastered_by"
    | "featured_on"
    | "discussed_in"
    | "appeared_on"
    | "offered_by"
    | "related_to"
    | "part_of_pack";
  verified?: boolean;
};

export type BvsObject = {
  id: string;
  kind: BvsObjectKind;
  route: string;
  title: string;
  subtitle?: string;
  artwork?: string;
  contextLabel?: string;
  metadata?: string[];
  primaryAction?: BvsAction;
  overflowActions?: BvsAction[];
  relationships?: BvsRelationship[];
  rightsState?: "published" | "preview" | "licensed" | "unavailable";
  availabilityLabel?: string;
  analyticsContext?: Record<string, string | number | boolean | null | undefined>;
  media?: BvsMediaRef;
};

export type BvsCardVariant =
  | "compact-row"
  | "rail-card"
  | "feature-card"
  | "grid-card"
  | "relationship-card";

export function objectKindLabel(kind: BvsObjectKind) {
  switch (kind) {
    case "creator":
      return "Creator";
    case "beat":
      return "Beat";
    case "story":
      return "Story";
    case "show":
      return "Show";
    case "service":
      return "Service";
    case "product":
      return "Product";
    case "release":
      return "Release";
    default:
      return "Track";
  }
}

export function canSaveObject(object: BvsObject) {
  return object.kind === "track" || object.kind === "release" || object.kind === "creator" || object.kind === "show";
}
