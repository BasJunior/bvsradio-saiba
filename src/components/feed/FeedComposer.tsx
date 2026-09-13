"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import ParticipationMentionPicker, { type MentionProfile } from "@/components/feed/ParticipationMentionPicker";
import type { AppSurface } from "@/lib/app-surface";
import type { ParticipationIntent, ParticipationObjectKind, ParticipationPost } from "@/lib/participation-server";

type AttachmentOption = {
  kind: ParticipationObjectKind;
  id: string;
  title: string;
  subtitle: string;
  artwork: string | null;
  href: string;
};

type Draft = {
  intent: ParticipationIntent;
  body: string;
  attachment: AttachmentOption | null;
  mentions: MentionProfile[];
  clientKey: string;
};

const intents: Array<{ id: ParticipationIntent; label: string }> = [
  { id: "update", label: "Update" },
  { id: "question", label: "Question" },
  { id: "collaboration", label: "Looking for collaboration" },
];

function newClientKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `bvs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function draftKey(owner: string) {
  return `bvs.participation.draft.v1:${owner}`;
}

function parseDraft(value: string | null): Draft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Draft;
    if (!parsed?.clientKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function FeedComposer({
  surface,
  enabled,
  onCreated,
}: {
  surface: AppSurface;
  enabled: boolean;
  onCreated: (post: ParticipationPost) => void;
}) {
  const session = useAppSession();
  const owner = session.user?.id || "guest";
  const [expanded, setExpanded] = useState(false);
  const [intent, setIntent] = useState<ParticipationIntent>("update");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<AttachmentOption | null>(null);
  const [attachmentQuery, setAttachmentQuery] = useState("");
  const [attachmentResults, setAttachmentResults] = useState<AttachmentOption[]>([]);
  const [mentions, setMentions] = useState<MentionProfile[]>([]);
  const [clientKey, setClientKey] = useState(newClientKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [rulesRequired, setRulesRequired] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [rulesVersion, setRulesVersion] = useState("participation-v1");

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const own = parseDraft(window.localStorage.getItem(draftKey(owner)));
    const guest = owner !== "guest" ? parseDraft(window.localStorage.getItem(draftKey("guest"))) : null;
    const draft = own || guest;
    if (!draft) return;
    setIntent(draft.intent || "update");
    setBody(draft.body || "");
    setAttachment(draft.attachment || null);
    setMentions(draft.mentions || []);
    setClientKey(draft.clientKey || newClientKey());
    if (draft.body || draft.attachment || draft.mentions?.length) setExpanded(true);
    if (!own && guest && owner !== "guest") window.localStorage.setItem(draftKey(owner), JSON.stringify(guest));
  }, [enabled, owner]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const draft: Draft = { intent, body, attachment, mentions, clientKey };
    if (!body && !attachment && !mentions.length) window.localStorage.removeItem(draftKey(owner));
    else window.localStorage.setItem(draftKey(owner), JSON.stringify(draft));
  }, [attachment, body, clientKey, enabled, intent, mentions, owner]);

  useEffect(() => {
    if (!enabled || attachment || attachmentQuery.trim().length < 2) {
      setAttachmentResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/app/participation/attachments?q=${encodeURIComponent(attachmentQuery.trim())}&surface=${surface}`, { signal: controller.signal })
        .then(async (response) => response.ok ? await response.json() as { items?: AttachmentOption[] } : { items: [] })
        .then((payload) => setAttachmentResults(payload.items || []))
        .catch(() => null);
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [attachment, attachmentQuery, enabled, surface]);

  const nearLimit = body.length >= 850;
  const signInHref = useMemo(() => `/app/${surface}/join`, [surface]);

  async function agreeRules() {
    if (!session.token || !rulesAccepted) return false;
    const response = await fetch("/api/app/participation/rules", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agree: true, version: rulesVersion }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("Could not save your community-rules agreement.");
      return false;
    }
    setRulesRequired(false);
    return true;
  }

  async function submit(afterAgreement = false) {
    if (!enabled || submitting) return;
    if (!session.signedIn || !session.token) {
      setExpanded(true);
      setError("Sign in to publish. Your draft is saved on this device.");
      return;
    }
    if (!body.trim()) {
      setError("Write something before posting.");
      return;
    }
    if (rulesRequired && !afterAgreement) {
      if (!await agreeRules()) return;
    }
    setSubmitting(true);
    setError("");
    setStatus("");
    const response = await fetch("/api/app/participation/posts", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent,
        body,
        clientKey,
        surface,
        attachment: attachment ? { kind: attachment.kind, id: attachment.id } : null,
        mentionUserIds: mentions.map((profile) => profile.id),
      }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { post?: ParticipationPost; error?: string; code?: string; rulesVersion?: string } : {};
    if (!response?.ok) {
      if (response?.status === 409 && payload.code === "RULES_REQUIRED") {
        setRulesRequired(true);
        setRulesVersion(payload.rulesVersion || "participation-v1");
        setError("");
      } else setError(payload.error || "Could not publish. Your draft is still saved.");
      setSubmitting(false);
      return;
    }
    if (payload.post) onCreated(payload.post);
    setBody("");
    setAttachment(null);
    setAttachmentQuery("");
    setAttachmentResults([]);
    setMentions([]);
    setIntent("update");
    setClientKey(newClientKey());
    setRulesRequired(false);
    setRulesAccepted(false);
    setExpanded(false);
    window.localStorage.removeItem(draftKey(owner));
    if (owner !== "guest") window.localStorage.removeItem(draftKey("guest"));
    setStatus("Posted to BVS Feed.");
    setSubmitting(false);
  }

  if (!enabled) return null;

  return (
    <section className="rounded-[1.55rem] border border-[#929DE0]/20 bg-[#929DE0]/[.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] sm:p-4" aria-label="Create a BVS Feed post">
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex min-h-12 w-full items-center rounded-2xl border border-white/[.08] bg-black/15 px-4 text-left text-sm text-white/50 transition hover:border-[#929DE0]/35 hover:text-white/72"
        aria-expanded={expanded}
      >
        What are you working on?
      </button>

      {expanded ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2" aria-label="Post intent">
            {intents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIntent(item.id)}
                aria-pressed={intent === item.id}
                className={`min-h-11 rounded-full border px-4 text-xs font-semibold transition ${intent === item.id ? "border-[#929DE0]/55 bg-[#929DE0]/15 text-[#c2c9ff]" : "border-white/10 text-white/48 hover:border-white/20 hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 1000))}
            onCompositionStart={() => undefined}
            rows={4}
            placeholder={intent === "question" ? "What do you want to ask the BVS community?" : intent === "collaboration" ? "What are you looking to make, and who would be useful?" : "Share an update…"}
            className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base leading-6 text-white outline-none placeholder:text-white/28 focus:border-[#929DE0]/55"
          />
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-white/30">Text + one public BVS work attachment</span>
            <span className={nearLimit ? "font-semibold text-[#ff9a92]" : "text-white/30"}>{body.length}/1000</span>
          </div>

          <div className="mt-3 rounded-xl border border-white/[.07] bg-white/[.02] p-2.5">
            {attachment ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#78e6bb]">Attached {attachment.kind}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white/75">{attachment.title}</p>
                  <p className="truncate text-xs text-white/38">{attachment.subtitle}</p>
                </div>
                <button type="button" onClick={() => setAttachment(null)} className="min-h-10 rounded-full border border-white/10 px-3 text-xs text-white/50 hover:text-white">Remove</button>
              </div>
            ) : (
              <>
                <input
                  value={attachmentQuery}
                  onChange={(event) => setAttachmentQuery(event.target.value.slice(0, 80))}
                  placeholder="Attach a public BVS track, beat or release"
                  className="min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-[#78e6bb]/45"
                />
                {attachmentResults.length ? (
                  <div className="mt-1.5 space-y-1">
                    {attachmentResults.map((item) => (
                      <button
                        key={`${item.kind}:${item.id}`}
                        type="button"
                        onClick={() => { setAttachment(item); setAttachmentQuery(""); setAttachmentResults([]); }}
                        className="flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-left hover:bg-white/[.05]"
                      >
                        <span className="min-w-0"><span className="block truncate text-sm font-medium text-white/72">{item.title}</span><span className="block truncate text-xs text-white/35">{item.subtitle}</span></span>
                        <span className="ml-3 shrink-0 text-[10px] uppercase tracking-[.14em] text-[#78e6bb]">{item.kind}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-3"><ParticipationMentionPicker selected={mentions} onChange={setMentions} max={5} /></div>

          {rulesRequired ? (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#929DE0]/25 bg-[#929DE0]/8 p-3 text-sm leading-5 text-white/68">
              <input type="checkbox" checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#D4AF37]" />
              <span>I agree to the current BVS community rules: contribute respectfully, do not spam or harass people, and only share work you are allowed to make public.</span>
            </label>
          ) : null}

          {error ? <p className="mt-3 text-sm text-[#ff9a92]" role="alert">{error}</p> : null}
          {status ? <p className="mt-3 text-sm text-[#78e6bb]" aria-live="polite">{status}</p> : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setExpanded(false)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-white/45 hover:text-white">Collapse</button>
            <div className="flex items-center gap-2">
              {!session.signedIn ? <Link href={signInHref} className="min-h-11 rounded-full border border-white/12 px-4 py-2.5 text-sm font-semibold text-white/72">Sign in</Link> : null}
              <button
                type="button"
                disabled={!body.trim() || submitting || (rulesRequired && !rulesAccepted)}
                onClick={() => void submit()}
                className="min-h-11 rounded-full bg-brand px-5 text-sm font-bold text-black transition hover:brightness-105 disabled:opacity-40"
              >
                {submitting ? "Posting…" : rulesRequired ? "Agree & post" : "Post"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
