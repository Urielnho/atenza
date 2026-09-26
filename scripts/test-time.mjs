import assert from "node:assert/strict";
import { formatTime, formatDate, formatRecordDate } from "../src/lib/time.ts";

// UTC midnight still belongs to the previous calendar day in Hermosillo.
assert.equal(formatTime("2026-09-25T00:30:00Z"), "17:30");
assert.match(formatRecordDate("2026-09-25T00:30:00Z"), /24\/09\/2026.*17:30/);
assert.match(formatDate("2026-09-25T00:30:00Z"), /24/);
assert.equal(formatTime("2026-09-25T07:00:00Z"), "00:00");
// Sonora must not follow summer time used by other locations.
assert.equal(formatTime("2026-01-15T15:00:00Z"), "08:00");
assert.equal(formatTime("2026-07-15T15:00:00Z"), "08:00");
assert.equal(formatTime("2026-09-25T10:30:00+03:00"), "00:30");
console.log(
  "PASS: Hermosillo, midnight rollover, summer/winter and explicit UTC offsets.",
);
