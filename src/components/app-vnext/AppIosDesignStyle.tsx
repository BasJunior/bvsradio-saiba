/** iOS-only translation of the current BVS poster identity. */
export default function AppIosDesignStyle() {
  return (
    <style>{`
      html[data-bvs-app-surface="ios"] {
        --color-brand: #c1ff52;
        --bvs-app-accent: #c1ff52;
        --bvs-app-accent-soft: rgb(193 255 82 / .12);
        --bvs-app-panel: #151619;
        --bvs-app-panel-strong: #0d0e10;
        --bvs-app-line: rgb(255 255 255 / .15);
      }
      html[data-bvs-app-surface="ios"] body { background: #0d0e10; }
      html[data-bvs-app-surface="ios"] body::before,
      html[data-bvs-app-surface="ios"] .bvs-app-stage::before { display: none; }
      html[data-bvs-app-surface="ios"] .bvs-app-stage {
        color: #f7f7f6;
        padding-inline-start: env(safe-area-inset-left, 0px);
        padding-inline-end: env(safe-area-inset-right, 0px);
      }
      html[data-bvs-app-surface="ios"] [data-now-playing-shell="true"] > div {
        padding-left: max(1rem, env(safe-area-inset-left, 0px));
        padding-right: max(1rem, env(safe-area-inset-right, 0px));
      }
      html[data-bvs-app-surface="ios"] .bvs-app-stage :is(h1, h2) {
        font-weight: 800; letter-spacing: -.045em;
      }
      /* Square content surfaces; preserve round avatars and transport icons. */
      html[data-bvs-app-surface="ios"] .bvs-app-stage :is(section, article)[class*="rounded-"],
      html[data-bvs-app-surface="ios"] .bvs-app-stage :is(a, button)[class*="rounded-"]:not(.rounded-full),
      html[data-bvs-app-surface="ios"] .bvs-app-stage .bvs-home-accent-card,
      html[data-bvs-app-surface="ios"] .bvs-app-stage .bvs-studio-work-card {
        border-radius: .35rem !important; box-shadow: none;
      }
      html[data-bvs-app-surface="ios"] .bvs-app-stage :is(section, article)[class*="border-white"] {
        border-color: rgb(255 255 255 / .16);
      }
      /* Lime for Home, lilac for Feed and BeatStore, ice for Studio/Discover. */
      html[data-bvs-app-surface="ios"] .bvs-square-home [data-home-accent="feed"] {
        border-left: 3px solid #c1a7ff;
        background: linear-gradient(100deg, rgb(193 167 255 / .09), #141518 65%);
      }
      html[data-bvs-app-surface="ios"] .bvs-square-feed .bvs-feed-lane[aria-pressed="true"] {
        background: rgb(193 167 255 / .14);
        border-color: rgb(193 167 255 / .45); color: #d7c9ff;
      }
      html[data-bvs-app-surface="ios"] .bvs-square-feed .bvs-section-label { color: #c1a7ff; }
      /* Editorial accent bands reflect the updated web design without sharing
         global CSS with web or Android. */
      html[data-bvs-app-surface="ios"] .bvs-square-discover .bvs-discover-music-card,
      html[data-bvs-app-surface="ios"] .bvs-square-discover .bvs-discover-rail > a {
        border-left: 2px solid rgb(163 219 255 / .55);
        background-color: #151a1e;
      }
      html[data-bvs-app-surface="ios"] .bvs-native-studio :is(
        .bvs-studio-role, .bvs-studio-release-path, .bvs-studio-work-card, .bvs-studio-accent-card
      ) {
        border-left: 3px solid rgb(163 219 255 / .62);
        border-radius: .35rem;
        background-color: #151a1f;
      }
      html[data-bvs-app-surface="ios"] .bvs-square-library .bvs-library-accent-card {
        border-left: 2px solid rgb(193 255 82 / .45);
      }
      html[data-bvs-app-surface="ios"] .bvs-square-marketplace .bvs-marketplace-provider-card {
        border-left: 2px solid rgb(193 255 82 / .45);
        border-radius: .35rem;
      }
      html[data-bvs-app-surface="ios"] .bvs-app-stage [data-bvs-culture="station"] {
        border-left: 3px solid #c1ff52; background: #171a17;
      }
      html[data-bvs-app-surface="ios"] [data-bvs-header],
      html[data-bvs-app-surface="ios"] .bvs-app-bottom-nav {
        background: rgb(13 14 16 / .97); border-color: rgb(255 255 255 / .15);
      }
      html[data-bvs-app-surface="ios"] .bvs-persistent-player {
        border-radius: .45rem .45rem 0 0 !important;
        background: rgb(24 25 26 / .98);
      }
      html[data-bvs-app-surface="ios"] .bvs-persistent-player-inner { touch-action: pan-y pinch-zoom; }
      html[data-bvs-app-surface="ios"] .bvs-app-stage :is(input, textarea, select) { border-radius: .3rem; }
    `}</style>
  );
}
