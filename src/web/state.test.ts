import assert from "node:assert/strict";
import test from "node:test";
import { dateFromIso, initialMealType, localIsoDate } from "./state.js";

test("KST date helpers", () => {
  assert.equal(localIsoDate(new Date("2026-07-20T15:00:00.000Z")), "2026-07-21");
  assert.deepEqual(dateFromIso("2026-07-21"), new Date(2026, 6, 21));
});

test("initial meal type follows KST hours", () => {
  assert.equal(initialMealType(new Date("2026-07-20T00:30:00.000Z")), "BR");
  assert.equal(initialMealType(new Date("2026-07-20T01:00:00.000Z")), "LU");
  assert.equal(initialMealType(new Date("2026-07-20T07:00:00.000Z")), "DN");
});
