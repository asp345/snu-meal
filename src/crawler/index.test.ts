import assert from "node:assert/strict";
import test from "node:test";
import type { Payload } from "../model.js";
import { collectCrawlResults } from "./index.js";

function payload(restaurant: string): Payload {
  return {
    restaurant,
    date: "2026-07-23",
    type: "LU",
    meals: [{ price: 5000, no_meat: false, menus: ["Menu"] }],
  };
}

test("crawler failures warn without discarding successful results", async () => {
  const warnings: Array<{ source: string; error: unknown }> = [];
  const result = await collectCrawlResults(
    {
      snuco: Promise.resolve([payload("SNUCO")]),
      snudorm: Promise.reject(new Error("HTTP 503")),
      vet: Promise.resolve([payload("VET")]),
    },
    (source, error) => warnings.push({ source, error }),
  );

  assert.deepEqual(
    result.payloads.map(({ restaurant }) => restaurant),
    ["SNUCO", "VET"],
  );
  assert.deepEqual(result.sourceCounts, { snuco: 1, snudorm: 0, vet: 1 });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].source, "snudorm");
  assert.match(String(warnings[0].error), /HTTP 503/);
});

test("crawl collection fails when every crawler fails", async () => {
  const warnings: string[] = [];
  await assert.rejects(
    collectCrawlResults(
      {
        snuco: Promise.reject(new Error("SNUCO unavailable")),
        snudorm: Promise.reject(new Error("SNUDORM unavailable")),
        vet: Promise.reject(new Error("VET unavailable")),
      },
      (source) => warnings.push(source),
    ),
    /All meal crawlers failed/,
  );
  assert.deepEqual(warnings, ["snuco", "snudorm", "vet"]);
});
