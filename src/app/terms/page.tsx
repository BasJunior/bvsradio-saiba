import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | BVS Radio",
  description:
    "Terms for using BVS Radio (Best Virtual Sound) — Zimbabwe-focused online radio, music submissions, and studio services.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <section className="rounded-2xl border border-white/10 bg-bg-card/50 p-8 backdrop-blur md:p-12">
        <p className="mb-2 text-xs uppercase tracking-[3px] text-brand">Best Virtual Sound · Zimbabwe</p>
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">Terms of Service</h1>
        <p className="mb-8 text-text-secondary">Last updated: 20 July 2026 · Applies to bvsradio.com and related BVS apps</p>

        <div className="max-w-none space-y-6 leading-relaxed text-text-secondary">
          <p>
            These Terms govern how you use <strong className="text-text-primary">BVS Radio (Best Virtual Sound)</strong> —
            the website, mobile/hybrid apps, catalogue, radio stream, music submissions, and studio services operated by
            Best Virtual Studios. BVS is built for Zimbabwean sound and the wider African diaspora, while serving listeners
            and artists internationally.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">1. Who we are</h2>
          <p>
            BVS Radio is a digital radio and music platform focused on Zimbabwean and African music culture. We offer
            listening, discovery, paid downloads/services where listed, and a path for artists to submit original work for
            editorial review. Company communications may come from Best Virtual Studios staff in Zimbabwe (CAT) and Europe.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">2. Acceptance</h2>
          <p>
            By using bvsradio.com, our apps, or submitting music/files, you agree to these Terms and our{" "}
            <Link href="/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the service.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">3. Accounts</h2>
          <p>
            You must give accurate details when you sign up. Keep your password private. You are responsible for activity
            under your account. Artist, creator, and shop access may require extra verification. BVS may suspend accounts
            that abuse the platform, spam submissions, or infringe rights.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">4. Music submissions (upload)</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Submissions are for <strong className="text-text-primary">editorial review only</strong> (radio / catalogue
              consideration). Upload does <strong className="text-text-primary">not</strong> guarantee airplay, publication,
              payment, or feedback.
            </li>
            <li>
              You must own or control the rights to every recording, composition, sample, and vocal you upload — including
              permission from all featured artists, producers, and labels where required.
            </li>
            <li>
              Accepted audio for track submission includes common release formats (e.g. MP3, WAV, M4A, FLAC, OGG, AAC).
              Video files (e.g. MP4 camera exports) are not accepted on the music submission form.
            </li>
            <li>
              BVS may reject, delay, or remove material that is unlawful, defamatory, hate speech, or outside programming
              standards — including content that is not suitable for Zimbabwean family-friendly dayparts when marked for
              rotation.
            </li>
          </ul>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">5. Purchases and services</h2>
          <p>
            Prices for beats, downloads, and studio services (mix/master, etc.) are shown at checkout. Taxes may be
            estimated from your billing country. Digital delivery starts after payment is confirmed. EcoCash, cards, and
            bank transfer options depend on payment provider availability (including Zimbabwe-facing methods where
            configured).
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">6. Intellectual property</h2>
          <p>
            The BVS brand, site design, software, and original BVS content remain property of Best Virtual Studios and its
            licensors. Artists retain ownership of their own music subject to any separate licence, release, or service
            agreement. You grant BVS a limited licence to store, stream (if approved), and review submitted files for
            platform operation.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">7. Listening and fair use</h2>
          <p>
            The radio stream and previews are for personal listening. Do not rebroadcast BVS streams commercially without
            written permission. Do not scrape, bulk-download, or attack our infrastructure.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">8. Third-party links</h2>
          <p>
            We may link to WhatsApp, social networks, payment providers, or other sites. We are not responsible for their
            content or policies.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">9. Liability</h2>
          <p>
            The service is provided “as is”. To the fullest extent allowed by law, BVS is not liable for indirect loss,
            lost profits, or data loss arising from use of the site, missed airplay, payment provider outages, or
            third-party platforms. Nothing in these Terms limits rights you cannot waive under applicable consumer law.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">10. Governing law &amp; disputes</h2>
          <p>
            These Terms are interpreted with regard to BVS operating as a Zimbabwe-rooted digital music service with
            international users. Disputes will first be addressed in good faith via our contact channels. Where a formal
            forum is required, proceedings may be brought in courts competent for Best Virtual Studios’ place of
            establishment, without preventing mandatory consumer protections that apply where you live (including in
            Zimbabwe or the EU/EEA if you are a resident consumer there).
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">11. Changes</h2>
          <p>
            We may update these Terms. Material changes will be reflected by the “Last updated” date on this page. Continued
            use after changes means you accept the updated Terms.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">12. Contact (Zimbabwe &amp; international)</h2>
          <p>
            Best Virtual Studios / BVS Radio
            <br />
            Focus: Zimbabwean music · CAT timezone for ops replies
            <br />
            Email:{" "}
            <a href="mailto:contact@bvsradio.com" className="text-brand hover:underline">
              contact@bvsradio.com
            </a>
            {" · "}
            <a href="mailto:legal@bvsradio.com" className="text-brand hover:underline">
              legal@bvsradio.com
            </a>
            <br />
            WhatsApp:{" "}
            <a href="https://wa.me/4917664006205" className="text-brand hover:underline">
              +49 176 64006205
            </a>
            <br />
            Web:{" "}
            <Link href="/contact" className="text-brand hover:underline">
              bvsradio.com/contact
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
