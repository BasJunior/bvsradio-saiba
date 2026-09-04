import Link from "next/link";
import { notFound } from "next/navigation";
import ContactForm from "@/app/contact/ContactForm";

export default async function AppSupportPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <Link href={`/app/${raw}/you`} className="text-sm text-text-secondary">← You</Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[.2em] text-brand">Support</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Contact BVS without leaving the app.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
        Ask about your account, music submissions, creator services, partnerships or a technical issue. This page stays inside the BVS app.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[.8fr,1.2fr]">
        <aside className="rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5">
          <p className="text-xs uppercase tracking-[.18em] text-brand">Direct channels</p>
          <div className="mt-4 space-y-4">
            {[
              ["General & Partnerships", "hello@bvsradio.com"],
              ["Artist & Music Submissions", "music@bvsradio.com"],
              ["Advertising & Brands", "ads@bvsradio.com"],
              ["Press & Media", "press@bvsradio.com"],
            ].map(([label, email]) => (
              <div key={email} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-xs text-text-secondary">{label}</p>
                <a href={`mailto:${email}`} className="mt-1 block break-all font-semibold text-brand">{email}</a>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/[.05] p-4 text-sm text-text-secondary">
            For music already inside BVS, use Studio for submission and review workflow so the request stays attached to the track.
            <div className="mt-3"><Link href={`/app/${raw}/studio`} className="font-semibold text-brand">Open BVS Studio →</Link></div>
          </div>
        </aside>

        <ContactForm />
      </div>
    </div>
  );
}
