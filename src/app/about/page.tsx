import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about BVS Radio — Zimbabwe's premier online radio station",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <section className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">About BVS Radio</h1>
        <p className="text-text-secondary text-lg leading-relaxed mb-6">
          BVS Radio is a vibrant online radio station dedicated to bringing you the best in music,
          entertainment, and community engagement. Founded with a passion for connecting people through
          sound, we strive to create a unique listening experience that celebrates diversity in music
          and culture.
        </p>

        <h2 className="text-2xl font-semibold mb-4 mt-10">Our Mission</h2>
        <p className="text-text-secondary leading-relaxed mb-6">
          Our mission is to provide high-quality, diverse music programming that entertains, informs,
          and inspires our listeners worldwide. We aim to be more than just a radio station — we want
          to be a community hub where music lovers can discover new artists, enjoy their favorite tunes,
          and connect with like-minded individuals.
        </p>

        <h2 className="text-2xl font-semibold mb-4 mt-10">What We Offer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[
            { title: "Live Radio Streaming", desc: "Tune in 24/7 for our curated music mixes and live shows" },
            { title: "Daily Updates", desc: "Stay informed with the latest music news and industry trends" },
            { title: "Exclusive Deals", desc: "Access special discounts on music gear, concert tickets, and more" },
            { title: "Community Engagement", desc: "Join our growing community of music enthusiasts" },
          ].map((item) => (
            <div key={item.title} className="bg-bg-primary/50 rounded-xl p-4 border border-white/5">
              <h3 className="font-semibold text-brand mb-1">{item.title}</h3>
              <p className="text-sm text-text-secondary">{item.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-semibold mb-4 mt-10">Our Team</h2>
        <p className="text-text-secondary leading-relaxed mb-6">
          Behind BVS Radio is a dedicated team of music enthusiasts, DJs, content creators, and tech
          specialists who work tirelessly to bring you the best possible listening experience. We&apos;re
          passionate about music and committed to delivering content that resonates with our audience.
        </p>

        <h2 className="text-2xl font-semibold mb-4 mt-10">Get Involved</h2>
        <p className="text-text-secondary leading-relaxed">
          We love hearing from our listeners! Whether you have feedback, song requests, or just want to
          say hello, we&apos;re always eager to connect with you. Visit our{" "}
          <a href="/contact" className="text-brand hover:underline">
            Contact page
          </a>{" "}
          to get in touch.
        </p>
      </section>
    </div>
  );
}