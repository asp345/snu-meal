export type MealType = "BR" | "LU" | "DN";

export const MEAL_TYPES: readonly MealType[] = ["BR", "LU", "DN"];

export interface Meal {
  price: number | null;
  no_meat: boolean;
  menus: string[];
}

export interface Payload {
  restaurant: string;
  date: string;
  type: MealType;
  meals: Meal[];
}

export interface CrawlResult {
  payloads: Payload[];
  sourceCounts: Record<"snuco" | "snudorm" | "vet", number>;
}

export interface Restaurant {
  code: string;
  name: string;
  display_name: string;
  building_number: string;
  building_name: string | null;
  venue_name: string | null;
  fixed_menu: boolean;
  source: "snuco" | "snudorm" | "vet";
}
