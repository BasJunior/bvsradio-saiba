import type { Metadata } from "next";
import Link from "next/link";
import CopyrightComplaintForm from "@/components/CopyrightComplaintForm";

export const metadata: Metadata = {
  title: "Copyright & Takedown Policy | BVS Radio",
  description:
    "How BVS Radio handles copyright complaints, content holds, and repeat-infringer enforcement. File a complaint with a docket number.",
};

export default function CopyrightPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <section className="rounded-2xl border border-white/10 bg-bg-card/50 p-8 backdrop-blur md:p-12">
        <p className="mb-2 text-xs uppercase tracking-[3px] text-brand">Best Virtual Sound · Rights</p>
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">Copyright &amp; takedown</h1>
        <p className="mb-8 text-text-secondary">
          Last updated: 3 August 2026 · Describes implemented product behaviour ·{" "}
          <span className="text-amber-200/90">Lawyer-review placeholders marked below</span>
        </p>

        <div className="max-w-none space-y-6 leading-relaxed text-text-secondary">
          <p>
            BVS Radio (Best Virtual Sound) hosts artist-submitted music for editorial review, streaming, and catalogue
            listing when approved. We expect uploaders to control the rights they grant us. This page explains how the{" "}
            <strong className="text-text-primary">public complaint form</strong>, staff review, content holds, and
            repeat-infringer restrictions work in the product today.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">1. What artists attest</h2>
          <p>
            For each release, artists complete a <strong className="text-text-primary">versioned rights attestation</strong>{" "}
            (current version <code className="text-brand">BVS-RIGHTS-ATTEST-2026-08-01</code>) confirming master and
            composition control, featured-contributor clearance, samples/beats clearance, and grants for BVS to host,
            stream, catalogue, and promote that release. We store agreement version, timestamp, user/release/track
            identifiers, IP and user-agent when available, and an immutable audit snapshot. See also our{" "}
            <Link href="/terms" className="text-brand hover:underline">
              Terms
            </Link>
            .
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">2. Clearance evidence</h2>
          <p>
            Covers, remixes, samples, leased beats, and other third-party material must be declared. Required clearance
            evidence (licence/permission reference and/or document metadata) is checked in server-side publish preflight.
            Editorial cannot approve/publish a release while required evidence is missing.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">3. How to file a complaint</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use the form below. You will receive a <strong className="text-text-primary">docket number</strong>.</li>
            <li>Provide claimant contact details, the work you claim, BVS URLs, and good-faith / accuracy / authority declarations.</li>
            <li>Staff review complaints. We may place content on <strong className="text-text-primary">hold</strong> (unpublish / remove from rotation) while reviewing.</li>
            <li>
              <strong className="text-text-primary">We do not auto-delete content or accounts</strong> from this form.
              Holds unpublish; strikes may restrict future uploads/publishing after upheld complaints.
            </li>
          </ul>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">4. Artist notice &amp; counter-response</h2>
          <p>
            When a complaint is linked to an artist account, we create an in-product rights notice. Signed-in artists may
            submit a counter-response (good-faith statement) via the account/API path. Staff record the counter-response
            on the docket; content is not auto-restored.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">5. Repeat-infringer enforcement</h2>
          <p>
            Upheld complaints can create <strong className="text-text-primary">strikes</strong> on the linked account.
            Default thresholds (configurable by administrators) restrict uploads and/or publishing after repeated active
            strikes. Staff may override with a recorded reason.{" "}
            <strong className="text-text-primary">No automatic account or catalogue deletion.</strong>
          </p>
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <strong>Lawyer review:</strong> Threshold numbers, statutory notice wording (including any US DMCA-style or
            Zimbabwe/local formalities), designated agent registration, and cross-border notice requirements are{" "}
            <em>not</em> final legal advice. This page only documents implemented software behaviour.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">6. Privacy</h2>
          <p>
            Complaint forms collect contact details, statements, URLs, and technical metadata (IP/user-agent) for abuse
            prevention and audit. See our{" "}
            <Link href="/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>
            . Do not submit passwords or payment card numbers in this form.
          </p>

          <h2 className="mt-10 text-2xl font-semibold text-text-primary">7. File a complaint</h2>
          <CopyrightComplaintForm />
        </div>
      </section>
    </div>
  );
}
