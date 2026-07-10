import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "BVS Radio Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <section className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-text-secondary mb-8">Last updated: May 23, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-text-secondary leading-relaxed">
          <p>This privacy policy describes how BVS Radio (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) collects, uses, and shares information when you use our website and services.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Information We Collect</h2>
          <p>We may collect personal information that you voluntarily provide to us, such as your name, email address, and payment information when you make a purchase or sign up for our newsletter.</p>
          <p>We also automatically collect certain information when you visit our website, including your IP address, browser type, operating system, and browsing behavior through cookies and similar technologies.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide, maintain, and improve our website and services</li>
            <li>Process transactions and send you related information, including purchase confirmations and invoices</li>
            <li>Send you promotional communications, such as newsletters and special offers</li>
            <li>Respond to your comments, questions, and requests</li>
            <li>Comply with legal obligations and protect our rights</li>
          </ul>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Sharing Your Information</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Service providers who help us operate our website and deliver our services</li>
            <li>Payment processors to facilitate transactions</li>
            <li>Advertising and analytics partners, including Google AdSense</li>
            <li>Legal authorities when required by law</li>
          </ul>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Cookies and Tracking Technologies</h2>
          <p>We use cookies and similar tracking technologies to remember your preferences, analyze site traffic, and deliver targeted advertisements. You can control cookies through your browser settings.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Your Rights</h2>
          <p>Depending on your location, you may have the right to access, correct, delete, or restrict the use of your personal information. You may also have the right to object to certain processing and to data portability.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Data Security</h2>
          <p>We implement reasonable security measures to protect your information from unauthorized access, disclosure, alteration, or destruction.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Changes to This Privacy Policy</h2>
          <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Contact Us</h2>
          <p>If you have any questions about this privacy policy, please contact us at:</p>
          <p className="text-text-primary">
            BVS Radio<br />
            Email: <a href="mailto:privacy@bvsradio.com" className="text-brand hover:underline">privacy@bvsradio.com</a>
          </p>
        </div>
      </section>
    </div>
  );
}