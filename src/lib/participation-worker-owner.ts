export const PARTICIPATION_WORKER_PROJECT_ID = "prj_jdey5oej8CGAROfdPK2f5frnq2YK";

// Deployment identity must come from trusted runtime configuration. A request
// Host header cannot establish queue ownership, and previews must never drain it.
export function isParticipationWorkerOwner(env: Record<string, string | undefined>) {
  return env.VERCEL_ENV === "production"
    && env.VERCEL_PROJECT_ID === PARTICIPATION_WORKER_PROJECT_ID;
}
