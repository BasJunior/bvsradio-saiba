"use client";

import { useEffect, useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

export type MentionProfile = { id: string; username: string | null; displayName: string; avatarUrl: string | null };

export default function ParticipationMentionPicker({
  selected,
  onChange,
  max = 5,
}: {
  selected: MentionProfile[];
  onChange: (profiles: MentionProfile[]) => void;
  max?: number;
}) {
  const session = useAppSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MentionProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session.token || query.trim().length < 2 || selected.length >= max) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/app/participation/mentions?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${session.token}` },
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => response.ok ? await response.json() as { profiles?: MentionProfile[] } : { profiles: [] })
        .then((payload) => setResults((payload.profiles || []).filter((profile) => !selected.some((item) => item.id === profile.id))))
        .catch(() => null)
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [max, query, selected, session.token]);

  if (!session.signedIn) return null;

  return (
    <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-2.5">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => onChange(selected.filter((item) => item.id !== profile.id))}
            className="min-h-8 rounded-full border border-[#929DE0]/35 bg-[#929DE0]/10 px-2.5 text-xs font-semibold text-[#bcc4ff]"
            aria-label={`Remove mention ${profile.displayName}`}
          >
            @{profile.username || profile.displayName} ×
          </button>
        ))}
      </div>
      {selected.length < max ? (
        <div className={selected.length ? "mt-2" : ""}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 40))}
            placeholder="Mention a BVS profile"
            className="min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-[#929DE0]/55"
          />
          {loading ? <p className="mt-1.5 text-xs text-white/35">Finding profiles…</p> : null}
          {results.length ? (
            <div className="mt-1.5 space-y-1">
              {results.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    onChange([...selected, profile].slice(0, max));
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex min-h-10 w-full items-center justify-between rounded-lg px-2.5 text-left text-sm text-white/70 hover:bg-white/[.05] hover:text-white"
                >
                  <span className="truncate">{profile.displayName}</span>
                  <span className="ml-3 shrink-0 text-xs text-white/35">{profile.username ? `@${profile.username}` : "BVS"}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : <p className="mt-2 text-xs text-white/35">Maximum {max} mentions.</p>}
    </div>
  );
}
