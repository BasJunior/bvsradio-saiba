import Link from "next/link";
import {
  releaseWorkGroupLabel,
  type CreatorReleaseProgress,
  type ReleaseStageState,
  type ReleaseWorkGroup,
} from "@/lib/creator-release-progress";

const stageClass: Record<ReleaseStageState, string> = {
  complete: "border-brand/25 bg-brand/[.07] text-brand",
  in_progress: "border-sky-300/25 bg-sky-300/[.05] text-sky-100",
  action_required: "border-amber-300/30 bg-amber-300/[.06] text-amber-100",
  not_started: "border-white/10 bg-black/10 text-text-secondary",
  unavailable: "border-white/[.07] bg-black/10 text-text-secondary",
  stopped: "border-white/10 bg-white/[.025] text-text-secondary",
};

const stageLabel: Record<ReleaseStageState, string> = {
  complete: "Complete",
  in_progress: "In progress",
  action_required: "Action required",
  not_started: "Not started",
  unavailable: "Not active",
  stopped: "Stopped",
};

const groupClass: Record<ReleaseWorkGroup, string> = {
  action_required: "border-amber-300/30 bg-amber-300/[.06] text-amber-100",
  in_progress: "border-sky-300/25 bg-sky-300/[.05] text-sky-100",
  history: "border-white/10 bg-white/[.025] text-text-secondary",
};

export function CreatorReleaseProgressDetails({
  progress,
  actionHref,
  actionLabel = "Contact editorial",
}: {
  progress: CreatorReleaseProgress;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${groupClass[progress.group]}`}>
          {releaseWorkGroupLabel(progress.group)}
        </span>
        <span className="text-sm text-text-secondary">{progress.statusLabel}</span>
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Release progress">
        {progress.stages.map((stage) => (
          <li key={stage.id} className={`rounded-xl border p-3 ${stageClass[stage.state]}`}>
            <p className="text-xs font-semibold">{stage.label}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.12em] opacity-80">
              {stageLabel[stage.state]}
            </p>
            <p className="mt-2 text-xs leading-5 opacity-85">{stage.detail}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">
          Next · {progress.nextOwner}
        </p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{progress.nextStep}</p>
        {actionHref && progress.group === "action_required" ? (
          <Link
            href={actionHref}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-amber-200/30 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-200/10"
          >
            {actionLabel} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function CreatorReleaseWorkCounts({
  counts,
}: {
  counts: Record<ReleaseWorkGroup, number>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" aria-label="Release work summary">
      {(["action_required", "in_progress", "history"] as const).map((group) => (
        <div key={group} className={`rounded-xl border p-3 ${groupClass[group]}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[.14em]">{releaseWorkGroupLabel(group)}</p>
          <p className="mt-1 text-2xl font-semibold">{counts[group]}</p>
        </div>
      ))}
    </div>
  );
}
