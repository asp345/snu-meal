import assert from "node:assert/strict";
import test from "node:test";
import { generalize301 } from "./snuco.js";

test("301 OR options expand as a cartesian product", () => {
  const [payload] = generalize301([{
    type: "LU",
    lines: ["<식사>", "A OR B, C OR D : 6,000원"],
  }]);
  assert.equal(payload.restaurant, "301동식당 일반");
  assert.deepEqual(payload.meals.map(({ menus }) => menus), [
    ["A", "C"],
    ["A", "D"],
    ["B", "C"],
    ["B", "D"],
  ]);
});
