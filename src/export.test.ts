import assert from "node:assert/strict";
import test from "node:test";
import type { CrawlResult } from "./model.js";
import { buildExportData } from "./export.js";
import { RESTAURANTS } from "./registry.js";

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
  assert.deepEqual(
    menu?.types.map(({ type }) => type),
    ["BR", "LU"],
  );
  assert.deepEqual(
    menu?.types[1].buildings[0].venues.map((venue) => ({
      name: venue.name,
      restaurants: venue.restaurants.map((restaurant) => restaurant.name),
    })),
    [
      { name: "두레미담 (5층)", restaurants: ["식당"] },
      { name: "3식당 (3층)", restaurants: ["일반"] },
    ],
  );
});

test("export separates venues and keeps their counters together", () => {
  const restaurantNames = [
    "두레미담 식당",
    "두레미담 셀프코너",
    "3식당 일반",
    "3식당 든든한끼샐러드코너",
    "4층 푸드코트 서가앤쿡",
    "4층 푸드코트 토끼정",
    "4층 푸드코트 숨쉬는순두부",
    "4층 푸드코트 이공오 돈까스와 우동",
    "301동식당 일반",
    "301동식당 천원의아침밥",
    "301동식당 TAKE-OUT",
    "301동 1층 교직원전용식당",
    "220동식당 경성 돈카츠",
    "220동식당 바비든든",
    "220동식당 포포420",
    "220동식당 값찌개",
    "220동식당 키친101",
  ];
  const data = buildExportData({
    sourceCounts: { snuco: restaurantNames.length, snudorm: 0, vet: 0 },
    payloads: restaurantNames.map((restaurant) => ({
      restaurant,
      date: "2026-07-18",
      type: "LU",
      meals: [{ price: null, no_meat: false, menus: ["메뉴"] }],
    })),
  });

  const buildings = data.menus.get("2026-07-18")?.types[0].buildings;
  const venues = (buildingNumber: string) =>
    buildings
      ?.find((building) => building.building_number === buildingNumber)
      ?.venues.map((venue) => ({
        name: venue.name,
        restaurants: venue.restaurants.map((restaurant) => restaurant.name),
      }));

  assert.deepEqual(venues("75-1동"), [
    { name: "두레미담 (5층)", restaurants: ["식당", "셀프코너"] },
    { name: "3식당 (3층)", restaurants: ["일반", "든든한끼샐러드코너"] },
    {
      name: "푸드코트 (4층)",
      restaurants: ["서가앤쿡", "토끼정", "숨쉬는순두부", "이공오 돈까스와 우동"],
    },
  ]);
  assert.deepEqual(venues("301동"), [
    { name: "301동식당 (B1층)", restaurants: ["일반", "천원의아침밥", "TAKE-OUT"] },
    { name: "교직원전용식당", restaurants: ["1층"] },
  ]);
  assert.deepEqual(venues("220동"), [
    {
      name: "구시아 푸드코트",
      restaurants: ["경성 돈카츠", "바비든든", "포포420", "값찌개", "키친101"],
    },
  ]);
});

test("fixed menu classification distinguishes daily counters", () => {
  const restaurants = new Map(RESTAURANTS.map((restaurant) => [restaurant.name, restaurant]));
  assert.equal(restaurants.get("두레미담 식당")?.fixed_menu, true);
  assert.equal(restaurants.get("두레미담 셀프코너")?.fixed_menu, false);
  assert.equal(restaurants.get("공대간이식당")?.fixed_menu, true);
});

test("export rejects crawler restaurants outside the registry", () => {
  assert.throws(
    () =>
      buildExportData({
        sourceCounts: { snuco: 1, snudorm: 0, vet: 0 },
        payloads: [
          {
            restaurant: "알 수 없는 식당",
            date: "2026-07-18",
            type: "LU",
            meals: [{ price: null, no_meat: false, menus: ["메뉴"] }],
          },
        ],
      }),
    /Unknown restaurant/,
  );
});
