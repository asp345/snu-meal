import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { CrawlResult, Payload } from "./model.js";
import { buildExportData, combinePayloads, loadExistingPayloads } from "./export.js";
import { RESTAURANTS } from "./registry.js";

test("export data is grouped in meal, building, and registry order", () => {
  const result: CrawlResult = {
    sourceCounts: { snuco: 2, snudorm: 1, vet: 0 },
    failedSources: [],
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
    failedSources: [],
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
    { name: "삼성웰스토리", restaurants: ["일반", "천원의아침밥", "TAKE-OUT"] },
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
        failedSources: [],
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

async function writeOldMenu(
  menusDir: string,
  date: string,
  restaurant: { code: string; name: string; menus: string[] },
): Promise<void> {
  await writeFile(
    join(menusDir, `${date}.json`),
    JSON.stringify({
      date,
      types: [
        {
          type: "LU",
          buildings: [
            {
              building_number: "85동",
              venues: [
                {
                  name: null,
                  restaurants: [
                    {
                      code: restaurant.code,
                      name: restaurant.name,
                      fixed_menu: false,
                      meals: [{ price: null, no_meat: false, menus: restaurant.menus }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  );
}

test("failed sources carry existing payloads into the new export", async () => {
  const dir = await mkdtemp(join(tmpdir(), "snu-meal-test-"));
  try {
    const menusDir = join(dir, "menus");
    await mkdir(menusDir, { recursive: true });
    await writeOldMenu(menusDir, "2026-07-20", {
      code: "vet",
      name: "수의대식당",
      menus: ["소불고기덮밥"],
    });

    const fresh: Payload[] = [
      {
        restaurant: "수의대식당",
        date: "2026-07-21",
        type: "LU",
        meals: [{ price: null, no_meat: false, menus: ["제육볶음"] }],
      },
    ];
    const existing = await loadExistingPayloads(dir, new Date("2026-07-21T00:00:00.000Z"));
    const data = buildExportData({
      payloads: combinePayloads(fresh, existing, ["vet"]),
      sourceCounts: { snuco: 0, snudorm: 0, vet: 1 },
      failedSources: ["vet"],
    });

    assert.deepEqual(data.manifest.available_dates, ["2026-07-20", "2026-07-21"]);
    assert.deepEqual(
      data.menus.get("2026-07-20")?.types[0].buildings[0].venues[0].restaurants[0].meals,
      [{ price: null, no_meat: false, menus: ["소불고기덮밥"] }],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("successful sources refresh overlapping dates and bad files are skipped", async () => {
  const dir = await mkdtemp(join(tmpdir(), "snu-meal-test-"));
  try {
    const menusDir = join(dir, "menus");
    await mkdir(menusDir, { recursive: true });
    await writeOldMenu(menusDir, "2026-07-21", {
      code: "vet",
      name: "수의대식당",
      menus: ["옛날메뉴"],
    });
    await writeOldMenu(menusDir, "2026-07-22", {
      code: "removed",
      name: "사라진식당",
      menus: ["메뉴"],
    });
    await writeOldMenu(menusDir, "2026-06-15", {
      code: "vet",
      name: "수의대식당",
      menus: ["창고메뉴"],
    });
    await writeFile(join(menusDir, "2026-07-23.json"), "{ not json");

    const fresh: Payload[] = [
      {
        restaurant: "수의대식당",
        date: "2026-07-21",
        type: "LU",
        meals: [{ price: null, no_meat: false, menus: ["오늘메뉴"] }],
      },
    ];
    const existing = await loadExistingPayloads(dir, new Date("2026-07-21T00:00:00.000Z"));
    const data = buildExportData({
      payloads: combinePayloads(fresh, existing, []),
      sourceCounts: { snuco: 0, snudorm: 0, vet: 1 },
      failedSources: [],
    });

    assert.deepEqual(data.manifest.available_dates, ["2026-07-21"]);
    assert.deepEqual(
      data.menus.get("2026-07-21")?.types[0].buildings[0].venues[0].restaurants[0].meals,
      [{ price: null, no_meat: false, menus: ["오늘메뉴"] }],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("combine keeps fresh payloads and carries only failed sources", () => {
  const fresh: Payload[] = [
    {
      restaurant: "학생회관식당",
      date: "2026-07-21",
      type: "LU",
      meals: [{ price: 6000, no_meat: false, menus: ["비빔밥"] }],
    },
  ];
  const existing: Payload[] = [
    {
      restaurant: "학생회관식당",
      date: "2026-07-21",
      type: "LU",
      meals: [{ price: 5000, no_meat: false, menus: ["옛날메뉴"] }],
    },
    {
      restaurant: "아워홈",
      date: "2026-07-21",
      type: "LU",
      meals: [{ price: 6000, no_meat: false, menus: ["유지메뉴"] }],
    },
    {
      restaurant: "수의대식당",
      date: "2026-07-21",
      type: "LU",
      meals: [{ price: null, no_meat: false, menus: ["버려지는메뉴"] }],
    },
  ];

  assert.deepEqual(combinePayloads(fresh, existing, ["snuco", "snudorm"]), [fresh[0], existing[1]]);
});
