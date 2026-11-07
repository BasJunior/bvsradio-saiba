import Link from "next/link";

/** Header for app Studio inner pages: back to Studio, eyebrow, short title, one plain line. */
export default function StudioSubHeader({ href, eyebrow, title, copy }: { href: string; eyebrow: string; title: string; copy?: string }) {
  return (
    <header className="pb-2">
      <Link href={href} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#a7cbea]"><span aria-hidden="true">‹</span> Studio</Link>
      <p className="bvs-studio-eyebrow mt-3">{eyebrow}</p>
      <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">{title}</h1>
      {copy ? <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{copy}</p> : null}
    </header>
  );
}
