"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { readLibrary } from "@/lib/library";
import { trackEvent } from "@/lib/analytics";

type Role = "listener" | "artist" | "producer" | "creator";

type Task = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  complete: boolean;
};

function roleLabel(role: Role) {
  if (role === "artist") return "artist";
  if (role === "producer") return "producer";
  if (role === "creator") return "creator";
  return "listener";
}

export default function ActivationStartClient() {
  const session = useAppSession();
  const [historyCount, setHistoryCount] = useState(0);
  const [followCount, setFollowCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const [hasArtistSubmission, setHasArtistSubmission] = useState(false);
  const [hasBeatSubmission, setHasBeatSubmission] = useState(false);
  const [checkingCreatorState, setCheckingCreatorState] = useState(false);
  const opened = useRef(false);

  const role: Role = useMemo(() => {
    if (session.access?.admin) return "listener";
    if (session.access?.producer) return "producer";
    if (session.access?.artist) return "artist";
    if (session.isCreator) return "creator";
    return "listener";
  }, [session.access, session.isCreator]);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    setHistoryCount(readLibrary("history").length);
    setFollowCount(readLibrary("follows").length);
    setSaveCount(readLibrary("favourites").length);

    if (!session.token) return;
    if (role === "artist" || role === "creator") {
      setCheckingCreatorState(true);
      const response = await fetch("/api/creator/workspace", {
        headers: { Authorization: `Bearer ${session.token}` },
        cache: "no-store",
      }).catch(() => null);
      if (response?.ok) {
        const payload = await response.json().catch(() => ({})) as {
          tracks?: unknown[];
          releases?: unknown[];
          articles?: unknown[];
          shows?: unknown[];
          episodes?: unknown[];
        };
        setHasArtistSubmission(
          Boolean(
            payload.tracks?.length ||
            payload.releases?.length ||
            payload.articles?.length ||
            payload.shows?.length ||
            payload.episodes?.length,
          ),
        );
      }
      setCheckingCreatorState(false);
    }
    if (role === "producer") {
      setCheckingCreatorState(true);
      const response = await fetch("/api/beats?scope=mine", {
        headers: { Authorization: `Bearer ${session.token}` },
        cache: "no-store",
      }).catch(() => null);
      if (response?.ok) {
        const payload = await response.json().catch(() => ({})) as { beats?: unknown[] };
        setHasBeatSubmission(Boolean(payload.beats?.length));
      }
      setCheckingCreatorState(false);
    }
  }, [role, session.token]);

  useEffect(() => {
    if (session.loading) return;
    void refresh();
    const onLibraryChange = () => void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("bvs:library-change", onLibraryChange);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("bvs:library-change", onLibraryChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, session.loading]);

  useEffect(() => {
    if (session.loading || !session.user || opened.current) return;
    opened.current = true;
    trackEvent("activation_hub_open", { role });
  }, [role, session.loading, session.user]);

  const tasks = useMemo<Task[]>(() => {
    const socialTasks: Task[] = [
      {
        id: "follow_three",
        title: "Follow 3 creators",
        detail: "Give your Feed people to remember so tomorrow feels different from today.",
        href: "/search?mode=creators",
        cta: followCount >= 3 ? "Done" : "Find creators",
        complete: followCount >= 3,
      },
      {
        id: "save_one",
        title: "Save something you want back",
        detail: "Save a track or beat so your library starts becoming yours.",
        href: "/search?mode=fresh",
        cta: saveCount >= 1 ? "Done" : "Discover something",
        complete: saveCount >= 1,
      },
    ];

    if (role === "artist") {
      return [
        {
          id: "artist_submission",
          title: "Submit your first release",
          detail: "Put one real track or release into the BVS editorial path.",
          href: "/upload",
          cta: hasArtistSubmission ? "Submitted" : "Submit music",
          complete: hasArtistSubmission,
        },
        ...socialTasks,
      ];
    }

    if (role === "producer") {
      return [
        {
          id: "producer_submission",
          title: "Put your first beat in BeatStore",
          detail: "Create a licensable beat listing and send it to editorial review.",
          href: "/creator/studio/manage#beatstore",
          cta: hasBeatSubmission ? "Submitted" : "Add a beat",
          complete: hasBeatSubmission,
        },
        ...socialTasks,
      ];
    }

    if (role === "creator") {
      return [
        {
          id: "creator_work",
          title: "Start your first creator submission",
          detail: "Open Creator Studio and put one piece of real work into the BVS workflow.",
          href: "/creator/studio",
          cta: hasArtistSubmission ? "Started" : "Open Studio",
          complete: hasArtistSubmission,
        },
        ...socialTasks,
      ];
    }

    return [
      {
        id: "first_listen",
        title: "Play your first track",
        detail: "Start with the sound. BVS learns more from what you actually play than from a signup form.",
        href: "/radio",
        cta: historyCount >= 1 ? "Done" : "Start listening",
        complete: historyCount >= 1,
      },
      ...socialTasks,
    ];
  }, [followCount, hasArtistSubmission, hasBeatSubmission, historyCount, role, saveCount]);

  const completed = tasks.filter((task) => task.complete).length;
  const allComplete = completed === tasks.length && tasks.length > 0;

  useEffect(() => {
    if (!session.user || typeof window === "undefined") return;
    for (const task of tasks) {
      if (!task.complete) continue;
      const key = `bvs.activation.task.v1:${session.user.id}:${task.id}`;
      if (window.localStorage.getItem(key) === "1") continue;
      window.localStorage.setItem(key, "1");
      trackEvent("activation_task_complete", { role, task: task.id });
    }
    if (allComplete) {
      const completeKey = `bvs.activation.complete.v1:${session.user.id}`;
      if (window.localStorage.getItem(completeKey) !== "1") {
        window.localStorage.setItem(completeKey, "1");
        trackEvent("activation_completed", { role });
      }
    }
  }, [allComplete, role, session.user, tasks]);

  if (session.loading) {
    return <main className="mx-auto max-w-3xl px-5 py-16"><p className="text-text-secondary">Preparing your BVS start…</p></main>;
  }

  if (!session.signedIn) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Start</p>
        <h1 className="mt-3 text-4xl font-semibold">Sign in to continue your start.</h1>
        <p className="mt-4 text-text-secondary">Your activation progress is tied to your BVS account.</p>
        <Link href="/auth/login?next=%2Fstart" className="mt-7 inline-flex rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[72vh] max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="rounded-[2rem] border border-white/10 bg-bg-card/45 p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS Start · {roleLabel(role)}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {allComplete ? "BVS is now yours." : "Make your first session count."}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
          {allComplete
            ? "You have enough signal in BVS for your library, Feed and creator path to start feeling personal."
            : "Three useful actions. No tour, no filler. Finish these and your next visit should already feel more relevant."}
        </p>

        <div className="mt-7">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>{completed} of {tasks.length} complete</span>
            <span>{Math.round((completed / Math.max(1, tasks.length)) * 100)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(completed / Math.max(1, tasks.length)) * 100}%` }} />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {tasks.map((task, index) => (
            <article key={task.id} className={`rounded-2xl border p-4 sm:p-5 ${task.complete ? "border-brand/35 bg-brand/[.06]" : "border-white/10 bg-black/10"}`}>
              <div className="flex items-start gap-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${task.complete ? "border-brand bg-brand text-black" : "border-white/15 text-text-secondary"}`}>
                  {task.complete ? "✓" : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{task.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{task.detail}</p>
                  <Link
                    href={task.href}
                    onClick={() => trackEvent("activation_task_open", { role, task: task.id })}
                    className={`mt-4 inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${task.complete ? "border border-white/15 text-text-secondary" : "bg-brand text-black"}`}
                  >
                    {task.cta}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {checkingCreatorState ? <p className="mt-4 text-xs text-text-secondary">Checking your latest creator activity…</p> : null}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <Link href="/feed" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">{allComplete ? "Open my Feed" : "Continue to Feed"}</Link>
          <Link href={role === "listener" ? "/radio" : "/creator/studio"} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">
            {role === "listener" ? "Listen now" : "Creator Studio"}
          </Link>
        </div>
      </section>
    </main>
  );
}
