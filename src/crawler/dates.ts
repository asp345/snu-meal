const KST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function kstDate(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    KST_FORMATTER.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export const MENU_WINDOW_PAST_DAYS = 7;
export const MENU_WINDOW_FUTURE_DAYS = 7;

export function menuDates(now: Date = new Date()): string[] {
  const today = kstDate(now);
  return Array.from({ length: MENU_WINDOW_PAST_DAYS + 1 + MENU_WINDOW_FUTURE_DAYS }, (_, offset) =>
    addDays(today, offset - MENU_WINDOW_PAST_DAYS),
  );
}
