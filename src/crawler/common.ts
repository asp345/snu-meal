import type { Meal, MealType } from "../model.js";

export interface MealCell {
  type: MealType;
  lines: string[];
}

export interface GeneralizedMeals {
  restaurant?: string;
  type: MealType;
  meals: Meal[];
}

export const PRICE_RE = /^(.+?)\s*:\s*([\d,]+)\s*원/;
export const OPTIONAL_COLON_PRICE_RE = /^(.+?)\s*:?\s*([\d,]+)\s*원/;
export const SECTION_RE = /^<([^>]+)>\s*(.*)$/;
export const SPLIT_RE = /\s*[,&*]\s*/;
export const SPLIT_PLUS_RE = /\s*[,&+*]\s*/;
export const SPLIT_DORM_RE = /\s*[,/&*]\s*/;

export function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

export function normalizeNames(text: string, split = SPLIT_RE): string[] {
  return text
    .replaceAll("(#)", "")
    .replaceAll("[#]", "")
    .replaceAll("#", "")
    .trim()
    .split(split)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function parsePriceLine(
  line: string,
  pattern = PRICE_RE,
  split = SPLIT_RE,
): Meal | undefined {
  const match = pattern.exec(line);
  if (!match) return undefined;
  const hasNoMeat = /\(#\)|\[#\]|#/.test(match[1]);
  const menus = normalizeNames(match[1], split);
  if (menus.length === 0) return undefined;
  return {
    price: Number.parseInt(match[2].replaceAll(",", ""), 10),
    no_meat: hasNoMeat,
    menus,
  };
}

export function sectionKey(section: string): string {
  return section.trim().replace(/\s+/g, "");
}

export function pushMeal(groups: Map<string, Meal[]>, restaurant: string, meal: Meal): void {
  const meals = groups.get(restaurant);
  if (meals) meals.push(meal);
  else groups.set(restaurant, [meal]);
}

export function groupedPayloads(groups: Map<string, Meal[]>, type: MealType): GeneralizedMeals[] {
  return [...groups].map(([restaurant, meals]) => ({ restaurant, type, meals }));
}

export function expandOrOptionMeals(meals: Meal[]): Meal[] {
  const expanded: Meal[] = [];
  const separator = /\s*(?<![A-Za-z])OR(?![A-Za-z])\s*/;

  for (const meal of meals) {
    let optionSets: string[][] = [[]];
    let hasOrOption = false;
    for (const menu of meal.menus) {
      const options = menu
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean);
      if (options.length <= 1) {
        optionSets.forEach((set) => set.push(menu));
        continue;
      }
      hasOrOption = true;
      optionSets = optionSets.flatMap((set) => options.map((option) => [...set, option]));
    }

    if (hasOrOption) {
      expanded.push(...optionSets.map((menus) => ({ ...meal, menus })));
    } else {
      expanded.push(meal);
    }
  }
  return expanded;
}
