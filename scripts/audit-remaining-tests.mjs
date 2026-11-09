import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const catalogue = read("src/components/editorial/EditorialCatalogueNormalizer.tsx");
assert.match(catalogue, /items\.slice\(0, visibleCount\)/, "the catalogue must render one page at a time");
assert.match(catalogue, /setFilter\(value\); setVisibleCount\(CATALOGUE_PAGE_SIZE\)/, "changing filter must return to the first page");

const review = read("src/app/editorial/marketplace/page.tsx");
assert.match(review, /useState<ReviewFilter>\("submitted"\)/, "review starts on work that is waiting");
assert.match(review, /review === "submitted" \? 1 : -1/, "waiting work is oldest first");

const release = read("src/components/ReleaseSubmitForm.tsx");
assert.match(release, /if \(step < LAST_RELEASE_STEP\) \{\s*goToStep\(step \+ 1\)/, "only the last step can submit");
for (const step of [0, 1, 2, 3]) assert.match(release, new RegExp(`hidden=\\{step !== ${step}\\}`), `step ${step} stays mounted so entries are kept`);
assert.match(release, /htmlFor="release-audio"/, "the audio field needs a real label");
assert.match(release, /htmlFor="release-cover"/, "the cover field needs a real label");
assert.match(release, /aria-label=\{`Track \$\{i \+ 1\} title`\}/, "track titles need names");

assert.match(read("src/app/globals.css"), /max-width: 767px\) \{\s*input:not\(\[type="checkbox"\]\)[^}]*font-size: 16px/, "phone fields must not trigger iOS zoom");
assert.match(read("src/components/flow/BvsObjectCard.tsx"), /aria-label=\{`Open \$\{object\.title\}`\}/, "feed artwork links need names");
assert.match(read("src/components/VisitorAssistant.tsx"), /sr-only sm:not-sr-only/, "Ask BVS is compact on phones");
assert.match(read("src/components/home/HomeTopFive.tsx"), /grid h-11 w-11 place-items-center/, "chart dots need a 44px target");

console.log("Audit fixes: catalogue paging, review queue, release steps, labels, zoom and tap targets passed.");
