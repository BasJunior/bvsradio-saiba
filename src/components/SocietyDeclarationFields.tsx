"use client";

import Link from "next/link";
import { RIGHTS_GRANT_TEXT, type SocietyStatus } from "@/lib/rights-declarations";

export type SocietyDeclarationValue = { status: SocietyStatus | ""; name: string; grantAccepted: boolean };
export const EMPTY_SOCIETY_DECLARATION: SocietyDeclarationValue = { status: "", name: "", grantAccepted: false };

export function societyDeclarationError(value: SocietyDeclarationValue, { requireGrant = true }: { requireGrant?: boolean } = {}) {
  if (!value.status) return "Tell us whether you or any writer on this music belongs to a collecting society.";
  if (requireGrant && !value.grantAccepted) return "Confirm that you give BVS permission to stream this music.";
  return "";
}

const OPTIONS: Array<[SocietyStatus, string]> = [
  ["none", "No, nobody who wrote this is in a society"],
  ["member", "Yes, one or more writers are in a society"],
  ["unsure", "I'm not sure"],
];

export default function SocietyDeclarationFields({ value, onChange, showGrant = true }: { value: SocietyDeclarationValue; onChange: (next: SocietyDeclarationValue) => void; showGrant?: boolean }) {
  return (
    <fieldset className="space-y-3 rounded-2xl border border-white/10 p-5">
      <legend className="px-1 text-sm font-semibold">Collecting societies *</legend>
      <p className="text-sm text-text-secondary">
        Are you or anyone who wrote this music a member of a society such as ZIMURA, SAMRO or GEMA? You can still post on BVS either way. If the answer is yes or you’re not sure, playing it on BVS may wait until it’s cleared.{" "}
        <Link href="/societies" target="_blank" className="text-brand underline">What’s a society?</Link>
      </p>
      <div className="space-y-2">
        {OPTIONS.map(([status, label]) => (
          <label key={status} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name="society-status" checked={value.status === status} onChange={() => onChange({ ...value, status })} className="accent-brand" />
            {label}
          </label>
        ))}
      </div>
      {value.status === "member" || value.status === "unsure" ? (
        <label className="block text-sm">
          Which society, if you know?
          <input value={value.name} maxLength={120} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="For example ZIMURA" className="mt-1.5 w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand" />
        </label>
      ) : null}
      {showGrant ? (
        <label className="flex gap-3 text-sm">
          <input type="checkbox" aria-required="true" checked={value.grantAccepted} onChange={(event) => onChange({ ...value, grantAccepted: event.target.checked })} className="mt-1 accent-brand" />
          <span>{RIGHTS_GRANT_TEXT}</span>
        </label>
      ) : null}
    </fieldset>
  );
}
