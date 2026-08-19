import type { AppState, MealType } from "./types.js";

export function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Use KST (Asia/Seoul) to align with crawler dates in src/crawler/dates.ts:1.
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

export function createInitialState(): AppState {
  return {
    manifest: null,
    dataBase: "",
    selectedDate: "",
    selectedType: initialMealType(),
    includeFixed: false,
    currentMenu: null,
    menuCache: new Map(),
    requestSequence: 0,
  };
}

export function applyQueryState(state: AppState): void {
  if (!state.manifest) return;
  const params = new URLSearchParams(location.search);
  const queryDate = params.get("date");
  const queryType = params.get("type");
  const queryFixed = params.get("fixed");
  const dates = [...state.manifest.available_dates].sort((left, right) =>
    left.localeCompare(right),
  );
  const today = localIsoDate();

  if (queryDate && dates.includes(queryDate)) state.selectedDate = queryDate;
  else if (dates.includes(today)) state.selectedDate = today;
  else state.selectedDate = dates.at(-1) ?? "";
  if (queryType === "BR" || queryType === "LU" || queryType === "DN") {
    state.selectedType = queryType;
  }
  state.includeFixed = queryFixed === "1" || queryFixed === "true";
}

export function updateQueryState(state: AppState): void {
  const params = new URLSearchParams();
  if (state.selectedDate) params.set("date", state.selectedDate);
  params.set("type", state.selectedType);
  if (state.includeFixed) params.set("fixed", "1");
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}
