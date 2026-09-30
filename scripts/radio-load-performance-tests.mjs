import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const radioPage = await readFile(new URL("../src/app/radio/page.tsx", import.meta.url), "utf8");
const programmeSections = await readFile(new URL("../src/components/radio/RadioProgrammeSections.tsx", import.meta.url), "utf8");

assert.ok(
  radioPage.includes('import { Suspense } from "react"') &&
    radioPage.includes("<RadioProgrammeSections />"),
  "Radio programme sections must stream behind Suspense.",
);

assert.ok(
  !radioPage.includes("await getPublicProgrammes()") &&
    !radioPage.includes('from "@/lib/station-content"') &&
    programmeSections.includes("const shows = await getPublicProgrammes()"),
  "Remote programme data must not block the Radio page shell.",
);

assert.ok(
  radioPage.indexOf("<RadioPlayer />") < radioPage.indexOf("<Suspense"),
  "The critical Radio player must render before programme data resolves.",
);

assert.ok(
  programmeSections.includes('id="radio-coming-up"') &&
    programmeSections.includes('id="radio-shows"') &&
    programmeSections.includes("shouldBypassImageOptimizer(show.image)"),
  "Streaming must preserve the station clock, show cards and safe image boundary.",
);

console.log("radio load performance gates passed");
