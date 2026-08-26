"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Target = {
  id: string;
  kind: "track" | "release" | "beat" | "beat_pack";
  title: string;
  subtitle: string;
  currentArtwork: string | null;
};

type RequestRow = {
  id: string;
  target_kind: string;
  target_id: string;
  request_type: string;
  status: string;
  message?: string;
  staff_notes?: string | null;
  created_at: string;
};

const field =
  "w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand";

async function putSigned(
  slot: { signedUrl: string; path: string; contentType?: string },
  file: File,
) {
  const contentType =
    file.type ||
    (file.name.match(/\.png$/i)
      ? "image/png"
      : file.name.match(/\.webp$/i)
        ? "image/webp"
        : "image/jpeg");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", slot.signedUrl);
    xhr.setRequestHeader("Content-Type", slot.contentType || contentType);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed for ${file.name}.`));
    xhr.onerror = () => reject(new Error(`Upload failed for ${file.name}.`));
    xhr.send(file);
  });
  return slot.path;
}

export default function ArtworkChangeRequestForm({
  token,
  scope,
  heading = "Request a change",
  copy,
  formId = "cover-change",
}: {
  token: string;
  scope: "releases" | "beats";
  heading?: string;
  copy?: string;
  formId?: string;
}) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState("");
  const [requestType, setRequestType] = useState("artwork_replacement");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [applyToPack, setApplyToPack] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`/api/creator/artwork-changes?scope=${scope}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load your releases.");
    setTargets(payload.targets || []);
    setRequests(payload.requests || []);
  }, [scope, token]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Load failed."));
  }, [load]);

  const current = useMemo(
    () => targets.find((item) => `${item.kind}:${item.id}` === selected) || null,
    [selected, targets],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !current) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      let proposedArtworkPath = "";
      if (requestType === "artwork_replacement") {
        if (!file) throw new Error("Choose the new cover image.");
        if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
          throw new Error("Cover art must be JPG, PNG, or WebP.");
        }
        if (file.size > 8 * 1024 * 1024) {
          throw new Error("Cover art must be 8MB or smaller.");
        }
        const prepRes = await fetch("/api/creator/artwork-changes/prepare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
        });
        const prep = await prepRes.json().catch(() => ({}));
        if (!prepRes.ok || !prep.slot) throw new Error(prep.error || "Could not prepare upload.");
        proposedArtworkPath = await putSigned(prep.slot, file);
      }
      const createRes = await fetch("/api/creator/artwork-changes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetId: current.id,
          targetKind: current.kind,
          requestType,
          message,
          proposedArtworkPath,
          applyToPackMembers: current.kind === "beat_pack" && applyToPack,
        }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(created.error || "Could not send request.");
      setSaved("Request sent. Editorial will review the new picture before it goes live.");
      setMessage("");
      setFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form id={formId} onSubmit={submit} className="rounded-xl border border-white/10 p-4">
      <h2 className="text-xl">{heading}</h2>
      <p className="mt-1 text-sm text-text-secondary">
        {copy ||
          (scope === "beats"
            ? "Select a beat or beat pack, upload a new cover, and BVS editorial will approve it."
            : "Select a track or album, upload a new cover, and BVS editorial will approve it.")}
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {saved && <p className="mt-3 rounded-lg bg-brand/10 p-3 text-sm text-brand">{saved}</p>}
      <select
        required
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className={`${field} mt-4`}
      >
        <option value="">Select release</option>
        {targets.map((item) => (
          <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
            {item.kind === "beat_pack" ? "Pack · " : item.kind === "release" ? "Album · " : ""}
            {item.title}
          </option>
        ))}
      </select>
      {current?.currentArtwork && (
        <img
          src={current.currentArtwork}
          alt=""
          className="mt-3 h-20 w-20 rounded-lg object-cover border border-white/10"
        />
      )}
      <select
        value={requestType}
        onChange={(event) => setRequestType(event.target.value)}
        className={`${field} mt-3`}
      >
        <option value="artwork_replacement">Artwork replacement</option>
        <option value="takedown">Takedown / unpublish</option>
        <option value="metadata_correction">Metadata correction</option>
        <option value="rights_update">Rights update</option>
        <option value="payout_question">Payout question</option>
        <option value="other">Other</option>
      </select>
      {requestType === "artwork_replacement" && (
        <label className="mt-3 block text-sm text-text-secondary">
          New cover image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className={`${field} mt-1`}
          />
        </label>
      )}
      {current?.kind === "beat_pack" && requestType === "artwork_replacement" && (
        <label className="mt-3 flex items-start gap-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={applyToPack}
            onChange={(event) => setApplyToPack(event.target.checked)}
            className="mt-1"
          />
          Also apply this cover to every beat in the pack after approval.
        </label>
      )}
      <textarea
        required
        minLength={8}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="What should the team change or review?"
        className={`${field} mt-3 min-h-28`}
      />
      <button
        disabled={busy || !targets.length}
        className="mt-3 rounded-full bg-brand px-5 py-2 font-semibold text-black disabled:opacity-40"
      >
        {busy ? "Sending…" : "Send request"}
      </button>
      <div className="mt-5 space-y-2">
        {requests.slice(0, 6).map((item) => (
          <p key={item.id} className="rounded-lg border border-white/10 p-3 text-xs text-text-secondary">
            {item.request_type.replaceAll("_", " ")} · {item.status}
            {item.staff_notes ? ` · ${item.staff_notes}` : ""} ·{" "}
            {new Date(item.created_at).toLocaleDateString()}
          </p>
        ))}
      </div>
    </form>
  );
}
