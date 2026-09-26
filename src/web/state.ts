import type { MealType } from "./types.js";

const KST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

function kstParts(now: Date = new Date()): Record<string, string> {
  return Object.fromEntries(
    KST_FORMATTER.formatToParts(now).map(({ type, value }) => [type, value]),
  );
}

export function localIsoDate(now: Date = new Date()): string {
  const parts = kstParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function initialMealType(now: Date = new Date()): MealType {
  const hour = Number.parseInt(kstParts(now).hour, 10);
  if (hour < 10) return "BR";
  if (hour < 16) return "LU";
  return "DN";
}

export function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
