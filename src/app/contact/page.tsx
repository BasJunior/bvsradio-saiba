import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact BVS Radio",
  description: "Contact BVS Radio for support, partnerships and feedback. Submit music through your BVS profile for editorial review, not by email.",
};

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="max-w-2xl">
        <h1 className="text-5xl font-bold tracking-tight mb-4">Let&apos;s talk.</h1>
        <p className="text-xl text-text-secondary">Whether you&apos;re an artist, brand, or listener — we&apos;d love to hear from you.</p>
      </div>

      <section aria-labelledby="music-submissions" className="mt-10 rounded-2xl border border-brand/30 bg-brand/5 p-6">
        <h2 id="music-submissions" className="text-2xl font-semibold">Want to submit music?</h2>
        <p className="mt-3 text-text-secondary">Create a BVS Radio account or sign in, complete your artist profile, then upload your track or release through the official submission page. This puts your music in our editorial review queue for potential publication and airplay.</p>
        <p className="mt-3 text-sm text-text-secondary">Music sent by email or through this contact form does not enter the review queue. Submission does not guarantee approval or airplay.</p>
        <Link href="/upload" className="mt-5 inline-flex rounded-full bg-brand px-6 py-3 font-semibold text-black hover:bg-brand-dark">Submit music through your profile</Link>
      </section>

      <div className="grid lg:grid-cols-5 gap-12 mt-14">
        {/* Contact info */}
        <div className="lg:col-span-2">
          <div className="space-y-8">
            {[
              { label: "General & Partnerships", email: "hello@bvsradio.com" },
              { label: "Advertising & Brands", email: "ads@bvsradio.com" },
              { label: "Press & Media", email: "press@bvsradio.com" },
            ].map((item, i) => (
              <div key={i}>
                <div className="text-sm text-text-secondary">{item.label}</div>
                <a href={`mailto:${item.email}`} className="text-xl hover:text-brand transition-colors">{item.email}</a>
              </div>
            ))}
          </div>

          <div className="mt-10 text-sm text-text-secondary">
            <div className="mb-1">Follow the movement</div>
            <div className="flex gap-4 text-brand">
              <a href="https://instagram.com/bvsradio" target="_blank">@bvsradio</a>
              <a href="https://x.com/bvsradio" target="_blank">@bvsradio</a>
            </div>
          </div>
        </div>

        {/* Form (Client Component) */}
        <div className="lg:col-span-3">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
