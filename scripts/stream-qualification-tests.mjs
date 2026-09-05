import assert from "node:assert/strict";

const {
  accumulateListening,
  createQualificationState,
  QUALIFIED_STREAM_SECONDS,
} = await import("../src/lib/stream-qualification.ts");

const steady = createQualificationState("00000000-0000-4000-8000-000000000001", 0, 0);
for (let second = 1; second <= QUALIFIED_STREAM_SECONDS; second += 1) {
  accumulateListening(steady, second, second * 1000);
}
assert.equal(steady.qualified, true);
assert.equal(steady.listenedSeconds, QUALIFIED_STREAM_SECONDS);

const seek = createQualificationState("00000000-0000-4000-8000-000000000002", 0, 0);
accumulateListening(seek, 1, 1000);
accumulateListening(seek, 31, 2000);
assert.equal(seek.qualified, false);
assert.equal(seek.listenedSeconds, 1);

const suspended = createQualificationState("00000000-0000-4000-8000-000000000003", 0, 0);
accumulateListening(suspended, 1, 1000);
accumulateListening(suspended, 20, 20_000);
assert.equal(suspended.listenedSeconds, 1);

const rewind = createQualificationState("00000000-0000-4000-8000-000000000004", 10, 0);
accumulateListening(rewind, 5, 1000);
assert.equal(rewind.listenedSeconds, 0);

console.log("Stream qualification checks passed");
