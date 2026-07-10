import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "BVS Radio Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <section className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-text-secondary mb-8">Last updated: May 23, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-text-secondary leading-relaxed">
          <p>Please read these Terms of Service (&quot;Terms&quot;, &quot;Terms of Service&quot;) carefully before using the BVS Radio website and services.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Acceptance of Terms</h2>
          <p>By accessing or using the BVS Radio website and services, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the service.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Changes to Terms</h2>
          <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Accounts</h2>
          <p>When you create an account with us, you must provide accurate and complete information. You are solely responsible for the activity that occurs on your account, and you must keep your account password secure.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Intellectual Property</h2>
          <p>The BVS Radio website and its original content, features, and functionality are and will remain the exclusive property of BVS Radio and its licensors. The service is protected by copyright, trademark, and other laws of both the United States and foreign countries.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Links to Other Websites</h2>
          <p>Our service may contain links to third-party websites or services that are not owned or controlled by BVS Radio. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Termination</h2>
          <p>We may terminate or suspend your account and bar access to the service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including if you breach the Terms.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Limitation of Liability</h2>
          <p>In no event shall BVS Radio, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Governing Law</h2>
          <p>These Terms shall be governed and construed in accordance with the laws of Germany, without regard to its conflict of law provisions.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at:</p>
          <p className="text-text-primary">
            BVS Radio<br />
            Email: <a href="mailto:legal@bvsradio.com" className="text-brand hover:underline">legal@bvsradio.com</a>
          </p>
        </div>
      </section>
    </div>
  );
}