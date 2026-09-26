import type { MealType } from "./types";

export const TYPE_LABELS: Record<MealType, string> = {
  BR: "아침",
  LU: "점심",
  DN: "저녁",
};

export const PRICE_FORMATTER = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export const DATE_HEADING_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

export const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
});

export const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });

export const UPDATED_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
