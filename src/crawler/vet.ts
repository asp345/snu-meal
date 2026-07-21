import { load, type CheerioAPI, type Cheerio } from "cheerio";
import type { Element } from "domhandler";
import type { Meal, Payload } from "../model.js";
import { addDays, kstDate } from "./dates.js";
import { fetchText, SNU_BROWSER_USER_AGENT } from "./http.js";

const URL = "https://vet.snu.ac.kr/cafe_menu/";
const RESTAURANT = "수의대식당";
const DATE_RE = /^\d{1,2}\.\s\d{1,2}\(.\)$/;

interface TextNodeLike {
  type: string;
  data?: string;
  childNodes?: TextNodeLike[];
}

function descendantText(element: Cheerio<Element>): string[] {
  const parts: string[] = [];
  const visit = (node: TextNodeLike): void => {
    if (node.type === "text") parts.push(node.data ?? "");
    else node.childNodes?.forEach(visit);
  };
  element
    .contents()
    .toArray()
    .forEach((node) => visit(node as TextNodeLike));
  return parts;
}

function strippedText(element: Cheerio<Element>): string {
  return descendantText(element)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function validDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return undefined;
  return date.toISOString().slice(0, 10);
}

export function parseVetDate(dateText: string, today: string): string | undefined {
  if (!DATE_RE.test(dateText)) return undefined;
  const parts = /^(\d{1,2})\.\s(\d{1,2})/.exec(dateText);
  if (!parts) return undefined;
  const reference = addDays(today, -7);
  const referenceYear = Number.parseInt(reference.slice(0, 4), 10);
  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);
  const initial = validDate(referenceYear, month, day);
  if (!initial) return undefined;
  return initial < reference ? validDate(referenceYear + 1, month, day) : initial;
}

function buildMeal(menuText: string): Meal | undefined {
  const normalized = menuText
    .replace(/\s+/g, " ")
    .replace(/^[\s:：-]+/, "")
    .trim();
  if (!normalized || normalized === "없음" || normalized.includes("휴무")) return undefined;
  const hasNoMeat = /\(#\)|\[#\]|#/.test(normalized);
  const cleanMenu = normalized
    .replaceAll("(#)", "")
    .replaceAll("[#]", "")
    .replaceAll("#", "")
    .trim();
  if (!cleanMenu) return undefined;
  return { price: null, no_meat: hasNoMeat, menus: [cleanMenu] };
}

function extractDinnerText($: CheerioAPI): string {
  let dinner = "";
  const visit = (node: TextNodeLike): boolean => {
    if (node.type === "text") {
      const index = (node.data ?? "").indexOf("저녁메뉴");
      if (index >= 0) {
        dinner = (node.data ?? "").slice(index + "저녁메뉴".length).trim();
        return true;
      }
    }
    return node.childNodes?.some(visit) ?? false;
  };
  $.root()
    .contents()
    .toArray()
    .some((node) => visit(node as TextNodeLike));
  return dinner;
}

export function buildVetPayloads(html: string, today: string): Payload[] {
  const $ = load(html);
  const table = $("table").first();
  if (!table.length) throw new Error("VET menu table not found");

  const lunchRows: Array<[string, string]> = [];
  table.find("tr").each((_, row) => {
    const cells = $(row).find("td").toArray();
    if (cells.length === 3) {
      lunchRows.push([strippedText($(cells[0])), strippedText($(cells[1]))]);
    }
  });
  if (!lunchRows.length) throw new Error("VET lunch rows not found");

  const dinner = buildMeal(extractDinnerText($));
  const payloads: Payload[] = [];
  let datedRows = 0;
  for (const [dateText, lunchText] of lunchRows) {
    const date = parseVetDate(dateText, today);
    if (!date) continue;
    datedRows += 1;
    const lunch = buildMeal(lunchText);
    if (lunch) payloads.push({ restaurant: RESTAURANT, date, type: "LU", meals: [lunch] });
    if (dinner) payloads.push({ restaurant: RESTAURANT, date, type: "DN", meals: [dinner] });
  }
  if (!datedRows) throw new Error("VET dated menu rows not found");
  return payloads;
}

export async function crawlVet(now: Date = new Date()): Promise<Payload[]> {
  try {
    const html = await fetchText(URL, { userAgent: SNU_BROWSER_USER_AGENT });
    return buildVetPayloads(html, kstDate(now));
  } catch (error) {
    throw new Error(`VET failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
