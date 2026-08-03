/**
 * Focused pure-logic tests for Apple-compliance rights helpers.
 * No network, no secrets, no production mutation.
 */
import assert from "node:assert/strict";
import {
  ACTIVE_RIGHTS_AGREEMENT_VERSION,
  allAttestationFlagsTrue,
  clearanceBlockers,
  clearanceItemSatisfies,
  customerSafeComplaintError,
  generateDocketNumber,
  isStaffComplaintTransition,
  materialFlagsNeedClearance,
  requiredMaterialTypes,
  shouldRestrictAccount,
  validateComplaintInput,
} from "../src/lib/rights-compliance.ts";

// Attestation flags
assert.equal(
  allAttestationFlagsTrue({
    masterControl: true,
    compositionControl: true,
    featuredContributorsCleared: true,
    samplesBeatsCleared: true,
    grantHost: true,
    grantStream: true,
    grantCatalogue: true,
    grantPromote: true,
    accuracyConfirmed: true,
  }),
  true,
);
assert.equal(
  allAttestationFlagsTrue({
    masterControl: true,
    compositionControl: true,
    featuredContributorsCleared: true,
    samplesBeatsCleared: true,
    grantHost: true,
    grantStream: true,
    grantCatalogue: true,
    grantPromote: false,
    accuracyConfirmed: true,
  }),
  false,
);

// Clearance
const flags = {
  containsCover: true,
  containsRemix: false,
  containsSamples: true,
  containsLeasedBeats: false,
  containsThirdParty: false,
};
assert.equal(materialFlagsNeedClearance(flags), true);
assert.deepEqual(requiredMaterialTypes(flags), ["cover", "sample"]);
assert.equal(
  clearanceItemSatisfies({
    materialType: "cover",
    status: "submitted",
    licenceOrPermissionRef: "LIC-1",
  }),
  true,
);
assert.equal(
  clearanceItemSatisfies({
    materialType: "cover",
    status: "draft",
    licenceOrPermissionRef: "LIC-1",
  }),
  false,
);
assert.deepEqual(
  clearanceBlockers(flags, [
    { materialType: "cover", status: "submitted", licenceOrPermissionRef: "LIC-1" },
  ]),
  ["CLEARANCE_SAMPLE_EVIDENCE_REQUIRED"],
);
assert.deepEqual(
  clearanceBlockers(flags, [
    { materialType: "cover", status: "submitted", licenceOrPermissionRef: "LIC-1" },
    { materialType: "sample", status: "accepted", documentStoragePath: "clearance/u/x.pdf" },
  ]),
  [],
);

// Complaints validation
assert.equal(
  validateComplaintInput({
    claimantName: "A",
    claimantEmail: "bad",
    workTitle: "Song",
    statement: "short",
    allegedlyInfringingUrls: [],
    goodFaithDeclaration: true,
    accuracyDeclaration: true,
    authorityDeclaration: true,
    signatureName: "A",
  }).ok,
  false,
);
assert.equal(
  validateComplaintInput({
    claimantName: "Ada Rights",
    claimantEmail: "ada@example.com",
    workTitle: "My Song",
    statement: "This track uses my composition without permission.",
    allegedlyInfringingUrls: ["https://bvsradio.com/catalogue?q=test"],
    goodFaithDeclaration: true,
    accuracyDeclaration: true,
    authorityDeclaration: true,
    signatureName: "Ada Rights",
  }).ok,
  true,
);

const docket = generateDocketNumber(new Date("2026-08-03T12:00:00Z"), "ABCD1234");
assert.equal(docket, "BVS-CR-20260803-ABCD1234");

assert.equal(isStaffComplaintTransition("received", "hold_applied"), true);
assert.equal(isStaffComplaintTransition("withdrawn", "under_review"), false);
assert.equal(shouldRestrictAccount(2, 3), false);
assert.equal(shouldRestrictAccount(3, 3), true);

const safe = customerSafeComplaintError("relation copyright_complaints does not exist");
assert.equal(safe.includes("does not exist"), false);
assert.ok(safe.length > 10);

assert.equal(ACTIVE_RIGHTS_AGREEMENT_VERSION.startsWith("BVS-RIGHTS-ATTEST-"), true);

console.log("Rights compliance pure tests passed");
