export default function AppExperienceStyle() {
  return (
    <style>{`
      html[data-bvs-app-shell="true"] {
        --bvs-app-gold: #e3bd58;
        --bvs-app-gold-soft: rgba(227, 189, 88, .14);
        --bvs-app-line: rgba(255, 255, 255, .085);
        --bvs-app-panel: rgba(18, 18, 20, .72);
        --bvs-app-panel-strong: rgba(15, 15, 17, .9);
      }

      html[data-bvs-app-shell="true"] body {
        background:
          radial-gradient(circle at 82% -8%, rgba(212, 175, 55, .12), transparent 30rem),
          radial-gradient(circle at -10% 28%, rgba(87, 86, 255, .07), transparent 26rem),
          linear-gradient(180deg, #09090b 0%, #070708 48%, #050506 100%);
        background-attachment: fixed;
      }

      html[data-bvs-app-shell="true"] body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: -1;
        opacity: .28;
        background-image:
          linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: linear-gradient(to bottom, rgba(0,0,0,.65), transparent 75%);
      }

      .bvs-app-stage {
        position: relative;
        isolation: isolate;
      }

      .bvs-app-stage::before {
        content: "";
        position: absolute;
        z-index: -1;
        top: 2rem;
        left: 50%;
        width: min(74rem, 96vw);
        height: 24rem;
        transform: translateX(-50%);
        border-radius: 999px;
        background: radial-gradient(ellipse, rgba(212,175,55,.075), transparent 66%);
        filter: blur(20px);
        pointer-events: none;
      }

      .bvs-app-stage h1,
      .bvs-app-stage h2,
      .bvs-app-stage h3 {
        text-wrap: balance;
      }

      .bvs-app-stage h1 {
        letter-spacing: -.045em;
      }

      .bvs-app-stage :is(section, article, a)[class*="border-white/10"],
      .bvs-app-stage :is(section, article, div)[class*="border-white/10"][class*="rounded-"] {
        border-color: var(--bvs-app-line);
      }

      .bvs-app-stage :is(section, article, a)[class*="bg-white/"][class*="rounded-"] {
        backdrop-filter: blur(22px) saturate(120%);
        -webkit-backdrop-filter: blur(22px) saturate(120%);
      }

      .bvs-app-stage a[class*="rounded-"][class*="border"],
      .bvs-app-stage button[class*="rounded-"][class*="border"] {
        transition: transform 180ms cubic-bezier(.2,.8,.2,1), border-color 180ms ease, background-color 180ms ease, color 180ms ease;
      }

      .bvs-app-stage a[class*="rounded-"][class*="border"]:active,
      .bvs-app-stage button[class*="rounded-"][class*="border"]:active {
        transform: scale(.985);
      }

      .bvs-app-stage .text-brand {
        color: var(--bvs-app-gold);
      }

      .bvs-app-stage .bg-brand {
        background-color: var(--bvs-app-gold);
      }

      .bvs-app-stage ::selection {
        background: rgba(227,189,88,.28);
      }

      @media (max-width: 639px) {
        .bvs-app-stage h1 { letter-spacing: -.04em; }
        .bvs-app-stage::before { top: 0; height: 18rem; }
      }

      @media (prefers-reduced-motion: no-preference) {
        .bvs-app-stage > * {
          animation: bvsAppReveal 420ms cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes bvsAppReveal {
          from { opacity: .001; transform: translateY(5px); }
          to { opacity: 1; transform: none; }
        }
      }
    `}</style>
  );
}
