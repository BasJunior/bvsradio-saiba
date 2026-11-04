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
      html[data-bvs-app-surface="ios"] .bvs-app-stage { color: #f7f7f6; }
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
