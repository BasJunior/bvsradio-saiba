export default function AppExperienceStyle() {
  return (
    <style>{`
      html[data-bvs-app-shell="true"] {
        --bvs-app-gold: #e3bd58;
        --bvs-app-gold-soft: rgba(227, 189, 88, .14);
        --bvs-app-line: rgba(255, 255, 255, .085);
        --bvs-app-panel: rgba(18, 18, 20, .72);
        --bvs-app-panel-strong: rgba(15, 15, 17, .9);
        --bvs-app-bottom-stack-height: calc(var(--bvs-nav-height, var(--bvs-app-bottom-nav-height)) + var(--bvs-app-player-height) + .7rem);
        overscroll-behavior-x: none;
        overscroll-behavior-y: none;
      }

      html[data-bvs-app-shell="true"] body {
        min-height: 100dvh;
        overscroll-behavior-x: none;
        overscroll-behavior-y: none;
        touch-action: pan-y;
        background:
          radial-gradient(circle at 82% -8%, rgba(212, 175, 55, .12), transparent 30rem),
          radial-gradient(circle at -10% 28%, rgba(87, 86, 255, .07), transparent 26rem),
          linear-gradient(180deg, #09090b 0%, #070708 48%, #050506 100%);
        background-attachment: fixed;
      }

      /*
       * Keep shell chrome on independent compositor layers. Combined with root
       * overscroll containment this prevents iOS/WKWebView elastic scrolling
       * from visually tugging the header, player or tab bar at page boundaries.
       */
      html[data-bvs-app-shell="true"] :is(.bvs-app-header, .bvs-persistent-player, .bvs-app-bottom-nav) {
        -webkit-transform: translate3d(0, 0, 0);
        transform: translate3d(0, 0, 0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        will-change: transform;
      }

      /*
       * The contained iOS WebView may already begin below the native status bar,
       * which makes the Now Playing sheet's fallback 0.75rem top padding show as
       * an extra dark seam. Keep only the real safe-area inset so the full player
       * attaches cleanly to the top chrome without crowding devices that report it.
       */
      html[data-bvs-app-shell="true"] [data-now-playing-shell="true"] {
        top: 0 !important;
        background: #090909;
      }

      html[data-bvs-app-shell="true"] [data-now-playing-shell="true"] > .relative {
        padding-top: env(safe-area-inset-top, 0px) !important;
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

      /*
       * Mini-player and tab bar read as one bottom dock: two quiet floating
       * layers with the same width language instead of a full-width frosted
       * sheet sitting on top of a pill.
       */
      @media (max-width: 767px) {
        /*
         * iOS Safari/WKWebView auto-zooms focused form controls below 16px and
         * can leave the whole app magnified after submit. Keep contained-app
         * controls at the native no-zoom threshold without disabling pinch zoom.
         */
        html[data-bvs-app-shell="true"] :is(input, textarea, select) {
          font-size: 16px !important;
        }

        html[data-bvs-app-shell="true"] .bvs-persistent-player {
          left: max(.7rem, env(safe-area-inset-left)) !important;
          right: max(.7rem, env(safe-area-inset-right)) !important;
          bottom: calc(var(--bvs-nav-height, var(--bvs-app-bottom-nav-height)) + .7rem) !important;
          width: auto !important;
          max-width: 34rem !important;
          margin-inline: auto !important;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.12) !important;
          border-radius: 1.2rem !important;
          background:
            linear-gradient(180deg, rgb(255 255 255 / 8%), transparent 42%),
            rgb(16 16 20 / 64%);
          -webkit-backdrop-filter: blur(20px) saturate(145%);
          backdrop-filter: blur(20px) saturate(145%);
          box-shadow: inset 0 1px 0 rgb(255 255 255 / 18%), 0 10px 28px rgba(0,0,0,.34);
        }

        html[data-bvs-app-shell="true"] .bvs-persistent-player-inner {
          height: 4.15rem !important;
          padding-left: max(.6rem, env(safe-area-inset-left));
          padding-right: max(.45rem, env(safe-area-inset-right));
          gap: .35rem !important;
        }

        html[data-bvs-app-shell="true"] .bvs-persistent-player-inner > button:first-of-type {
          gap: .55rem !important;
        }

        html[data-bvs-app-shell="true"] .bvs-persistent-player-inner > :is(a, button):not(:first-child) {
          flex-shrink: 0;
        }
      }

      /* Grid mode only targets saved-media rows. Action-heavy Downloads stay readable as lists. */
      html[data-bvs-library-view="grid"] .bvs-app-stage .space-y-2:has(> article > button:first-child + a) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: .75rem;
      }

      html[data-bvs-library-view="grid"] .bvs-app-stage .space-y-2:has(> article > button:first-child + a) > article {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: .65rem !important;
        margin-top: 0 !important;
        padding: .65rem !important;
      }

      html[data-bvs-library-view="grid"] .bvs-app-stage .space-y-2:has(> article > button:first-child + a) > article > button:first-child {
        grid-column: 1 / -1;
        width: 100% !important;
        height: auto !important;
        aspect-ratio: 1 / 1;
        border-radius: 1rem;
      }

      html[data-bvs-library-view="grid"] .bvs-app-stage .space-y-2:has(> article > button:first-child + a) > article > a:nth-child(2) {
        min-width: 0;
      }

      html[data-bvs-library-view="grid"] .bvs-app-stage .space-y-2:has(> article > button:first-child + a) > article > :last-child {
        align-self: center;
      }

      @media (min-width: 640px) {
        html[data-bvs-library-view="grid"] .bvs-app-stage .space-y-2:has(> article > button:first-child + a) {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
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
