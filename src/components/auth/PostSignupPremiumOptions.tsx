"use client";

import Link from "next/link";
import { useEffect } from "react";
import { trackSignupFunnel } from "@/lib/signup-funnel";

type AppSurface = "ios" | "android";

export default function PostSignupPremiumOptions({
  role,
  surface,
}: {
  role: string;
  surface?: AppSurface;
}) {
  useEffect(() => {
    trackSignupFunnel("premium_options_shown", {
      source: "post_signup",
      role,
      surface: surface || "web",
    });
  }, [role, surface]);

  const instantHref = surface
    ? `/app/${surface}/studio/money?from=signup&plan=instant`
    : "/artist/premium/instant?from=signup";
  const annualHref = surface
    ? `/app/${surface}/studio/money?from=signup&plan=annual`
    : "/artist/premium?from=signup";
  const freeHref = surface ? `/app/${surface}` : "/radio";

  return (
    <section className="mt-6 text-left" aria-labelledby="post-signup-options-title">
      <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Choose what comes next</p>
      <h3 id="post-signup-options-title" className="mt-2 text-xl font-semibold">Your BVS account starts free.</h3>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        You can stay on the free foundation or choose a distribution option now. Premium does not buy editorial approval, rotation, charts or guaranteed streams.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link
          href={freeHref}
          onClick={() => trackSignupFunnel("premium_option_clicked", { source: "post_signup", option: "free", role })}
          className="rounded-[1.2rem] border border-white/10 bg-white/[.025] p-4 transition hover:border-white/20 hover:bg-white/[.04]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/45">Free</p>
          <p className="mt-2 text-2xl font-semibold">US$0</p>
          <p className="mt-2 text-xs leading-5 text-white/40">Listen, submit, publish on BVS and use your creator home base.</p>
        </Link>

        <Link
          href={instantHref}
          onClick={() => trackSignupFunnel("premium_option_clicked", { source: "post_signup", option: "instant", role })}
          className="rounded-[1.2rem] border border-brand/22 bg-brand/[.055] p-4 transition hover:border-brand/40 hover:bg-brand/[.08]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">Premium Instant</p>
          <p className="mt-2 text-2xl font-semibold">US$5.99</p>
          <p className="mt-2 text-xs leading-5 text-white/45">Per approved release. One-time payment, no subscription.</p>
        </Link>

        <Link
          href={annualHref}
          onClick={() => trackSignupFunnel("premium_option_clicked", { source: "post_signup", option: "annual", role })}
          className="rounded-[1.2rem] border border-violet-300/20 bg-violet-400/[.055] p-4 transition hover:border-violet-300/35 hover:bg-violet-400/[.08]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-violet-200">Artist Premium Annual</p>
          <p className="mt-2 text-2xl font-semibold">US$29/year</p>
          <p className="mt-2 text-xs leading-5 text-white/45">Ongoing distribution access for approved releases during the active year.</p>
        </Link>
      </div>
    </section>
  );
}
