import { load, type Cheerio } from "cheerio";
import type { Element } from "domhandler";
import type { Meal, MealType, Payload } from "../model.js";
import {
  OPTIONAL_COLON_PRICE_RE,
  PRICE_RE,
  SECTION_RE,
  SPLIT_PLUS_RE,
  SPLIT_RE,
  expandOrOptionMeals,
  groupedPayloads,
  normalizeLine,
  normalizeNames,
  parsePriceLine,
  pushMeal,
  sectionKey,
  type GeneralizedMeals,
  type MealCell,
} from "./common.js";
import { fetchText, SNU_BROWSER_USER_AGENT } from "./http.js";

const BASE_URL = "https://snuco.snu.ac.kr/foodmenu/";
const EXCLUDED_RESTAURANTS = new Set(["기숙사식당", "버거운버거"]);

type Generalizer = (cells: MealCell[]) => GeneralizedMeals[];

interface Cafeteria {
  restaurant: string;
  generalize: Generalizer;
}

interface TextNodeLike {
  type: string;
  data?: string;
  childNodes?: TextNodeLike[];
}

function descendantText(element: Cheerio<Element>): string[] {
  const text: string[] = [];
  const visit = (node: TextNodeLike): void => {
    if (node.type === "text") {
      text.push(node.data ?? "");
      return;
    }
    node.childNodes?.forEach(visit);
  };
  element
    .contents()
    .toArray()
    .forEach((node) => visit(node as TextNodeLike));
  return text;
}

function strippedText(element: Cheerio<Element>, separator: string): string {
  return descendantText(element)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(separator);
}

function cellLines(element: Cheerio<Element>): string[] {
  return descendantText(element)
    .join("\n")
    .replaceAll("\u00a0", " ")
    .split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/)
    .map(normalizeLine)
    .filter(Boolean);
}

function simpleGeneralizer(cells: MealCell[]): GeneralizedMeals[] {
  return cells.flatMap(({ type, lines }) => {
    const meals = lines
      .filter((line) => !line.startsWith("※"))
      .map((line) => parsePriceLine(line))
      .filter((meal): meal is Meal => meal !== undefined);
    return meals.length ? [{ type, meals }] : [];
  });
}

function jahayeon3f(cells: MealCell[]): GeneralizedMeals[] {
  return cells.flatMap(({ type, lines }) => {
    const meals: Meal[] = [];
    const buffetItems: string[] = [];
    let inSemiBuffet = false;
    let buffetNoMeat = false;
    for (const line of lines) {
      if (
        line.startsWith("※") ||
        line.includes("뷔페 특성상") ||
        line.includes("가능성이 있으니")
      ) {
        continue;
      }
      if (line === "<+세미뷔페>") {
        inSemiBuffet = true;
        continue;
      }
      const meal = parsePriceLine(line);
      if (meal) {
        meals.push(meal);
      } else if (inSemiBuffet) {
        if (/\(#\)|\[#\]|#/.test(line)) {
          buffetNoMeat = true;
        }
        buffetItems.push(...normalizeNames(line));
      }
    }
    if (buffetItems.length) meals.push({ price: null, no_meat: buffetNoMeat, menus: buffetItems });
    return meals.length ? [{ type, meals }] : [];
  });
}

function yesul(cells: MealCell[]): GeneralizedMeals[] {
  const sectionRestaurant = (section: string): string | undefined => {
    const key = sectionKey(section);
    if (key.startsWith("직화코너")) return "예술계식당 직화코너";
    return new Map([
      ["A코너", "예술계식당 A코너"],
      ["B코너", "예술계식당 B코너"],
      ["C코너", "예술계식당 C코너"],
    ]).get(key);
  };

  return cells.flatMap(({ type, lines }) => {
    const groups = new Map<string, Meal[]>();
    let restaurant: string | undefined = type === "DN" ? "예술계식당 A코너" : undefined;
    for (let line of lines) {
      if (line.startsWith("※")) continue;
      const section = SECTION_RE.exec(line);
      if (section) {
        restaurant = sectionRestaurant(section[1]);
        line = section[2].trim();
        if (!line) continue;
      }
      if (!restaurant) continue;
      const meal = parsePriceLine(line.replace(/^<[^>]+>/, ""));
      if (meal) pushMeal(groups, restaurant, meal);
    }
    return groupedPayloads(groups, type);
  });
}

function duremidam(cells: MealCell[]): GeneralizedMeals[] {
  return cells.flatMap(({ type, lines }) => {
    const groups = new Map<string, Meal[]>();
    let restaurant: string | undefined;
    let buffetPrice: number | null = null;
    let buffetItems: string[] = [];
    let buffetNoMeat = false;
    const flushBuffet = (): void => {
      if (buffetItems.length) {
        pushMeal(groups, "두레미담 셀프코너", {
          price: buffetPrice,
          no_meat: buffetNoMeat,
          menus: buffetItems,
        });
      }
      buffetPrice = null;
      buffetItems = [];
      buffetNoMeat = false;
    };

    for (const line of lines) {
      if (line.startsWith("※")) continue;
      const section = SECTION_RE.exec(line);
      if (section) {
        flushBuffet();
        const key = sectionKey(section[1]);
        if (key === "셀프코너") {
          restaurant = "두레미담 셀프코너";
          const price = /^([\d,]+)\s*원/.exec(section[2].trim());
          buffetPrice = price ? Number.parseInt(price[1].replaceAll(",", ""), 10) : null;
        } else if (key === "주문식메뉴") {
          restaurant = "두레미담 식당";
        } else {
          restaurant = undefined;
        }
        continue;
      }

      const meal = parsePriceLine(line);
      if (meal) {
        flushBuffet();
        pushMeal(groups, restaurant ?? "두레미담 식당", meal);
      } else if (buffetPrice !== null) {
        if (/\(#\)|\[#\]|#/.test(line)) {
          buffetNoMeat = true;
        }
        buffetItems.push(...normalizeNames(line));
      }
    }
    flushBuffet();
    return groupedPayloads(groups, type);
  });
}

function sik3(cells: MealCell[]): GeneralizedMeals[] {
  return cells.flatMap(({ type, lines }) => {
    const groups = new Map<string, Meal[]>();
    let restaurant: string | undefined = "3식당 일반";
    for (let line of lines) {
      if (line.startsWith("※")) continue;
      const section = SECTION_RE.exec(line);
      if (section) {
        restaurant =
          sectionKey(section[1]) === "든든한끼샐러드코너" ? "3식당 든든한끼샐러드코너" : undefined;
        line = section[2].trim();
        if (!line) continue;
      }
      if (!restaurant) continue;
      const meal = parsePriceLine(line);
      if (meal) pushMeal(groups, restaurant, meal);
    }
    return groupedPayloads(groups, type);
  });
}

function dong302(cells: MealCell[]): GeneralizedMeals[] {
  const buffetPattern = /^<뷔페>\s*([\d,]+)\s*원/;
  return cells.flatMap(({ type, lines }) => {
    const meals: Meal[] = [];
    let buffetPrice: number | null = null;
    let buffetItems: string[] = [];
    let buffetNoMeat = false;
    const flush = (): void => {
      if (buffetItems.length) {
        meals.push({ price: buffetPrice, no_meat: buffetNoMeat, menus: buffetItems });
        buffetItems = [];
        buffetNoMeat = false;
      }
    };
    for (const line of lines) {
      if (line.startsWith("※")) continue;
      const buffet = buffetPattern.exec(line);
      if (buffet) {
        flush();
        buffetPrice = Number.parseInt(buffet[1].replaceAll(",", ""), 10);
      } else if (buffetPrice !== null) {
        if (/\(#\)|\[#\]|#/.test(line)) {
          buffetNoMeat = true;
        }
        buffetItems.push(...normalizeNames(line));
      }
    }
    flush();
    return meals.length ? [{ type, meals }] : [];
  });
}

function restaurant301(section: string): string | undefined {
  const key = section.trim().replace(/\s+/g, " ");
  return new Map([
    ["천원의아침밥", "301동식당 천원의아침밥"],
    ["식사", "301동식당 일반"],
    ["TAKE-OUT", "301동식당 TAKE-OUT"],
    ["301동1층 교직원전용식당", "301동 1층 교직원전용식당"],
    ["301동 1층 교직원전용식당", "301동 1층 교직원전용식당"],
  ]).get(key);
}

export function generalize301(cells: MealCell[]): GeneralizedMeals[] {
  return cells.flatMap(({ type, lines }) => {
    const groups = new Map<string, Meal[]>();
    let restaurant: string | undefined = "301동식당 일반";
    for (let line of lines) {
      if (line.startsWith("※")) continue;
      const section = SECTION_RE.exec(line);
      if (section) {
        restaurant = restaurant301(section[1]);
        line = section[2].trim();
        if (!line) continue;
      }
      if (!restaurant) continue;
      const meal = parsePriceLine(line.replace(/^<[^>]+>/, ""));
      if (meal) pushMeal(groups, restaurant, meal);
    }
    return [...groups].map(([name, meals]) => ({
      restaurant: name,
      type,
      meals: expandOrOptionMeals(meals),
    }));
  });
}

function gongdae(cells: MealCell[]): GeneralizedMeals[] {
  return cells.flatMap(({ type, lines }) => {
    const meals: Meal[] = [];
    for (const line of lines) {
      if (line.startsWith("※") || line.startsWith("<")) continue;
      const match = PRICE_RE.exec(line);
      if (!match) continue;
      const name = match[1].trim();
      const hasNoMeat = /\(#\)|\[#\]|#/.test(name);
      const cleanName = name.replaceAll("(#)", "").replaceAll("[#]", "").replaceAll("#", "").trim();
      meals.push({
        price: name === "호구세트" ? 8300 : Number.parseInt(match[2].replaceAll(",", ""), 10),
        no_meat: hasNoMeat,
        menus: [cleanName],
      });
    }
    return meals.length ? [{ type, meals }] : [];
  });
}

function sectionedOptionalPrice(
  cells: MealCell[],
  sectionRestaurant: (section: string) => string | undefined,
  normalize: (name: string, restaurant: string) => string[] = (name) =>
    normalizeNames(name, SPLIT_PLUS_RE),
  skipParenthetical = false,
): GeneralizedMeals[] {
  return cells.flatMap(({ type, lines }) => {
    const groups = new Map<string, Meal[]>();
    let restaurant: string | undefined;
    for (let line of lines) {
      if (line.startsWith("※") || (skipParenthetical && line.startsWith("("))) continue;
      const section = SECTION_RE.exec(line);
      if (section) {
        restaurant = sectionRestaurant(section[1]);
        line = section[2].trim();
        if (!line) continue;
      }
      if (!restaurant) continue;
      const match = OPTIONAL_COLON_PRICE_RE.exec(line);
      if (!match) continue;
      const hasNoMeat = /\(#\)|\[#\]|#/.test(match[1]);
      const menus = normalize(match[1], restaurant);
      if (!menus.length) continue;
      pushMeal(groups, restaurant, {
        price: Number.parseInt(match[2].replaceAll(",", ""), 10),
        no_meat: hasNoMeat,
        menus,
      });
    }
    return groupedPayloads(groups, type);
  });
}

function foodcourt4f(cells: MealCell[]): GeneralizedMeals[] {
  return sectionedOptionalPrice(cells, (section) =>
    new Map([
      ["서가앤쿡", "4층 푸드코트 서가앤쿡"],
      ["토끼정", "4층 푸드코트 토끼정"],
      ["숨쉬는순두부", "4층 푸드코트 숨쉬는순두부"],
      ["이공오돈까스와우동", "4층 푸드코트 이공오 돈까스와 우동"],
    ]).get(sectionKey(section)),
  );
}

function dong220(cells: MealCell[]): GeneralizedMeals[] {
  const gapStew = "220동식당 값찌개";
  return sectionedOptionalPrice(
    cells,
    (section) =>
      new Map([
        ["경성돈카츠", "220동식당 경성 돈카츠"],
        ["바비든든", "220동식당 바비든든"],
        ["포포420", "220동식당 포포420"],
        ["값찌개", gapStew],
        ["키친101", "220동식당 키친101"],
      ]).get(sectionKey(section)),
    (name, restaurant) => {
      const replaced = name
        .replaceAll("제육한접시 세트", "제육한접시")
        .replaceAll("제육한접시세트", "제육한접시")
        .replaceAll("고기한접시 세트", "고기한접시")
        .replaceAll("고기한접시세트", "고기한접시");
      const names = normalizeNames(replaced, SPLIT_PLUS_RE);
      return restaurant === gapStew
        ? names.map((item) => item.replace(/\s*\(\s*밥\s*포함\s*\)/g, "").trim()).filter(Boolean)
        : names;
    },
    true,
  );
}

const CAFETERIAS = new Map<string, Cafeteria>([
  ["학생회관식당", { restaurant: "학생회관식당", generalize: simpleGeneralizer }],
  ["자하연식당 3층", { restaurant: "자하연식당 3층", generalize: jahayeon3f }],
  ["자하연식당 2층", { restaurant: "자하연식당 2층", generalize: simpleGeneralizer }],
  ["예술계식당", { restaurant: "예술계식당", generalize: yesul }],
  ["두레미담", { restaurant: "두레미담", generalize: duremidam }],
  ["동원관식당", { restaurant: "동원관식당", generalize: simpleGeneralizer }],
  ["3식당", { restaurant: "3식당", generalize: sik3 }],
  ["302동식당", { restaurant: "302동식당", generalize: dong302 }],
  ["301동식당", { restaurant: "301동식당", generalize: generalize301 }],
  ["공대간이식당", { restaurant: "공대간이식당", generalize: gongdae }],
  ["75-1동 4층 푸드코트", { restaurant: "4층 푸드코트", generalize: foodcourt4f }],
  ["220동식당", { restaurant: "220동식당", generalize: dong220 }],
]);

function cleanRestaurantName(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, "")
    .replaceAll("*", "")
    .trim();
}

function mealTypeFromCell(cell: Cheerio<Element>): MealType | undefined {
  const classes = (cell.attr("class") ?? "").split(/\s+/);
  if (classes.includes("breakfast")) return "BR";
  if (classes.includes("lunch")) return "LU";
  if (classes.includes("dinner")) return "DN";
  return undefined;
}

export function buildSnucoPayloads(html: string, date: string): Payload[] {
  const $ = load(html);
  const table = $("table.menu-table").first();
  const tbody = table.children("tbody").first();
  if (!table.length || !tbody.length) throw new Error("SNUCO menu table not found");

  const rowsByRestaurant = new Map<string, Element[]>();
  tbody.children("tr").each((_, row) => {
    const cells = $(row).children("td").toArray();
    if (!cells.length) return;
    const name = cleanRestaurantName(strippedText($(cells[0]), " "));
    rowsByRestaurant.set(name, cells);
  });

  const payloads: Payload[] = [];
  for (const [name, cells] of rowsByRestaurant) {
    if (EXCLUDED_RESTAURANTS.has(name)) continue;
    const cafeteria = CAFETERIAS.get(name);
    if (!cafeteria) throw new Error(`Unknown SNUCO restaurant: ${name}`);

    const mealCells: MealCell[] = [];
    for (const cell of cells.slice(1)) {
      const type = mealTypeFromCell($(cell));
      const lines = cellLines($(cell));
      if (type && lines.length) mealCells.push({ type, lines });
    }
    for (const generalized of cafeteria.generalize(mealCells)) {
      payloads.push({
        restaurant: generalized.restaurant ?? cafeteria.restaurant,
        date,
        type: generalized.type,
        meals: generalized.meals,
      });
    }
  }
  return payloads;
}

export async function crawlSnuco(dates: string[]): Promise<Payload[]> {
  const pages = await Promise.all(
    dates.map(async (date) => {
      const url = `${BASE_URL}?date=${encodeURIComponent(date)}`;
      try {
        const html = await fetchText(url, {
          userAgent: SNU_BROWSER_USER_AGENT,
          insecureSnucoTls: true,
        });
        return buildSnucoPayloads(html, date);
      } catch (error) {
        throw new Error(
          `SNUCO ${date} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
  return pages.flat();
}
