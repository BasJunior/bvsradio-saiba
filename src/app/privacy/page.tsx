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
        <p className="text-text-secondary mb-8">Last updated: September 5, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-text-secondary leading-relaxed">
          <p>This privacy policy describes how BVS Radio (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) collects, uses, and shares information when you use the BVS Radio website, iOS app, and related services.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Information We Collect</h2>
          <p>When you create an account or use member features, you may provide an email address, name, username, profile text, profile image, creator information, audio, lyrics, notes, community posts, support messages, saved-library activity, and notification preferences. Availability enquiries may also include an optional phone number. Purchase and entitlement records created through BVS services may remain linked to your account so we can provide access, receipts, support, and rights records.</p>
          <p>The app may receive a device push-notification token after you grant notification permission. We store that token with your account, platform, app variant, enabled status, and recent registration time so notifications can be delivered and disabled correctly. We do not use an advertising identifier for this purpose.</p>
          <p>We also collect limited operational information such as product interactions, searches, playback and save events, app errors, browser or operating-system information, and standard server request data. This helps us operate, secure, troubleshoot, and improve the service.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide, maintain, and improve our website and services</li>
            <li>Authenticate accounts and provide profiles, libraries, community, creator tools, and Lyrics Pad workspaces</li>
            <li>Remember notification choices and deliver notifications that you enable</li>
            <li>Process transactions and send you related information, including purchase confirmations and invoices</li>
            <li>Respond to availability enquiries, support requests, reports, and account-deletion requests</li>
            <li>Send service or promotional communications consistent with your choices</li>
            <li>Respond to your comments, questions, and requests</li>
            <li>Comply with legal obligations and protect our rights</li>
          </ul>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Sharing Your Information</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Service providers who help us operate our website and deliver our services</li>
            <li>Hosting, database, media-storage, email, push-notification, analytics, and support providers acting for BVS</li>
            <li>Payment processors when a transaction is made through a BVS web service</li>
            <li>Legal authorities when required by law</li>
          </ul>
          <p>We do not sell personal information. Public profile information and content you choose to publish may be visible to other users. Community participants can report content and block accounts; reports are available to authorized staff for safety review.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Cookies and Tracking Technologies</h2>
          <p>We use local or session storage, cookies, and similar technologies to keep you signed in, remember app preferences, maintain playback state, and measure service performance. You can control browser storage through your browser or device settings, although clearing it may sign you out or remove local preferences and downloads.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Privacy-conscious product analytics</h2>
          <p>BVS measures a small set of product events—such as playback starts, coarse listening-duration ranges, searches with no result, saves, uploads, and checkout outcomes—to improve reliability and content discovery. These events do not contain names, email addresses, payment details, raw IP addresses, or advertising identifiers. The analytics session uses a random session identifier, ends when the browser tab closes, and respects Do Not Track and the BVS analytics-disable preference. Operational analytics data is retained for no longer than 90 days.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">iOS App Purchases and Entitlements</h2>
          <p>The BVS Radio iOS app does not offer digital purchasing or checkout. It may display or use an entitlement that was already recorded on your BVS account, such as access to a Lyrics Pad workspace associated with a beat licence. The entitlement record is used to verify access and preserve the applicable rights information.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Retention</h2>
          <p>We keep account and content data while your account is active and for as long as reasonably needed to provide the service, resolve support or safety issues, preserve transaction and rights records, and meet legal obligations. A registered push token remains in the service until it is disabled or removed; changing iOS notification permission prevents alerts at the device. Some published creator content or active transaction records may require review before account deletion so other users&apos; purchases, licences, and credits are not broken.</p>

          <h2 className="text-2xl font-semibold text-text-primary mt-10">Your Rights</h2>
          <p>Depending on your location, you may have the right to access, correct, delete, or restrict the use of your personal information. You may also have the right to object to certain processing and to data portability. Account export and authenticated deletion-request tools are available from the account area. Notification permissions can be changed in the app or iOS Settings, and BVS notification categories can be changed in the app.</p>

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
