import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | BVS Radio",
  description:
    "Terms for using BVS Radio (Best Virtual Sound) — international online radio, music submissions, and studio services rooted in Zimbabwe.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <section className="rounded-2xl border border-white/10 bg-bg-card/50 p-8 backdrop-blur md:p-12">
        <p className="mb-2 text-xs uppercase tracking-[3px] text-brand">Best Virtual Sound · Zimbabwe roots · global reach</p>
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">Terms of Service</h1>
        <p className="mb-8 text-text-secondary">Last updated: 3 August 2026 · Applies to bvsradio.com and related BVS apps</p>

        <div className="max-w-none space-y-6 leading-relaxed text-text-secondary">
          <p>
            These Terms govern how you use <strong className="text-text-primary">BVS Radio (Best Virtual Sound)</strong> —
            the website, mobile/hybrid apps, catalogue, radio stream, music submissions, and studio services operated by
            Best Virtual Studios. BVS is built from Zimbabwean roots for African sound and the wider diaspora, while serving listeners
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
              For album/EP releases, you complete a <strong className="text-text-primary">versioned rights attestation</strong>{" "}
              (currently <code className="text-brand">BVS-RIGHTS-ATTEST-2026-08-01</code>) confirming master and composition
              control, featured-contributor clearance, samples/beats clearance, and limited grants for BVS to host, stream,
              catalogue, and promote that release. We store the agreement version, timestamp, account/release identifiers,
              and an immutable audit snapshot (and may store IP/user-agent for security/audit).
            </li>
            <li>
              Covers, remixes, samples, leased beats, and other third-party material must be declared with{" "}
              <strong className="text-text-primary">clearance evidence</strong>. Server-side preflight blocks approval or
              publication when required evidence is missing.
            </li>
            <li>
              Accepted audio for track submission includes common release formats (e.g. MP3, WAV, M4A, FLAC, OGG, AAC).
              Video files (e.g. MP4 camera exports) are not accepted on the music submission form.
            </li>
            <li>
              BVS may reject, delay, hold (unpublish), or remove material that is unlawful, defamatory, hate speech, outside
              programming standards, or subject to a rights complaint — including content that is not suitable for
              family-friendly dayparts when marked for rotation.{" "}
              <strong className="text-text-primary">Automated workflows do not delete your account or entire catalogue.</strong>
            </li>
          </ul>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">4A. Copyright complaints &amp; repeat infringement</h2>
          <p>
            Rights holders may file a complaint using our public form at{" "}
            <Link href="/copyright" className="text-brand hover:underline">
              /copyright
            </Link>
            . Complaints receive a docket number and staff workflow. We may place content on hold (unpublish / remove from
            rotation) while reviewing. Artists linked to a docket may receive an in-product notice and may submit a
            counter-response. Upheld complaints can create strikes; repeated active strikes may restrict further uploads or
            publishing at configurable thresholds, with staff override and audit trail. Full product description (and
            lawyer-review markers) lives on the Copyright page — this Terms section only summarises behaviour.
          </p>

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
            agreement. Through the versioned release attestation, you grant BVS a limited non-exclusive licence to host,
            stream (if approved), catalogue, promote, and review submitted files for platform operation — without transferring
            copyright ownership.{" "}
            <span className="text-amber-200/90">Lawyer review: final licence wording.</span>
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
            These Terms are interpreted with regard to BVS operating as an international, Zimbabwe-rooted digital music service with
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

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">12. Contact (Zimbabwe local services &amp; international)</h2>
          <p>
            Best Virtual Studios / BVS Radio
            <br />
            Focus: African music rooted in Zimbabwe · CAT timezone for ops replies
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
            <a href="https://wa.me/491706580888" className="text-brand hover:underline">
              +49 170 6580888
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
