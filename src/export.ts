import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { crawlAll } from "./crawler/index.js";
import { MEAL_TYPES, type CrawlResult, type Meal, type MealType, type Payload } from "./model.js";
import { findRestaurant, RESTAURANTS } from "./registry.js";

interface ExportRestaurant {
  code: string;
  name: string;
  fixed_menu: boolean;
  meals: Meal[];
}

interface ExportBuilding {
  building_number: string;
  building_name: string | null;
  restaurants: ExportRestaurant[];
}

interface DateMenu {
  date: string;
  types: Array<{
    type: MealType;
    buildings: ExportBuilding[];
  }>;
}

export interface ExportData {
  manifest: {
    schema_version: 1;
    generated_at: string;
    available_dates: string[];
    sources: CrawlResult["sourceCounts"];
  };
  restaurants: {
    schema_version: 1;
    restaurants: typeof RESTAURANTS;
  };
  menus: Map<string, DateMenu>;
}

function validateRegistry(): void {
  const codes = new Set<string>();
  const names = new Set<string>();
  for (const restaurant of RESTAURANTS) {
    if (codes.has(restaurant.code)) throw new Error(`Duplicate restaurant code: ${restaurant.code}`);
    if (names.has(restaurant.name)) throw new Error(`Duplicate restaurant name: ${restaurant.name}`);
    codes.add(restaurant.code);
    names.add(restaurant.name);
  }
}

function validatePayload(payload: Payload, slots: Set<string>): void {
  if (!findRestaurant(payload.restaurant)) {
    throw new Error(`Unknown restaurant in crawler output: ${payload.restaurant}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error(`Invalid menu date: ${payload.date}`);
  }
  if (!MEAL_TYPES.includes(payload.type)) {
    throw new Error(`Invalid meal type: ${String(payload.type)}`);
  }
  if (!payload.meals.length) {
    throw new Error(`Empty meal payload: ${payload.restaurant}, ${payload.date}, ${payload.type}`);
  }
  for (const meal of payload.meals) {
    if (!meal.menus.length || meal.menus.some((menu) => !menu.trim())) {
      throw new Error(`Empty menu name: ${payload.restaurant}, ${payload.date}, ${payload.type}`);
    }
    if (meal.price !== null && (!Number.isSafeInteger(meal.price) || meal.price < 0)) {
      throw new Error(`Invalid meal price: ${payload.restaurant}, ${payload.date}, ${payload.type}`);
    }
  }

  const slot = `${payload.restaurant}\u0000${payload.date}\u0000${payload.type}`;
  if (slots.has(slot)) {
    throw new Error(`Duplicate meal payload slot: ${payload.restaurant}, ${payload.date}, ${payload.type}`);
  }
  slots.add(slot);
}

function buildDateMenu(date: string, payloads: Payload[]): DateMenu {
  const bySlot = new Map(payloads.map((payload) => [
    `${payload.restaurant}\u0000${payload.type}`,
    payload,
  ]));

  const types = MEAL_TYPES.flatMap((type) => {
    const buildings = new Map<string, ExportBuilding>();
    for (const restaurant of RESTAURANTS) {
      const payload = bySlot.get(`${restaurant.name}\u0000${type}`);
      if (!payload) continue;

      const buildingKey = `${restaurant.building_number}\u0000${restaurant.building_name ?? ""}`;
      let building = buildings.get(buildingKey);
      if (!building) {
        building = {
          building_number: restaurant.building_number,
          building_name: restaurant.building_name,
          restaurants: [],
        };
        buildings.set(buildingKey, building);
      }
      building.restaurants.push({
        code: restaurant.code,
        name: restaurant.name,
        fixed_menu: restaurant.fixed_menu,
        meals: payload.meals,
      });
    }
    return buildings.size ? [{ type, buildings: [...buildings.values()] }] : [];
  });

  return { date, types };
}

export function buildExportData(result: CrawlResult, generatedAt = new Date()): ExportData {
  validateRegistry();
  for (const [source, count] of Object.entries(result.sourceCounts)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Invalid ${source} source count: ${count}`);
    }
  }

  const slots = new Set<string>();
  const payloadsByDate = new Map<string, Payload[]>();
  for (const payload of result.payloads) {
    validatePayload(payload, slots);
    const datePayloads = payloadsByDate.get(payload.date);
    if (datePayloads) datePayloads.push(payload);
    else payloadsByDate.set(payload.date, [payload]);
  }

  const availableDates = [...payloadsByDate.keys()].sort();
  return {
    manifest: {
      schema_version: 1,
      generated_at: generatedAt.toISOString(),
      available_dates: availableDates,
      sources: result.sourceCounts,
    },
    restaurants: {
      schema_version: 1,
      restaurants: RESTAURANTS,
    },
    menus: new Map(availableDates.map((date) => [
      date,
      buildDateMenu(date, payloadsByDate.get(date) ?? []),
    ])),
  };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeExport(outputPath: string, data: ExportData): Promise<void> {
  const output = resolve(outputPath);
  const parent = dirname(output);
  const suffix = `${process.pid}-${randomUUID()}`;
  const temporary = join(parent, `.${basename(output)}.tmp-${suffix}`);
  const backup = join(parent, `.${basename(output)}.old-${suffix}`);
  let movedPreviousOutput = false;

  await mkdir(join(temporary, "menus"), { recursive: true });
  try {
    await Promise.all([
      writeFile(join(temporary, "manifest.json"), json(data.manifest)),
      writeFile(join(temporary, "restaurants.json"), json(data.restaurants)),
      ...[...data.menus].map(([date, menu]) =>
        writeFile(join(temporary, "menus", `${date}.json`), json(menu))
      ),
    ]);

    try {
      await rename(output, backup);
      movedPreviousOutput = true;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }

    try {
      await rename(temporary, output);
    } catch (error) {
      if (movedPreviousOutput) await rename(backup, output);
      throw error;
    }
    if (movedPreviousOutput) await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function outputArgument(args: string[]): string {
  if (args.length === 0) return "public/data";
  if (args.length === 2 && (args[0] === "--output" || args[0] === "-o") && args[1]) {
    return args[1];
  }
  if (args.length === 1 && args[0].startsWith("--output=") && args[0].slice(9)) {
    return args[0].slice(9);
  }
  throw new Error("Usage: node dist/crawl.mjs [--output <directory>]");
}

async function main(): Promise<void> {
  const output = outputArgument(process.argv.slice(2));
  const result = await crawlAll();
  const data = buildExportData(result);
  await writeExport(output, data);
  console.log(
    `Exported ${data.manifest.available_dates.length} dates to ${resolve(output)} `
    + `(snuco=${result.sourceCounts.snuco}, snudorm=${result.sourceCounts.snudorm}, vet=${result.sourceCounts.vet})`,
  );
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entryPoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
