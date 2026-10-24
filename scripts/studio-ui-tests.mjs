import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");

const css = read("src/app/section-accents.css");
const studioHome = read("src/app/creator/studio/page.tsx");
const manage = read("src/app/creator/studio/manage/page.tsx");
const shell = read("src/components/StudioProductionShell.tsx");
const beats = read("src/components/MyBeatStore.tsx");
const money = read("src/components/StudioMoneySummary.tsx");
const orders = read("src/components/CreatorServiceOrders.tsx");
const payouts = read("src/app/creator/studio/payouts/page.tsx");
const editorialNav = read("src/components/EditorialWorkspaceNav.tsx");
const editorialPayouts = read("src/app/admin/editorial/finance/payouts/page.tsx");

for (const accent of ["core", "beats", "marketplace", "insights", "shows", "money"]) {
  assert(css.includes(`[data-studio-accent="${accent}"]`), `Studio palette includes ${accent}`);
}
assert(css.includes(".bvs-studio-accent-button"), "Studio has shared accent buttons");
assert(css.includes(".bvs-studio-panel[data-state=\"open\"]"), "open Studio panels get restrained semantic borders");

assert(studioHome.includes('accent: "beats"'), "Beat creation uses BeatStore purple");
assert(studioHome.includes('accent: "marketplace"'), "service creation uses Marketplace green");
assert(studioHome.includes('accent="money"'), "management shortcuts expose money accent");

assert(manage.includes('accent="core"'), "release management uses core Studio blue");
assert(manage.includes('accent="insights"'), "insight/editorial sections use teal");
assert(manage.includes('accent="shows"'), "show tools use rose");
assert(manage.includes('accent="marketplace"'), "business sections use green");
assert(manage.includes('accent="money"'), "Premium/money surfaces use gold");
assert(!manage.includes('aria-label="Studio sections"'), "duplicate overview section navigation stays removed");
assert(manage.includes('className="bvs-studio-panel mt-5'), "accordion spacing stays compact");

assert(!shell.includes('label: "Artwork"'), "persistent Studio nav stays focused");
assert(shell.includes('label: "New release"'), "persistent nav keeps direct creation path");
assert(shell.includes('label: "New beat"'), "persistent nav keeps BeatStore creation path");
assert(shell.includes('data-studio-accent={item.accent}'), "persistent nav follows semantic accents");

assert(beats.includes('data-studio-accent="beats"'), "BeatStore surface uses purple identity");
assert(beats.includes('data-studio-accent="insights"'), "Beat review conversation uses teal");
assert(beats.includes("border-amber-400/40"), "capacity warnings keep warning semantics");
assert(money.includes('data-studio-accent="money"'), "wallet summary keeps money identity");
assert(money.includes('href="/creator/studio/payouts"'), "Studio money summary exposes the dedicated payout path");
assert(orders.includes('data-studio-accent="marketplace"'), "service orders keep marketplace identity");

assert(payouts.includes("fetch('/api/artist/payouts'"), "creator payout workspace uses protected payout API");
assert(payouts.includes("fetch('/api/artist/payout-methods'"), "creator payout workspace uses protected method API");
assert(payouts.includes('Reserved for payouts'), "creator payout workspace explains reserved balance");
assert(payouts.includes('Withdrawable now'), "creator payout workspace shows actual withdrawable balance");
assert(!payouts.includes('bank_transfer'), "creator payout form does not collect raw bank-account paths before encrypted storage exists");
assert(editorialNav.includes('href="/admin/editorial/finance/payouts"'), "Editorial workspace exposes payout queue navigation");
assert(editorialPayouts.includes("fetch('/api/admin/editorial/payouts'"), "Editorial payout queue uses protected staff API");
assert(editorialPayouts.includes('Mark paid + post debit'), "Editorial payout queue makes final ledger posting explicit");
assert(editorialPayouts.includes('External payment reference'), "Editorial payout queue requires a real transfer reference before paid");

console.log("studio UI regression checks passed");
