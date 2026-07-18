import assert from "node:assert/strict";
import test from "node:test";
import type { CrawlResult } from "./model.js";
import { buildExportData } from "./export.js";

test("export data is grouped in meal, building, and registry order", () => {
  const result: CrawlResult = {
    sourceCounts: { snuco: 2, snudorm: 1, vet: 0 },
    payloads: [
      {
        restaurant: "두레미담 식당",
        date: "2026-07-18",
        type: "LU",
        meals: [{ price: 6000, no_meat: false, menus: ["비빔밥"] }],
      },
      {
        restaurant: "학생회관식당",
        date: "2026-07-18",
        type: "BR",
        meals: [{ price: 1000, no_meat: false, menus: ["아침밥"] }],
      },
      {
        restaurant: "3식당 일반",
        date: "2026-07-18",
        type: "LU",
        meals: [{ price: null, no_meat: false, menus: ["백반"] }],
      },
    ],
  };

  const data = buildExportData(result, new Date("2026-07-18T00:00:00.000Z"));
  assert.deepEqual(data.manifest.available_dates, ["2026-07-18"]);
  assert.equal(data.manifest.generated_at, "2026-07-18T00:00:00.000Z");

  const menu = data.menus.get("2026-07-18");
  assert.deepEqual(menu?.types.map(({ type }) => type), ["BR", "LU"]);
  assert.deepEqual(
    menu?.types[1].buildings[0].restaurants.map(({ name }) => name),
    ["두레미담 식당", "3식당 일반"],
  );
});

test("export rejects crawler restaurants outside the registry", () => {
  assert.throws(() => buildExportData({
    sourceCounts: { snuco: 1, snudorm: 0, vet: 0 },
    payloads: [{
      restaurant: "알 수 없는 식당",
      date: "2026-07-18",
      type: "LU",
      meals: [{ price: null, no_meat: false, menus: ["메뉴"] }],
    }],
  }), /Unknown restaurant/);
});
