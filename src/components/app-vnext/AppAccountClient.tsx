"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

type CreatorRole = "artist" | "producer" | "writer" | "show_creator";
type Profile = {
  username: string;
  display_name?: string;
  avatar_url?: string;
  display_avatar_url?: string;
  bio?: string;
  role?: string;
  is_producer?: boolean;
  is_verified?: boolean;
  creator_public_name?: string;
  creator_name_request?: string;
  creator_name_status?: string;
  creator_name_review_notes?: string;
  producer_public_name?: string;
  producer_name_request?: string;
  producer_name_status?: string;
  producer_name_review_notes?: string;
};
type AccountData = { user: { email: string; fullName?: string }; profile: Profile | null; orders?: Array<{ reference: string; status: string; delivery_status: string }> };
type RoleApplication = { id: string; requested_role: CreatorRole; status: "submitted" | "information_requested" | "approved" | "rejected"; message?: string; review_notes?: string; updated_at?: string };
type FormState = { username: string; fullName: string; displayName: string; bio: string; avatarUrl: string; creatorPublicName: string; producerPublicName: string };

const inputClass = "mt-2 min-h-11 w-full rounded-[1rem] border border-white/[.08] bg-black/20 px-3 py-2 outline-none transition focus:border-brand/35 focus:bg-white/[.025]";
const ROLE_OPTIONS: Array<{ value: CreatorRole; label: string; mode: "primary" | "additive" }> = [
  { value: "artist", label: "Artist", mode: "primary" },
  { value: "producer", label: "Producer", mode: "additive" },
  { value: "writer", label: "Writer", mode: "primary" },
  { value: "show_creator", label: "Show creator", mode: "primary" },
];

function human(value?: string) {
  return String(value || "").replaceAll("_", " ");
}

function roleGranted(profile: Profile | null | undefined, role: CreatorRole) {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  if (role === "producer") return Boolean(profile.is_producer);
  return profile.role === role;
}

function statusClass(status?: string) {
  if (status === "approved") return "border-brand/25 bg-brand/[.08] text-brand";
  if (status === "rejected") return "border-red-400/25 bg-red-500/[.08] text-red-200";
  if (status === "information_requested") return "border-amber-300/25 bg-amber-300/[.07] text-amber-100";
  return "border-white/[.08] bg-white/[.025] text-white/45";
}

export default function AppAccountClient({ surface }: { surface: AppSurface }) {
  const { token, signedIn, loading: sessionLoading, isCreator, access } = useAppSession();
  const [data, setData] = useState<AccountData | null>(null);
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [activeApplication, setActiveApplication] = useState<RoleApplication | null>(null);
  const [form, setForm] = useState<FormState>({ username: "", fullName: "", displayName: "", bio: "", avatarUrl: "", creatorPublicName: "", producerPublicName: "" });
  const [roleForm, setRoleForm] = useState<{ requestedRole: CreatorRole; message: string }>({ requestedRole: "artist", message: "" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showDeletion, setShowDeletion] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionReason, setDeletionReason] = useState("");

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [accountResponse, applicationResponse] = await Promise.all([
        fetch("/api/account", { headers, cache: "no-store" }),
        fetch("/api/account/role-application", { headers, cache: "no-store" }),
      ]);
      const accountPayload = await accountResponse.json().catch(() => ({}));
      if (!accountResponse.ok) throw new Error(accountPayload?.error || "Could not load your account.");
      const applicationPayload = applicationResponse.ok ? await applicationResponse.json().catch(() => ({})) : {};
      const account = accountPayload as AccountData;
      const history = Array.isArray(applicationPayload.applications)
        ? applicationPayload.applications as RoleApplication[]
        : applicationPayload.application ? [applicationPayload.application as RoleApplication] : [];
      const active = (applicationPayload.activeApplication || history.find((row) => ["submitted", "information_requested"].includes(row.status)) || null) as RoleApplication | null;
      setData(account);
      setApplications(history);
      setActiveApplication(active);
      setForm({
        username: account.profile?.username || "",
        fullName: account.user?.fullName || "",
        displayName: account.profile?.display_name || "",
        bio: account.profile?.bio || "",
        avatarUrl: account.profile?.avatar_url || "",
        creatorPublicName: account.profile?.creator_name_request || account.profile?.creator_public_name || "",
        producerPublicName: account.profile?.producer_name_request === "__USE_ARTIST_NAME__" ? "" : (account.profile?.producer_name_request || account.profile?.producer_public_name || ""),
      });
      const nextRole = ROLE_OPTIONS.find((option) => !roleGranted(account.profile, option.value))?.value;
      if (nextRole) setRoleForm((current) => roleGranted(account.profile, current.requestedRole) ? { ...current, requestedRole: nextRole } : current);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your account.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (!sessionLoading) void load(); }, [load, sessionLoading]);
  useEffect(() => () => { if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  const chooseAvatar = (file: File | null) => {
    if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true); setError(""); setMessage("");
    try {
      let avatarUrl = form.avatarUrl;
      if (avatarFile) {
        const preparedResponse = await fetch("/api/account/avatar/prepare", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: avatarFile.name, type: avatarFile.type, size: avatarFile.size }) });
        const prepared = await preparedResponse.json().catch(() => ({}));
        if (!preparedResponse.ok) throw new Error(prepared?.error || "Could not prepare profile picture upload.");
        const uploadResponse = await fetch(prepared.slot.signedUrl, { method: "PUT", headers: { "Content-Type": prepared.slot.contentType || avatarFile.type || "image/jpeg" }, body: avatarFile });
        if (!uploadResponse.ok) throw new Error("Could not upload your profile picture.");
        avatarUrl = prepared.publicUrl;
      }
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...form, avatarUrl }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not update your profile.");
      chooseAvatar(null);
      await load();
      setMessage("Profile updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your profile.");
    } finally { setBusy(false); }
  };

  const applyForRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account/role-application", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(roleForm) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not submit your role application.");
      setRoleForm((current) => ({ ...current, message: "" }));
      await load();
      setMessage("Creator-access request sent for review.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your role application.");
    } finally { setBusy(false); }
  };

  const exportData = async () => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch("/api/account/export", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload?.error || "Could not export your data."); }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `bvs-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(href);
      setMessage("Your export is ready.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not export your data."); }
  };

  const requestDeletion = async () => {
    if (!token) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account/deletion", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ confirmation: deletionConfirmation, reason: deletionReason }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not request account deletion.");
      setMessage(`${payload.message} Reference: ${payload.reference}`);
      setShowDeletion(false); setDeletionConfirmation(""); setDeletionReason("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not request account deletion."); }
    finally { setBusy(false); }
  };

  if (sessionLoading || loading) return <div className="mx-auto max-w-4xl px-4 pt-8"><div className="h-48 animate-pulse rounded-[2rem] bg-white/[.035]" /></div>;

  if (!signedIn || !token) return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-10 text-center sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Account</p>
      <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold sm:text-6xl">Your identity lives here.</h1>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/42">Sign in to manage your profile, creator access and privacy controls.</p>
      <Link href={`/auth/login?next=${encodeURIComponent(`/app/${surface}/account`)}`} className="mt-7 inline-flex min-h-11 items-center rounded-full bg-white px-6 font-semibold text-black transition hover:bg-brand">Sign in</Link>
    </div>
  );

  if (!data?.profile) return <div className="mx-auto max-w-3xl px-4 pt-10"><p className="rounded-[1.2rem] border border-red-400/20 bg-red-500/[.08] p-4 text-red-200">{error || "Profile unavailable."}</p></div>;

  const profile = data.profile;
  const photo = avatarPreview || profile.display_avatar_url || profile.avatar_url || "/assets/images/default-avatar.png";
  const availableRoles = ROLE_OPTIONS.filter((option) => !roleGranted(profile, option.value));
  const selectedRole = availableRoles.find((option) => option.value === roleForm.requestedRole) || availableRoles[0] || null;
  const changesPrimaryRole = Boolean(selectedRole && selectedRole.mode === "primary" && profile.role && profile.role !== "listener" && profile.role !== selectedRole.value);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Account</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Identity & access.</h1>
          <p className="mt-4 text-sm text-white/38">{data.user.email}</p>
        </div>
        <Link href={`/app/${surface}/you`} className="rounded-full border border-white/[.08] px-4 py-2 text-sm text-white/42 transition hover:border-white/18 hover:text-white">Back to You</Link>
      </div>

      {error ? <p className="mt-5 rounded-[1.2rem] border border-red-400/20 bg-red-500/[.08] p-4 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="mt-5 rounded-[1.2rem] border border-brand/20 bg-brand/[.06] p-4 text-sm text-brand">{message}</p> : null}

      <form onSubmit={save} className="mt-8 rounded-[1.7rem] border border-white/[.07] bg-white/[.022] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/[.08] bg-white/[.03]"><Image src={photo} alt="Profile" fill unoptimized className="object-cover" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Profile</p>
            <h2 className="mt-2 text-2xl font-semibold">How you show up on BVS.</h2>
            <p className="mt-2 text-sm text-white/38">Public identity and private account details stay clearly separated.</p>
            <label className="mt-4 inline-flex cursor-pointer rounded-full border border-white/[.08] px-4 py-2 text-sm text-white/54 transition hover:border-white/18 hover:text-white">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => chooseAvatar(event.target.files?.[0] || null)} /></label>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-white/54">Username<input value={form.username} readOnly className={`${inputClass} opacity-60`} /></label>
          <label className="text-sm text-white/54">Display name<input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} maxLength={100} required className={inputClass} /></label>
          <label className="text-sm text-white/54">Full/legal name <span className="text-white/28">· private</span><input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} maxLength={160} required className={inputClass} /></label>
          {access?.artist ? <label className="text-sm text-white/54">Artist public name <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] capitalize ${statusClass(profile.creator_name_status)}`}>{human(profile.creator_name_status || "not submitted")}</span><input value={form.creatorPublicName} onChange={(event) => setForm((current) => ({ ...current, creatorPublicName: event.target.value }))} maxLength={120} className={inputClass} />{profile.creator_name_review_notes ? <span className="mt-1 block text-xs text-white/34">Review note: {profile.creator_name_review_notes}</span> : null}</label> : null}
          {access?.producer ? <label className="text-sm text-white/54">Producer public name <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] capitalize ${statusClass(profile.producer_name_status)}`}>{human(profile.producer_name_status || "not submitted")}</span><input value={form.producerPublicName} onChange={(event) => setForm((current) => ({ ...current, producerPublicName: event.target.value }))} maxLength={120} placeholder="Leave blank to use artist identity" className={inputClass} />{profile.producer_name_review_notes ? <span className="mt-1 block text-xs text-white/34">Review note: {profile.producer_name_review_notes}</span> : null}</label> : null}
        </div>

        <label className="mt-4 block text-sm text-white/54">Bio<textarea value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} maxLength={1000} rows={4} className={inputClass} /></label>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-brand disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
          {profile.is_verified ? <span className="rounded-full border border-brand/22 px-3 py-2 text-xs text-brand">Verified</span> : null}
          <span className="rounded-full border border-white/[.07] px-3 py-2 text-xs text-white/36">Primary · {human(profile.role || "listener")}</span>
          {profile.is_producer ? <span className="rounded-full border border-white/[.07] px-3 py-2 text-xs text-white/36">Producer access</span> : null}
        </div>
      </form>

      <section id="creator-role" className="mt-7 rounded-[1.7rem] border border-white/[.07] bg-white/[.022] p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Creator access</p>
        <h2 className="mt-2 text-3xl font-semibold">Choose the tools that fit your work.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Producer access can sit alongside your primary role. Artist, Writer and Show creator are primary roles, so switching between them changes the main creator workspace attached to your account.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-brand/22 bg-brand/[.07] px-3 py-2 text-xs text-brand">{human(profile.role || "listener")}</span>
          {profile.is_producer ? <span className="rounded-full border border-brand/22 bg-brand/[.07] px-3 py-2 text-xs text-brand">producer</span> : null}
        </div>

        {activeApplication ? (
          <div className="mt-5 rounded-[1.25rem] border border-amber-300/18 bg-amber-300/[.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold capitalize">Open request · {human(activeApplication.requested_role)}</p><span className={`rounded-full border px-3 py-1 text-xs capitalize ${statusClass(activeApplication.status)}`}>{human(activeApplication.status)}</span></div>
            {activeApplication.review_notes ? <p className="mt-2 text-sm leading-6 text-white/40">Review note: {activeApplication.review_notes}</p> : <p className="mt-2 text-sm leading-6 text-white/40">This request is being reviewed. You can open another creator-access request once it is complete.</p>}
          </div>
        ) : null}

        {!activeApplication && availableRoles.length ? (
          <form onSubmit={applyForRole} className="mt-5">
            <div className="grid gap-3 sm:grid-cols-[.45fr_1fr]">
              <label className="text-sm text-white/54">Role<select value={selectedRole?.value || ""} onChange={(event) => setRoleForm((current) => ({ ...current, requestedRole: event.target.value as CreatorRole }))} className={inputClass}>{availableRoles.map((option) => <option key={option.value} value={option.value}>{option.label}{option.mode === "additive" ? " · additional access" : profile.role !== "listener" ? " · changes primary role" : ""}</option>)}</select></label>
              <label className="text-sm text-white/54">Tell us about the work you want to do<textarea value={roleForm.message} onChange={(event) => setRoleForm((current) => ({ ...current, message: event.target.value }))} minLength={20} maxLength={2000} rows={3} className={inputClass} /></label>
            </div>
            {changesPrimaryRole ? <p className="mt-3 rounded-[1rem] border border-amber-300/16 bg-amber-300/[.035] p-3 text-xs leading-5 text-amber-100">If approved, your primary role changes from {human(profile.role)} to {human(selectedRole?.value)}. Separate Producer access stays intact.</p> : selectedRole?.value === "producer" ? <p className="mt-3 text-xs text-white/34">Producer is additional access and will not replace your current primary role.</p> : null}
            <button type="submit" disabled={busy || !selectedRole || roleForm.message.trim().length < 20} className="mt-4 min-h-11 rounded-full border border-brand/28 bg-brand/[.07] px-5 text-sm font-semibold text-brand transition hover:bg-brand/[.11] disabled:opacity-40">Send request</button>
          </form>
        ) : null}

        {applications.length ? (
          <div className="mt-7">
            <h3 className="text-sm font-semibold">Request history</h3>
            <div className="mt-3 space-y-2">{applications.map((application) => <div key={application.id} className="rounded-[1rem] border border-white/[.07] bg-black/10 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium capitalize">{human(application.requested_role)}</span><span className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${statusClass(application.status)}`}>{human(application.status)}</span></div>{application.review_notes ? <p className="mt-2 text-xs leading-5 text-white/34">Review note: {application.review_notes}</p> : null}</div>)}</div>
          </div>
        ) : null}
        {isCreator ? <Link href={`/app/${surface}/studio`} className="mt-5 inline-flex text-sm font-semibold text-brand">Open Studio →</Link> : null}
      </section>

      <section className="mt-7 rounded-[1.7rem] border border-white/[.07] bg-white/[.022] p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Privacy & control</p>
        <h2 className="mt-2 text-3xl font-semibold">Your data stays yours to manage.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Export the account data connected to your BVS identity, including Library activity, creator work, Marketplace activity and artist-money records.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => void exportData()} className="min-h-11 rounded-full border border-white/[.08] px-5 text-sm text-white/54 transition hover:border-white/18 hover:text-white">Export my data</button>
          <button type="button" onClick={() => setShowDeletion((value) => !value)} className="min-h-11 rounded-full border border-red-400/24 px-5 text-sm text-red-200">Delete account</button>
        </div>
        {showDeletion ? (
          <div className="mt-5 rounded-[1.25rem] border border-red-400/20 bg-red-500/[.05] p-4">
            <h3 className="font-semibold text-red-100">Request account deletion</h3>
            <p className="mt-2 text-sm leading-6 text-white/40">Type DELETE to confirm. Published creator content or open orders may need to be resolved before removal is completed.</p>
            <input value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} placeholder="DELETE" className={inputClass} />
            <textarea value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)} maxLength={1000} rows={3} placeholder="Optional reason" className={inputClass} />
            <button type="button" disabled={busy || deletionConfirmation.trim().toUpperCase() !== "DELETE"} onClick={() => void requestDeletion()} className="mt-3 min-h-11 rounded-full bg-red-500 px-5 text-sm font-semibold text-white disabled:opacity-40">Submit deletion request</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
