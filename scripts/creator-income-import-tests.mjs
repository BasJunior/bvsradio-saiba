import assert from "node:assert/strict";
import {
  amuseRoyaltyCsvEntries,
  incomeEntriesFromCsv,
  normalisedCsvEntries,
} from "../src/lib/income-statement-import.ts";

const normalised = normalisedCsvEntries(`source_category,provider_name,net_amount,currency,status,date,reference
publishing,ZIMURA,40.00,USD,received,2026-08-26,ZIM-001
`);

assert.equal(normalised.length, 1);
assert.equal(normalised[0].sourceCategory, "publishing");
assert.equal(normalised[0].providerName, "ZIMURA");
assert.equal(normalised[0].netAmount, "40");
assert.equal(normalised[0].occurredAt, "2026-08-26");

const amuse = amuseRoyaltyCsvEntries(`Reporting Month,Store,Country,Track Title,Release Title,ISRC,UPC,Currency,Net Royalties
2026-07,Spotify,ZW,"Danda, Radio Edit",Danda,ZWABC2600001,123456789012,USD,8.12
2026-07,Apple Music,ZA,Danda,Danda,ZWABC2600001,123456789012,USD,5.43
`, "amuse-july.csv");

assert.equal(amuse.length, 2);
assert.equal(amuse[0].sourceCategory, "streaming_master");
assert.equal(amuse[0].providerName, "Amuse");
assert.equal(amuse[0].status, "reported");
assert.equal(amuse[0].periodStart, "2026-07-01");
assert.equal(amuse[0].periodEnd, "2026-07-31");
assert.equal(amuse[0].occurredAt, "2026-07-31");
assert.equal(amuse[0].territory, "ZW");
assert.equal(amuse[0].statementName, "amuse-july.csv");
assert.match(amuse[0].externalReference || "", /^amuse\|2026-07-01\|2026-07-31\|Spotify\|ZW\|ZWABC2600001/);
assert.equal(amuse[1].netAmount, "5.43");

const explicitReference = incomeEntriesFromCsv(`Period,Service,Territory,Title,Currency,Royalty,Reference
August 2026,YouTube,US,Danda,USD,3.29,AMUSE-ROW-3
`, "amuse")[0];
assert.equal(explicitReference.externalReference, "AMUSE-ROW-3");
assert.equal(explicitReference.periodStart, "2026-08-01");
assert.equal(explicitReference.periodEnd, "2026-08-31");

assert.throws(
  () => amuseRoyaltyCsvEntries(`Month,Store,Currency,Net Royalties
2026-07,Spotify,USD,-0.50
`),
  /Negative statement rows/,
);

console.log("creator income import contract: ok");
