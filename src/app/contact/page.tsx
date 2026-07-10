import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with BVS Radio",
};

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <section className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Contact BVS Radio</h1>
        <p className="text-text-secondary text-lg leading-relaxed mb-8">
          We&apos;d love to hear from you! Whether you have feedback, questions, music suggestions,
          or just want to say hello, we&apos;re here to listen.
        </p>

        <h2 className="text-2xl font-semibold mb-4">Get in Touch</h2>
        <div className="space-y-3 mb-8">
          {[
            { label: "General Inquiries", email: "info@bvsradio.com" },
            { label: "Advertising", email: "ads@bvsradio.com" },
            { label: "Press / Media", email: "press@bvsradio.com" },
            { label: "Technical Support", email: "support@bvsradio.com" },
          ].map((item) => (
            <div key={item.email} className="bg-bg-primary/50 rounded-xl p-4 border border-white/5">
              <span className="text-sm text-text-secondary">{item.label}</span>
              <br />
              <a href={`mailto:${item.email}`} className="text-brand hover:underline text-lg font-medium">
                {item.email}
              </a>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-semibold mb-4">Send Us a Message</h2>
        <form className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
            <input id="name" type="text" required placeholder="Your name"
              className="w-full px-4 py-3 bg-bg-primary border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input id="email" type="email" required placeholder="Your email address"
              className="w-full px-4 py-3 bg-bg-primary border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors" />
          </div>
          <div>
            <label htmlFor="subject" className="block text-sm font-medium mb-1">Subject</label>
            <input id="subject" type="text" required placeholder="What's this regarding?"
              className="w-full px-4 py-3 bg-bg-primary border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors" />
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-1">Message</label>
            <textarea id="message" rows={5} required placeholder="Your message here..."
              className="w-full px-4 py-3 bg-bg-primary border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors resize-none" />
          </div>
          <button type="submit"
            className="px-8 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark transition-all">
            Send Message
          </button>
        </form>
        <p className="text-sm text-text-secondary mt-4">
          We typically respond within 24-48 hours.
        </p>
      </section>
    </div>
  );
}