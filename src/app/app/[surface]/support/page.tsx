import Link from "next/link";
import { notFound } from "next/navigation";
import ContactForm from "@/app/contact/ContactForm";

export default async function AppSupportPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <Link href={`/app/${raw}/you`} className="text-sm text-white/40 transition hover:text-white">← You</Link>
      <p className="mt-7 text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Support</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Talk to BVS.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/42 sm:text-base">Account help, music submissions, creator services, partnerships or a technical issue — reach the right team from here.</p>

      <div className="mt-9 grid gap-5 lg:grid-cols-[.8fr,1.2fr]">
        <aside className="rounded-[1.7rem] border border-white/[.07] bg-white/[.022] p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Direct channels</p>
          <div className="mt-4 space-y-3">
            {[
              ["General & partnerships", "hello@bvsradio.com"],
              ["Artist & music submissions", "music@bvsradio.com"],
              ["Advertising & brands", "ads@bvsradio.com"],
              ["Press & media", "press@bvsradio.com"],
            ].map(([label, email]) => (
              <div key={email} className="rounded-[1.1rem] border border-white/[.07] bg-black/10 p-4">
                <p className="text-xs text-white/34">{label}</p>
                <a href={`mailto:${email}`} className="mt-1 block break-all font-semibold text-brand">{email}</a>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[1.15rem] border border-brand/16 bg-brand/[.045] p-4 text-sm leading-6 text-white/40">
            If the music is already in BVS, use Studio so your message stays connected to the release or track.
            <div className="mt-3"><Link href={`/app/${raw}/studio`} className="font-semibold text-brand">Open Studio →</Link></div>
          </div>
        </aside>

        <ContactForm />
      </div>
    </div>
  );
}
