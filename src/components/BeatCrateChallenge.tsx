"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useBrowserSession } from "@/lib/use-browser-session";
import { validInstagram, type CrateProgress } from "@/lib/beat-crate";

export function CrateProgressCard({
  progress,
  instagram,
  onInstagram,
  onSave,
  busy = false,
}: {
  progress: CrateProgress;
  instagram: string;
  onInstagram: (s: string) => void;
  onSave: () => void;
  busy?: boolean;
}) {
  return (
    <section
      data-studio-accent="beats"
      className="border border-purple-300/30 bg-purple-400/[.06] p-5 sm:p-6"
      aria-label="25 Beat Crate Challenge"
    >
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-purple-200">
        25 Beat Crate Challenge
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold">Build your crate.</h2>
        <span className="text-xl font-semibold text-purple-200">
          {progress.approved}/25 approved
        </span>
      </div>
      <progress
        aria-label="Approved challenge beats"
        value={Math.min(progress.approved, 25)}
        max={25}
        className="mt-4 h-2 w-full accent-purple-300"
      />
      <p className="mt-2 text-sm text-text-secondary">
        {progress.pending} awaiting review · {progress.changes} need attention ·{" "}
        {progress.drafts} drafts
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li>{progress.producer ? "✓" : "○"} Producer profile</li>
        <li>
          {progress.hasPhoto ? (
            "✓ Profile picture added"
          ) : (
            <Link href="/account" className="text-purple-200 underline">
              ○ Add your profile picture
            </Link>
          )}
        </li>
        <li>
          {progress.instagram ? "✓" : "○"} Instagram username{" "}
          {progress.instagram ? `@${progress.instagram}` : "needed"}
        </li>
      </ul>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          Instagram username
          <input
            value={instagram}
            onChange={(e) => onInstagram(e.target.value)}
            placeholder="@yourusername"
            autoComplete="off"
            maxLength={31}
            className="mt-1 block min-h-11 w-full border border-white/20 bg-black/20 px-3 text-base"
          />
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !validInstagram(instagram)}
          className="min-h-11 border border-purple-200/40 px-4 text-sm disabled:opacity-40"
        >
          Save username
        </button>
      </div>
      <p className="mt-4 text-xs leading-5 text-text-secondary">
        25 complete, original beats must pass editorial review. No duplicates,
        spam, placeholders or unfinished beats. Follow @bvsradio and tag fellow
        producers on Instagram. BVS verifies those steps before confirming
        prizes.
      </p>
      <p className="mt-2 text-xs leading-5 text-purple-100">
        {progress.readyForVerification
          ? "Your crate is ready for BVS to verify. This is not a confirmed prize."
          : "Only approved beats count. Uploading 25 does not confirm a win."}{" "}
        All three winners will be announced together on our Instagram Story.
      </p>
    </section>
  );
}
export default function BeatCrateChallenge() {
  const { session } = useBrowserSession();
  return session ? (
    <ChallengeData key={session.user.id} token={session.access_token} />
  ) : null;
}
function ChallengeData({ token }: { token: string }) {
  const [progress, setProgress] = useState<CrateProgress | null>(null);
  const [instagram, setInstagram] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch("/api/beats/crate?summary=1", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setProgress(d.progress);
    setInstagram(d.progress.instagram);
  }, [token]);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() =>
        setMessage(
          "Challenge progress could not load. Open your crate to retry.",
        ),
      );
  }, [load]);
  return (
    <div className="my-6">
      {progress ? (
        <CrateProgressCard
          progress={progress}
          instagram={instagram}
          onInstagram={setInstagram}
          busy={busy}
          onSave={() => {
            setBusy(true);
            void fetch("/api/beats/crate", {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ instagram }),
            })
              .then(async (r) => {
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setMessage("Instagram username saved.");
                await load();
              })
              .catch((e) => setMessage(e.message))
              .finally(() => setBusy(false));
          }}
        />
      ) : (
        <p role="status">{message || "Loading your challenge progress…"}</p>
      )}
      {progress && message ? (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      ) : null}
      <Link
        href="/creator/studio/create/beat?challenge=crate"
        className="mt-3 inline-flex min-h-11 items-center border border-purple-200/40 px-5 text-sm text-purple-200"
      >
        Open my crate →
      </Link>
    </div>
  );
}
