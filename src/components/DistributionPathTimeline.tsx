"use client";

import type { PathStep } from "@/lib/distribution-path";

const stateClass: Record<PathStep["state"], string> = {
  done: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  current: "border-brand/50 bg-brand/10 text-brand",
  upcoming: "border-white/10 bg-white/[0.02] text-text-secondary",
  blocked: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  failed: "border-red-400/40 bg-red-500/10 text-red-200",
};

const stateLabel: Record<PathStep["state"], string> = {
  done: "Done",
  current: "Now",
  upcoming: "Next",
  blocked: "Blocked",
  failed: "Needs fix",
};

export default function DistributionPathTimeline({
  steps,
  title = "Your release path",
  subtitle = "Premium upload → BVS Radio → multi-platform after partner approval",
}: {
  steps: PathStep[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-brand">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>
      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`rounded-xl border px-4 py-3 ${stateClass[step.state]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                <span className="mr-2 opacity-70">{index + 1}.</span>
                {step.label}
              </p>
              <span className="text-[11px] uppercase tracking-wide opacity-80">
                {stateLabel[step.state]}
              </span>
            </div>
            <p className="mt-1 text-xs opacity-90">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
