// Run against a locally served app with agent-browser eval --stdin.
// Assertions use rendered geometry and hit testing, not source text.
(() => {
  const root = document.documentElement;
  const select = (selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
  };
  const player = select("[data-bvs-player]");
  const nav = select("[data-bvs-bottom-nav]");
  const header = select("[data-bvs-header]");
  const main = select("[data-bvs-main]");
  const p = player.getBoundingClientRect();
  const n = nav.getBoundingClientRect();
  const h = header.getBoundingClientRect();
  const errors = [];
  if (n.height && p.bottom > n.top + 1) errors.push("Player overlaps tab bar");
  if (document.querySelectorAll("[data-bvs-header]").length !== 1) errors.push("Duplicate header");
  if (parseFloat(getComputedStyle(main).paddingTop) < h.height) errors.push("Header space not reserved");
  if (parseFloat(getComputedStyle(main).paddingBottom) < p.height + n.height) errors.push("Bottom space not reserved");
  for (const link of nav.querySelectorAll("a")) {
    if (!n.height) break;
    const r = link.getBoundingClientRect();
    if (r.height < 44) errors.push("Tab target smaller than 44px");
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!link.contains(hit)) errors.push(`Covered tab: ${link.textContent.trim()}`);
  }
  if (root.scrollWidth > innerWidth + 1) errors.push("Horizontal overflow");
  if (errors.length) throw new Error(errors.join("; "));
  return { result: "PASS", path: location.pathname, viewport: [innerWidth, innerHeight], header: h.height, nav: n.height, player: p.height, playerBottom: p.bottom, navTop: n.top };
})();
