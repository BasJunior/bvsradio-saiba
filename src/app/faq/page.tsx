import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ | BVS Radio",
  description:
    "Answers for artists, creators, media professionals, and partners asking how BVS Radio works and how talent can make money.",
};

const faqs = [
  {
    question: "What is BVS Radio?",
    answer:
      "BVS Radio is a music, media, and creative commerce platform. It connects artists, creators, services, audiences, sales, streams, promotion, and publication opportunities in one BVS ecosystem.",
  },
  {
    question: "Is this a job or a media opportunity?",
    answer:
      "It is not one fixed job listing. The opportunity depends on what the talent does. Artists, producers, DJs, presenters, writers, designers, videographers, promoters, and media professionals can use BVS to submit work, offer services, build a profile, collaborate on content, or reach listeners and buyers.",
  },
  {
    question: "How does talent make money through BVS Radio?",
    answer:
      "Talent can earn through sales of original content, provision of creative or media services, streams and engagement generated on BVS platforms, and wider streaming platform revenue when a project is approved for full publication and distribution.",
  },
  {
    question: "What kind of original content can be sold?",
    answer:
      "Eligible original content can include singles, albums, beats, licences, media packs, digital products, and other approved creative work. The talent must own or control the rights needed to sell or publish the work.",
  },
  {
    question: "Can service providers use BVS?",
    answer:
      "Yes. Media and creative professionals can offer services such as music production, promotion, design, video, writing, presenting, DJ work, audio services, or other approved creative and communications services.",
  },
  {
    question: "What happens after talent submits music or media?",
    answer:
      "Submissions go through review. Approved work can be published on BVS, promoted, played in rotation, offered for sale, or connected to wider publication opportunities where eligible.",
  },
  {
    question: "Can BVS publish work on all streaming platforms?",
    answer:
      "Some projects may become eligible for wider streaming platform publication if they are approved for full publication and distribution. This depends on rights clearance, eligibility, distribution access, and the correct publication route.",
  },
  {
    question: "Does uploading guarantee airplay, sales, or distribution?",
    answer:
      "No. Uploading or contacting BVS does not automatically guarantee airplay, publication, payment, sales, or wider distribution. Approval, rights, content quality, and platform fit all matter.",
  },
  {
    question: "What should a new talent enquiry include?",
    answer:
      "Send your name, role, links or examples of your work, what you want to offer, whether you own the rights, and whether you are looking for BVS publication, services, collaboration, sales, or wider distribution.",
  },
];

export default function FaqPage() {
  return (
    <div className="bg-bg-primary text-text-primary">
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            BVS Radio FAQ
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Answers for artists, creators, and media enquiries.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-text-secondary">
            Use this page to understand what BVS offers, what kind of opportunity it is, and how talent can
            make money through original content, services, streams, and approved publication routes.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/upload" className="rounded-full bg-brand px-6 py-3 text-center font-semibold text-black hover:bg-brand-dark">
              Submit music
            </Link>
            <Link href="/contact" className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold hover:bg-white/5">
              Contact BVS
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-bg-secondary/60">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-12 sm:px-6 sm:py-16">
          {faqs.map((item) => (
            <article key={item.question} className="rounded-2xl border border-white/10 bg-bg-card/50 p-6 sm:p-7">
              <h2 className="text-xl font-semibold text-text-primary">{item.question}</h2>
              <p className="mt-3 leading-relaxed text-text-secondary">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-2xl border border-brand/25 bg-brand/10 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Still not sure which path fits?</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-text-secondary">
            Tell BVS what you do, what you want to offer, and what rights you control. The team can then
            guide you toward artist submission, services, collaboration, sales, or publication review.
          </p>
          <Link href="/contact" className="mt-6 inline-block font-medium text-brand hover:underline">
            Start an enquiry
          </Link>
        </div>
      </section>
    </div>
  );
}
