import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "./ContactForm";
import "./contact.css";

export const metadata: Metadata = {
  title: "Contact BVS Radio",
  description: "Contact BVS Radio for support, partnerships and feedback. Submit music through your BVS profile for editorial review, not by email.",
};

const directLines = [
  { label: "General & partnerships", email: "hello@bvsradio.com" },
  { label: "Advertising & brands", email: "ads@bvsradio.com" },
  { label: "Press & media", email: "press@bvsradio.com" },
];

export default function ContactPage() {
  return (
    <main className="bvs-contact-page">
      <header className="bvs-contact-hero">
        <div><p className="bvs-contact-eyebrow">BVS support desk</p><h1>Let&apos;s talk.</h1><p>Questions, partnerships, editorial follow-up, and Studio support — send the right message to the right team.</p></div>
        <div className="bvs-contact-hero-note"><span>Response time</span><strong>1–2 business days</strong><small>We&apos;ll send a reference number and a copy of your message.</small></div>
      </header>

      <section aria-labelledby="contact-paths" className="bvs-contact-paths">
        <div className="bvs-contact-section-heading"><div><p className="bvs-contact-eyebrow">Choose a path</p><h2 id="contact-paths">What can we help with?</h2></div><Link href="/faq">Browse FAQs ↗</Link></div>
        <div className="bvs-contact-path-grid">
          <Link href="/upload" className="bvs-contact-path bvs-contact-path-primary"><span className="bvs-contact-path-icon">♪</span><span><strong>Submit music</strong><small>Use your BVS profile to enter editorial review. Email and contact messages are not submissions.</small></span><b>Upload music ↗</b></Link>
          <Link href="/contact?topic=editorial" className="bvs-contact-path"><span className="bvs-contact-path-icon">↗</span><span><strong>Editorial request</strong><small>Ask about an existing release, review note, or submission status.</small></span><b>Contact editorial ↗</b></Link>
          <Link href="/contact?topic=studio" className="bvs-contact-path"><span className="bvs-contact-path-icon">⌘</span><span><strong>Studio support</strong><small>Get help with uploads, your catalogue, wallet, or creator tools.</small></span><b>Get Studio help ↗</b></Link>
        </div>
      </section>

      <div className="bvs-contact-grid">
        <aside className="bvs-contact-aside">
          <div><p className="bvs-contact-eyebrow">Direct lines</p><h2>Talk to BVS</h2><p className="bvs-contact-muted">Prefer email? Choose the closest team and include enough detail for a useful reply.</p></div>
          <div className="bvs-contact-lines">{directLines.map((item) => <div key={item.email} className="bvs-contact-line"><span>{item.label}</span><a href={`mailto:${item.email}`}>{item.email}</a></div>)}</div>
          <div className="bvs-contact-follow"><span>Follow the movement</span><div><a href="https://instagram.com/bvsradio" target="_blank" rel="noreferrer">@bvsradio</a><a href="https://x.com/bvsradio" target="_blank" rel="noreferrer">@bvsradio on X</a></div></div>
        </aside>
        <div className="bvs-contact-form-wrap"><ContactForm /></div>
      </div>
    </main>
  );
}
