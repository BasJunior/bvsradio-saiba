"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useBrowserSession } from "@/lib/use-browser-session";
import { isAllowedAudioFile } from "@/lib/audio-formats";
import { trackEvent } from "@/lib/analytics";
import {
  crateValidation,
  newCrateItem,
  newCratePayload,
  titleFromFile,
  type CrateDraft,
  type CrateItem,
  type CratePayload,
  type CrateProgress,
} from "@/lib/beat-crate";
import { audioFingerprint, retryCrateFile } from "@/lib/beat-crate-client";
import { CrateProgressCard } from "@/components/BeatCrateChallenge";
import type { SignedUploadSlot } from "@/lib/signed-upload";

type MediaKind = "preview" | "master" | "artwork";
type Files = Record<string, Partial<Record<MediaKind, File>>>;
type SavedDraft = CrateDraft & { received: Record<string, boolean> };
const field =
  "mt-1 min-h-11 w-full border border-white/15 bg-black/20 p-3 text-base outline-none focus:border-purple-300";
const button =
  "min-h-11 border border-white/25 px-4 py-2 text-sm disabled:opacity-40";
const audioAccept = "audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac";
const artAccept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
function artError(file: File) {
  return !/\.(jpe?g|png|webp)$/i.test(file.name) ||
    file.size < 1 ||
    file.size > 8 * 1024 * 1024
    ? "Cover art must be JPG, PNG or WebP, up to 8MB."
    : null;
}

export default function BeatCrateUploadForm({
  onSubmitted,
}: { onSubmitted?: () => void } = {}) {
  const { session, loading } = useBrowserSession();
  if (loading) return <p role="status">Opening your producer account…</p>;
  if (!session)
    return (
      <section className="border border-white/15 p-6">
        <h2 className="text-2xl font-semibold">Your next 25 starts here.</h2>
        <p className="mt-3 text-sm text-text-secondary">
          Create a producer profile, add your picture, then upload your original
          beats. Free producers can publish up to 25 beats.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className={button}
            href="/auth/signup?role=producer&next=%2Fcreator%2Fstudio%2Fcreate%2Fbeat%3Fchallenge%3Dcrate"
          >
            Create producer account
          </Link>
          <Link
            className={button}
            href="/auth/login?next=%2Fcreator%2Fstudio%2Fcreate%2Fbeat%3Fchallenge%3Dcrate"
          >
            Sign in
          </Link>
        </div>
      </section>
    );
  return (
    <CrateEditor
      key={session.user.id}
      owner={session.user.id}
      onSubmitted={onSubmitted}
    />
  );
}
function CrateEditor({
  owner,
  onSubmitted,
}: {
  owner: string;
  onSubmitted?: () => void;
}) {
  const [payload, setPayload] = useState<CratePayload>(() => newCratePayload());
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [files, setFiles] = useState<Files>({});
  const [cover, setCover] = useState<File | null>(null);
  const [progress, setProgress] = useState<CrateProgress | null>(null);
  const [instagram, setInstagram] = useState("");
  const [ready, setReady] = useState(false);
  const [producer, setProducer] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [percent, setPercent] = useState(0);
  const [done, setDone] = useState(0);
  const receivedRef = useRef<Record<string, boolean>>({});
  const [received, setReceived] = useState<Record<string, boolean>>({});
  const revisions = useRef<Record<string, string>>({});
  const controller = useRef<AbortController | null>(null);
  const running = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const backupKey = `bvs.crate-draft.v1:${owner}`;
  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (data.session && data.session.user.id !== owner)
        throw new Error("Account changed. Reopen Studio before continuing.");
      if (!token)
        throw new Error(
          "Your draft is saved. Sign in again, then reopen your crate.",
        );
      const r = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...init?.headers,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok)
        throw Object.assign(
          new Error(
            d.error ||
              "BVS could not finish this step. Retry; your draft is kept.",
          ),
          { result: d.result },
        );
      return d;
    },
    [owner],
  );
  const load = useCallback(async () => {
    const d = await api("/api/beats/crate");
    setDrafts(d.drafts);
    for (const draft of d.drafts as SavedDraft[])
      revisions.current[draft.id] = draft.updated_at;
    setProgress(d.progress);
    setInstagram(d.progress.instagram);
    setProducer(d.producer);
    return d as { drafts: SavedDraft[] };
  }, [api]);
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(load)
      .then(async (d) => {
        if (!active) return;
        let local: { id: string; payload: CratePayload; at: number } | null =
          null;
        try {
          local = JSON.parse(localStorage.getItem(backupKey) || "null");
        } catch {}
        const latest = d.drafts[0];
        const chosen =
          local &&
          (!latest ||
            (local.id === latest.id &&
              local.at > Date.parse(latest.updated_at)))
            ? local
            : latest;
        if (chosen) {
          setDraftId(chosen.id);
          setPayload(chosen.payload);
          setMessage(
            "Unfinished crate restored. Completed uploads are kept; reselect any files marked missing.",
          );
          const verified = await api(`/api/beats/crate?draft=${chosen.id}`);
          if (!active) return;
          if (verified.drafts[0]?.state === "submitted") {
            try {
              localStorage.removeItem(backupKey);
            } catch {}
            setDone(verified.drafts[0].result?.count || 1);
            setMessage(
              "Your previous crate was already received for editorial review. No duplicate was created.",
            );
            setPayload(newCratePayload());
            setDraftId(crypto.randomUUID());
          } else {
            receivedRef.current = verified.drafts[0]?.received || {};
            setReceived({ ...receivedRef.current });
          }
        } else if (
          new URLSearchParams(window.location.search).get("challenge") ===
          "crate"
        )
          setPayload((p) => ({ ...p, challenge: true }));
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [load, backupKey, api]);
  const save = useCallback(
    (p: CratePayload, id = draftId) => {
      const task = queue.current
        .catch(() => {})
        .then(async () => {
          setSaveState("Saving draft…");
          const d = await api("/api/beats/crate", {
            method: "PUT",
            body: JSON.stringify({
              id,
              payload: p,
              updatedAt: revisions.current[id] || null,
            }),
          });
          revisions.current[id] = d.draft.updated_at;
          setSaveState("Draft saved");
          return d.draft as CrateDraft;
        });
      queue.current = task;
      return task;
    },
    [api, draftId],
  );
  useEffect(() => {
    if (!ready || !dirty || busy) return;
    try {
      localStorage.setItem(
        backupKey,
        JSON.stringify({ id: draftId, payload, at: Date.now() }),
      );
    } catch {}
    const timer = setTimeout(() => {
      void save(payload).catch((e) => {
        setSaveState("Draft not saved — retry before leaving");
        setError(e.message);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [payload, dirty, ready, busy, draftId, backupKey, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (busy || (dirty && saveState !== "Draft saved")) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, dirty, saveState]);
  const edit = (patch: Partial<CratePayload>) => {
    setPayload((p) => ({ ...p, ...patch }));
    setDirty(true);
    setSaveState("Unsaved changes");
    setDone(0);
  };
  const itemEdit = (id: string, patch: Partial<CrateItem>) => {
    setPayload((p) => ({
      ...p,
      items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
    setDirty(true);
    setSaveState("Unsaved changes");
  };
  const chooseFile = (id: string, kind: MediaKind, file: File | null) => {
    if (!file) return;
    const invalid =
      kind === "artwork" ? artError(file) : isAllowedAudioFile(file).error;
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setFiles((f) => ({ ...f, [id]: { ...f[id], [kind]: file } }));
    itemEdit(id, {
      [`${kind}Path`]: null,
      [`${kind}Name`]: file.name,
      ...(kind === "preview" ? { audioHash: undefined } : {}),
    });
  };
  const addFiles = (selected: FileList | null) => {
    if (!selected?.length) return;
    const incoming = Array.from(selected);
    const existing = payload.items.filter(
      (i) => i.title || i.previewName || i.previewPath,
    );
    if (existing.length + incoming.length > 25) {
      setError(
        "Add up to 25 beats per crate. Submit this batch, then start another.",
      );
      return;
    }
    for (const file of incoming) {
      const check = isAllowedAudioFile(file);
      if (!check.ok) {
        setError(`${file.name}: ${check.error}`);
        return;
      }
    }
    const newFiles: Files = {};
    const items = incoming.map((file) => {
      const item = {
        ...newCrateItem(),
        title: titleFromFile(file.name),
        previewName: file.name,
        price: payload.items[0]?.price || "29",
      };
      newFiles[item.id] = { preview: file };
      return item;
    });
    setFiles((f) => ({ ...f, ...newFiles }));
    edit({ items: [...existing, ...items] });
    setError("");
  };
  const checkpoint = async (p: CratePayload) => {
    setPayload(structuredClone(p));
    try {
      localStorage.setItem(
        backupKey,
        JSON.stringify({ id: draftId, payload: p, at: Date.now() }),
      );
    } catch {}
    await save(p);
  };
  const run = async (submit: boolean) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setDone(0);
    controller.current = new AbortController();
    let next: CratePayload = structuredClone(payload);
    try {
      // Reject invalid metadata before moving large files; paths are validated after upload.
      const validation = crateValidation(
        {
          ...next,
          items: next.items.map((i) => ({
            ...i,
            previewPath:
              i.previewPath || (files[i.id]?.preview ? "selected" : null),
            artworkPath:
              i.artworkPath || (files[i.id]?.artwork ? "selected" : null),
          })),
          artworkPath: next.artworkPath || (cover ? "selected" : null),
        },
        submit,
      );
      if (validation) throw new Error(validation);
      if (
        submit &&
        next.challenge &&
        (!progress?.hasPhoto || !progress.instagram)
      )
        throw new Error(
          "Add a profile picture and save your Instagram username first. You can save this crate as a draft now.",
        );
      await checkpoint(next);
      const transfer = async (
        id: string,
        kind: MediaKind,
        file: File | null,
        path: string | null,
        store: (path: string) => void,
      ) => {
        if (path && receivedRef.current[path]) return;
        if (!file) {
          if (path)
            throw new Error(
              `Reselect ${kind === "preview" ? "preview audio" : kind} for ${id === "cover" ? "the shared cover" : next.items.find((i) => i.id === id)?.title || "this beat"}. Completed files are kept.`,
            );
          return;
        }
        if (controller.current?.signal.aborted)
          throw new Error("Upload paused. Your completed files are saved.");
        setUploadLabel(`Preparing ${file.name}…`);
        setPercent(0);
        const prep = await api("/api/beats/upload/prepare", {
          method: "POST",
          body: JSON.stringify({
            [kind]: { name: file.name, type: file.type, size: file.size },
          }),
        });
        const slot = prep.slots[kind] as SignedUploadSlot;
        store(slot.path);
        await checkpoint(next); // Keep the path before bytes move, so a lost response is recoverable.
        setUploadLabel(`Uploading ${file.name}`);
        try {
          await retryCrateFile(
            slot,
            file,
            setPercent,
            controller.current?.signal,
          );
        } catch (e) {
          if (
            kind !== "artwork" ||
            controller.current?.signal.aborted ||
            file.size > 3 * 1024 * 1024
          )
            throw e;
          const { data } = await createClient().auth.getSession();
          const form = new FormData();
          form.set("path", slot.path);
          form.set("file", file);
          const r = await fetch("/api/beats/upload/artwork", {
            method: "POST",
            headers: { Authorization: `Bearer ${data.session?.access_token}` },
            body: form,
            signal: controller.current?.signal,
          });
          if (!r.ok) throw e;
        }
        receivedRef.current[slot.path] = true;
        setReceived({ ...receivedRef.current });
        await checkpoint(next);
      };
      await transfer("cover", "artwork", cover, next.artworkPath, (path) => {
        next = { ...next, artworkPath: path };
      });
      for (let index = 0; index < next.items.length; index++) {
        const item = next.items[index];
        setUploadLabel(
          `Beat ${index + 1}/${next.items.length} · ${item.title}`,
        );
        for (const kind of ["preview", "master", "artwork"] as const) {
          const file = files[item.id]?.[kind] || null;
          if (kind === "preview" && file && !item.audioHash) {
            setUploadLabel(`Checking ${file.name}…`);
            item.audioHash = await audioFingerprint(file);
          }
          await transfer(item.id, kind, file, item[`${kind}Path`], (path) => {
            item[`${kind}Path`] = path;
          });
        }
      }
      await checkpoint(next);
      if (submit) {
        if (controller.current?.signal.aborted)
          throw new Error("Upload paused. Your completed files are saved.");
        const invalid = crateValidation(next, true);
        if (invalid) throw new Error(invalid);
        setUploadLabel("Verifying your files and submitting to editorial…");
        const d = await api("/api/beats/crate", {
          method: "POST",
          body: JSON.stringify({ id: draftId }),
        });
        setDirty(false);
        try {
          localStorage.removeItem(backupKey);
        } catch {}
        setDone(d.result.count);
        setMessage(
          `${d.result.count} beat${d.result.count === 1 ? "" : "s"} received for editorial review. They will count toward the challenge once approved.`,
        );
        trackEvent("create_submission_complete", {
          intent: "beat",
          mode: next.items.length > 1 ? "pack" : "single",
        });
        setPayload({...newCratePayload(),challenge:next.challenge});
        setDraftId(crypto.randomUUID());
        setFiles({});
        setCover(null);
        receivedRef.current = {};
        setReceived({});
        setSaveState("");
        onSubmitted?.();
        await load().catch(() => setError("Submission received, but updated progress could not load. Reload Studio to refresh it."));
      } else {
        setDirty(false);
        setMessage(
          "Draft saved. Reopen this crate on any device; completed uploads are kept.",
        );
        await load();
      }
    } catch (e) {
      const receipt = (e as { result?: { count: number } })?.result;
      if (receipt) {
        setDirty(false);
        try {
          localStorage.removeItem(backupKey);
        } catch {}
        setDone(receipt.count);
        setMessage(
          "Your crate was already received for editorial review. No duplicate was created.",
        );
        setPayload({...newCratePayload(),challenge:next.challenge});
        setDraftId(crypto.randomUUID());
        setFiles({});
        setCover(null);
        receivedRef.current = {};
        setSaveState("");
        void load().catch(() => {});
        onSubmitted?.();
        return;
      }
      setError(
        e instanceof Error
          ? e.message
          : "Could not finish. Your draft is kept.",
      );
      setPayload(next);
    } finally {
      running.current = false;
      setBusy(false);
      setUploadLabel("");
      controller.current = null;
    }
  };
  if (!ready)
    return (
      <div>
        <p role="status">{error || "Loading your saved crate…"}</p>
        {error ? (
          <button className={button} onClick={() => window.location.reload()}>
            Retry loading crate
          </button>
        ) : null}
      </div>
    );
  if (!producer)
    return (
      <section className="border border-white/15 p-5">
        <h2 className="text-xl">A producer profile is needed</h2>
        <p className="mt-2 text-sm">
          Choose Producer when creating your BVS account. If your existing
          account needs producer access, apply for Producer access from Account
          Centre so you can keep your current profile.
        </p>
        <Link
          href="/account"
          className={`${button} mt-4 inline-flex items-center`}
        >
          Get producer access
        </Link>
      </section>
    );
  return (
    <div className="space-y-5" data-studio-accent="beats">
      {progress ? (
        <CrateProgressCard
          progress={progress}
          instagram={instagram}
          onInstagram={setInstagram}
          busy={busy}
          onSave={() => {
            void api("/api/beats/crate", {
              method: "PUT",
              body: JSON.stringify({ instagram }),
            })
              .then(() => load())
              .then(() => setMessage("Instagram username saved."))
              .catch((e) => setError(e.message));
          }}
        />
      ) : null}
      {error ? (
        <p
          role="alert"
          className="border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <div
          role="status"
          className="border border-purple-200/30 bg-purple-400/10 p-4 text-sm"
        >
          <p>{message}</p>
          {done > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                className={button}
                onClick={() => {
                  setDone(0);
                  setMessage("");
                  edit({
                    challenge:
                      payload.challenge ||
                      new URLSearchParams(window.location.search).get(
                        "challenge",
                      ) === "crate",
                  });
                }}
              >
                Upload more beats
              </button>
              <Link
                href="/creator/studio/manage#beatstore"
                className={`${button} inline-flex items-center`}
              >
                Track editorial review
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
      {drafts.length > 0 ? (
        <details className="border border-white/15 p-4">
          <summary className="cursor-pointer">
            Saved crates ({drafts.length})
          </summary>
          <div className="mt-3 grid gap-2">
            {drafts.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={busy}
                className={`${button} text-left`}
                onClick={() => {
                  if (dirty && saveState !== "Draft saved") {
                    setError("Save your current crate before opening another.");
                    return;
                  }
                  void api(`/api/beats/crate?draft=${d.id}`)
                    .then((v) => {
                      receivedRef.current = v.drafts[0]?.received || {};
                      setReceived({ ...receivedRef.current });
                      setPayload({ ...d.payload });
                    })
                    .catch((e) => setError(e.message));
                  setDraftId(d.id);
                  setPayload(d.payload);
                  receivedRef.current = d.received || {};
                  setReceived({ ...receivedRef.current });
                  setFiles({});
                  setCover(null);
                  setDirty(false);
                  setMessage("Crate restored. Reselect files marked missing.");
                }}
              >
                {d.payload.title ||
                  d.payload.items[0]?.title ||
                  "Untitled crate"}{" "}
                · {d.payload.items.length} beats · Continue
              </button>
            ))}
          </div>
        </details>
      ) : null}
      <form
        key={draftId}
        onSubmit={(e) => {
          e.preventDefault();
          void run(true);
        }}
        noValidate
        className="space-y-5"
      >
        <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
          <section className="border border-white/15 p-5">
            <h2 className="text-xl font-semibold">
              Your beats · {payload.items.length}/25
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Select one or several tagged previews. Titles come from filenames;
              edit them below. Masters are optional. MP3/M4A/OGG/AAC up to 40MB;
              WAV/FLAC up to 100MB.
            </p>
            <label className="mt-4 block text-sm">
              Add preview files
              <input
                type="file"
                multiple
                accept={audioAccept}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className={field}
              />
            </label>
            <p className="mt-2 text-xs text-text-secondary">
              On mobile, keep this page open while files upload. You can pause
              and return to the saved draft.
            </p>
          </section>
          <section className="border border-white/15 p-5">
            <h3 className="font-semibold">Shared details</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Crate / pack title
                <input
                  value={payload.title}
                  onChange={(e) => edit({ title: e.target.value })}
                  placeholder="Optional for a single beat"
                  maxLength={160}
                  className={field}
                />
              </label>
              <label className="text-sm">
                Genre
                <input
                  value={payload.genre}
                  onChange={(e) => edit({ genre: e.target.value })}
                  maxLength={80}
                  className={field}
                />
              </label>
              <label className="text-sm">
                Default lease price (USD)
                <input
                  type="number"
                  min={1}
                  max={9999}
                  step="0.01"
                  value={payload.items[0]?.price || "29"}
                  onChange={(e) =>
                    edit({
                      items: payload.items.map((i) => ({
                        ...i,
                        price: e.target.value,
                      })),
                    })
                  }
                  className={field}
                />
                <span className="mt-1 block text-xs text-text-secondary">
                  Changing this updates every beat below. Each price remains
                  editable.
                </span>
              </label>
              <label className="text-sm">
                Shared cover art
                <input
                  type="file"
                  accept={artAccept}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const invalid = artError(file);
                    if (invalid) {
                      setError(invalid);
                      return;
                    }
                    setCover(file);
                    edit({ artworkPath: null, artworkName: file.name });
                  }}
                  className={field}
                />
                <span className="mt-1 block text-xs text-text-secondary">
                  {payload.artworkName ||
                    "JPG, PNG or WebP · up to 8MB. You can override each beat’s cover."}
                </span>
              </label>
            </div>
            <label className="mt-3 block text-sm">
              Description
              <textarea
                className={field}
                maxLength={4000}
                value={payload.description}
                onChange={(e) => edit({ description: e.target.value })}
              />
            </label>
          </section>
          <div className="space-y-3">
            {payload.items.map((item, index) => (
              <details
                key={item.id}
                open={payload.items.length === 1 ? true : undefined}
                className="border border-white/15 p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  {index + 1}. {item.title || "Untitled beat"}{" "}
                  <span className="ml-2 font-normal text-text-secondary">
                    {item.previewPath && received[item.previewPath]
                      ? "Audio received"
                      : files[item.id]?.preview
                        ? "Ready to upload"
                        : "Audio missing"}{" "}
                    · US${item.price}
                  </span>
                </summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Beat title *
                    <input
                      className={field}
                      value={item.title}
                      onChange={(e) =>
                        itemEdit(item.id, { title: e.target.value })
                      }
                      maxLength={160}
                    />
                  </label>
                  <label className="text-sm">
                    Standard lease price (USD) *
                    <input
                      className={field}
                      value={item.price}
                      type="number"
                      min={1}
                      max={9999}
                      step="0.01"
                      onChange={(e) =>
                        itemEdit(item.id, { price: e.target.value })
                      }
                    />
                  </label>
                  {(["preview", "master", "artwork"] as const).map((kind) => (
                    <label key={kind} className="text-sm">
                      {kind === "preview"
                        ? "Tagged preview *"
                        : kind === "master"
                          ? "Private master / WAV (optional)"
                          : "Individual cover (optional)"}
                      <input
                        type="file"
                        accept={kind === "artwork" ? artAccept : audioAccept}
                        onChange={(e) =>
                          chooseFile(item.id, kind, e.target.files?.[0] || null)
                        }
                        className={field}
                      />
                      <span className="mt-1 block text-xs text-text-secondary">
                        {item[`${kind}Name`] || ""}
                        {item[`${kind}Path`] && received[item[`${kind}Path`]!]
                          ? " · received"
                          : item[`${kind}Name`] && !files[item.id]?.[kind]
                            ? " · reselect file"
                            : ""}
                      </span>
                    </label>
                  ))}
                  <label className="text-sm">
                    BPM
                    <input
                      className={field}
                      inputMode="numeric"
                      value={item.bpm}
                      onChange={(e) =>
                        itemEdit(item.id, { bpm: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Key
                    <input
                      className={field}
                      value={item.musicalKey}
                      maxLength={20}
                      onChange={(e) =>
                        itemEdit(item.id, { musicalKey: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Mood
                    <input
                      className={field}
                      value={item.mood}
                      maxLength={120}
                      onChange={(e) =>
                        itemEdit(item.id, { mood: e.target.value })
                      }
                    />
                  </label>
                </div>
                {payload.items.length > 1 ? (
                  <button
                    type="button"
                    className={`${button} mt-3 text-red-200`}
                    onClick={() =>
                      edit({
                        items: payload.items.filter((i) => i.id !== item.id),
                      })
                    }
                  >
                    Remove beat {index + 1}
                  </button>
                ) : null}
              </details>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={button}
              disabled={payload.items.length >= 25}
              onClick={() =>
                edit({ items: [...payload.items, newCrateItem()] })
              }
            >
              + Add a beat
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                if (dirty && saveState !== "Draft saved") {
                  setError("Save this crate before starting another.");
                  return;
                }
                setDraftId(crypto.randomUUID());
                setPayload(newCratePayload());
                setFiles({});
                setCover(null);
                receivedRef.current = {};
                setReceived({});
                setDirty(false);
                setMessage("New crate started. Your other drafts are kept.");
              }}
            >
              Start another crate
            </button>
          </div>
          <label className="flex items-start gap-3 border border-purple-300/20 p-4 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={payload.challenge}
              onChange={(e) => edit({ challenge: e.target.checked })}
            />
            <span>
              Include these beats in my 25 Beat Crate Challenge entry.
              <span className="mt-1 block text-xs text-text-secondary">
                Add cover art, a profile picture and your Instagram username.
                All beats must pass editorial review.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 border border-white/15 p-4 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={payload.rights}
              onChange={(e) => edit({ rights: e.target.checked })}
            />
            <span>
              I own or control every beat and can offer Standard leases through
              BVS. These are complete original uploads, with no duplicates, spam
              or placeholders.
            </span>
          </label>
        </fieldset>
        {busy ? (
          <div role="status" aria-live="polite">
            <p className="text-sm text-purple-200">
              {uploadLabel || "Saving your crate…"}
            </p>
            <progress
              aria-label="Current file upload"
              max={100}
              value={percent}
              className="mt-2 w-full accent-purple-300"
            />
            <button
              type="button"
              className={`${button} mt-2`}
              onClick={() => controller.current?.abort()}
            >
              Pause upload
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            className={button}
            onClick={() => void run(false)}
          >
            Save draft & upload files
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 bg-purple-200 px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            {busy
              ? "Working…"
              : `Submit ${payload.items.length} beat${payload.items.length === 1 ? "" : "s"} for review`}
          </button>
        </div>
        <p role="status" className="text-xs text-text-secondary">
          {saveState || "Your details save automatically as you work."}
        </p>
      </form>
    </div>
  );
}
