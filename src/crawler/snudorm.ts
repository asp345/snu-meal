import { Parser } from "htmlparser2";
import type { Meal, MealType, Payload } from "../model.js";
import { normalizeLine, SPLIT_DORM_RE } from "./common.js";
import { fetchText, SNU_BROWSER_USER_AGENT } from "./http.js";

const BASE_URL = "https://snudorm.snu.ac.kr/foodmenu/";
const SECTION_END_MARKER = "개인정보처리방침";
const BLOCK_TAGS = new Set([
  "div",
  "p",
  "li",
  "ul",
  "ol",
  "section",
  "article",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);
const TIME_RE = /^※\s*운영시간\s*:\s*(\d{1,2}:\d{2}~\d{1,2}:\d{2})$/;
const PRICE_RE = /^(.+?)\s*[:;：；]\s*([\d,]+원)$/;

interface DormCafeteria {
  heading: string;
  restaurant: string;
  excludedBreakfast: Set<string>;
  carryPendingPrice: boolean;
}

const CAFETERIAS: DormCafeteria[] = [
  {
    heading: "아워홈(901동)",
    restaurant: "아워홈",
    excludedBreakfast: new Set(["세미양식부페"]),
    carryPendingPrice: true,
  },
  {
    heading: "생협기숙사(919동)",
    restaurant: "생협기숙사",
    excludedBreakfast: new Set(),
    carryPendingPrice: false,
  },
];

export function snudormHtmlToLines(html: string): string[] {
  const parts: string[] = [];
  const parser = new Parser(
    {
      onopentag(name) {
        if (BLOCK_TAGS.has(name.toLowerCase()) || name.toLowerCase() === "br") parts.push("\n");
      },
      ontext(text) {
        parts.push(text);
      },
      onclosetag(name) {
        if (BLOCK_TAGS.has(name.toLowerCase())) parts.push("\n");
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();

  return parts
    .join("")
    .replaceAll("\u00a0", " ")
    .split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/)
    .map(normalizeLine)
    .filter(Boolean);
}

function extractMenuSection(lines: string[]): string[] {
  const headings = new Set(CAFETERIAS.map(({ heading }) => heading));
  const start = lines.findIndex((line) => headings.has(line));
  if (start < 0) throw new Error("SNUDORM menu section start not found");
  const relativeEnd = lines.slice(start).findIndex((line) => line.includes(SECTION_END_MARKER));
  if (relativeEnd < 0) throw new Error("SNUDORM menu section end not found");
  return lines.slice(start, start + relativeEnd);
}

function splitCafeteriaBlocks(section: string[]): Array<[DormCafeteria, string[]]> {
  const blocks: Array<[DormCafeteria, string[]]> = [];
  for (const line of section) {
    const cafeteria = CAFETERIAS.find(({ heading }) => heading === line);
    if (cafeteria) {
      blocks.push([cafeteria, []]);
    } else if (blocks.length) {
      blocks.at(-1)![1].push(line);
    }
  }
  if (!blocks.length) throw new Error("No SNUDORM restaurant blocks found");
  return blocks;
}

function mealTypeFromServiceTime(serviceTime: string): MealType | undefined {
  const hour = Number.parseInt(serviceTime.split("~", 1)[0].split(":", 1)[0], 10);
  if (hour >= 7 && hour <= 9) return "BR";
  if (hour >= 11 && hour <= 14) return "LU";
  if (hour >= 17 && hour <= 19) return "DN";
  return undefined;
}

function parseMenuLine(line: string): [string, number | null] {
  const match = PRICE_RE.exec(line);
  if (!match) return [line, null];
  return [match[1].trim(), Number.parseInt(match[2].replaceAll(",", "").replaceAll("원", ""), 10)];
}

function normalizeMenuNames(text: string, type: MealType, cafeteria: DormCafeteria): string[] {
  return text
    .replaceAll("(잇템)", "")
    .replaceAll("(#)", "")
    .replaceAll("[#]", "")
    .replaceAll("#", "")
    .trim()
    .split(SPLIT_DORM_RE)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => type !== "BR" || !cafeteria.excludedBreakfast.has(name));
}

function parseMenuLines(lines: string[], type: MealType, cafeteria: DormCafeteria): Meal[] {
  const meals: Meal[] = [];
  let pendingPrice: number | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const [menuText, price] = parseMenuLine(line);
    const hasNoMeat = /\(#\)|\[#\]|#/.test(menuText);
    const menus = normalizeMenuNames(menuText, type, cafeteria);
    if (!menus.length) {
      if (cafeteria.carryPendingPrice && price !== null) pendingPrice = price;
      continue;
    }
    meals.push({
      price: cafeteria.carryPendingPrice ? (price ?? pendingPrice) : price,
      no_meat: hasNoMeat,
      menus,
    });
    pendingPrice = null;
  }
  return meals;
}

function generalizeDormBlock(
  cafeteria: DormCafeteria,
  lines: string[],
): Array<{
  type: MealType;
  meals: Meal[];
}> {
  const mealsByType = new Map<MealType, Meal[]>();
  let currentLines: string[] = [];
  for (const line of lines) {
    const time = TIME_RE.exec(line.trim());
    if (!time) {
      currentLines.push(line);
      continue;
    }
    const type = mealTypeFromServiceTime(time[1]);
    if (type) {
      const meals = parseMenuLines(currentLines, type, cafeteria);
      if (meals.length) mealsByType.set(type, [...(mealsByType.get(type) ?? []), ...meals]);
    }
    currentLines = [];
  }
  return (["BR", "LU", "DN"] as const).flatMap((type) => {
    const meals = mealsByType.get(type);
    return meals ? [{ type, meals }] : [];
  });
}

export function buildSnudormPayloads(html: string, date: string): Payload[] {
  const section = extractMenuSection(snudormHtmlToLines(html));
  return splitCafeteriaBlocks(section).flatMap(([cafeteria, lines]) =>
    generalizeDormBlock(cafeteria, lines).map(({ type, meals }) => ({
      restaurant: cafeteria.restaurant,
      date,
      type,
      meals,
    })),
  );
}

export async function crawlSnudorm(dates: string[]): Promise<Payload[]> {
  const pages = await Promise.all(
    dates.map(async (date) => {
      const url = `${BASE_URL}?date=${encodeURIComponent(date)}`;
      try {
        const html = await fetchText(url, { userAgent: SNU_BROWSER_USER_AGENT });
        return buildSnudormPayloads(html, date);
      } catch (error) {
        throw new Error(
          `SNUDORM ${date} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
  return pages.flat();
}
