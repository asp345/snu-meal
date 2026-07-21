import { createElement } from "./dom.js";
import { dateFromIso, localIsoDate } from "./state.js";
import type { AppState, Meal, MealType, Restaurant, Venue } from "./types.js";

export interface Elements {
  app: HTMLElement;
  statusLine: HTMLElement;
  datePicker: HTMLElement;
  typePicker: HTMLElement;
  fixedToggle: HTMLInputElement;
  content: HTMLElement;
}

export const TYPE_LABELS: Record<MealType, string> = {
  BR: "아침",
  LU: "점심",
  DN: "저녁",
};

const PRICE_FORMATTER = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const DATE_HEADING_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
});
const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
const UPDATED_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function renderManifest(state: AppState, elements: Elements): void {
  if (!state.manifest) return;
  const generated = new Date(state.manifest.generated_at);
  elements.statusLine.textContent = Number.isNaN(generated.getTime())
    ? "메뉴 업데이트 시간 미상"
    : `${UPDATED_FORMATTER.format(generated)} 업데이트`;
}

export function renderDatePicker(state: AppState, elements: Elements, onSelect: () => void): void {
  if (!state.manifest) return;
  elements.datePicker.replaceChildren();
  const today = localIsoDate();
  const dates = [...state.manifest.available_dates].sort((left, right) =>
    left.localeCompare(right),
  );

  for (const date of dates) {
    const value = dateFromIso(date);
    const button = createElement("button", "date-option");
    button.type = "button";
    button.dataset.date = date;
    button.setAttribute("aria-pressed", String(date === state.selectedDate));
    button.setAttribute("aria-label", `${DATE_HEADING_FORMATTER.format(value)} 메뉴`);
    button.append(
      createElement(
        "span",
        "date-weekday",
        date === today ? "오늘" : WEEKDAY_FORMATTER.format(value),
      ),
      createElement("span", "date-number", DATE_SHORT_FORMATTER.format(value)),
    );
    button.addEventListener("click", () => {
      if (state.selectedDate === date) return;
      state.selectedDate = date;
      onSelect();
    });
    elements.datePicker.append(button);
  }

  requestAnimationFrame(() => {
    const selected = elements.datePicker.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!selected) return;
    const centeredLeft =
      selected.offsetLeft - (elements.datePicker.clientWidth - selected.offsetWidth) / 2;
    elements.datePicker.scrollTo({ left: Math.max(0, centeredLeft), behavior: "smooth" });
  });
}

export function renderTypePicker(state: AppState, elements: Elements, onSelect: () => void): void {
  elements.typePicker.replaceChildren();
  for (const type of ["BR", "LU", "DN"] as const) {
    const button = createElement("button", "type-option", TYPE_LABELS[type]);
    button.type = "button";
    button.setAttribute("aria-pressed", String(type === state.selectedType));
    button.addEventListener("click", () => {
      if (state.selectedType === type) return;
      state.selectedType = type;
      onSelect();
    });
    elements.typePicker.append(button);
  }
}

export function renderLoading(elements: Elements): void {
  const state = createElement("section", "state-panel loading-state");
  state.setAttribute("aria-live", "polite");
  state.append(
    createElement("span", "loading-mark"),
    createElement("h2", "state-title", "오늘의 식단을 불러오는 중입니다"),
    createElement("p", "state-copy", "잠시만 기다려 주세요."),
  );
  elements.content.replaceChildren(state);
}

export function renderError(elements: Elements, message: string, retry: () => void): void {
  const state = createElement("section", "state-panel error-state");
  state.setAttribute("role", "alert");
  const button = createElement("button", "retry-button", "다시 시도");
  button.type = "button";
  button.addEventListener("click", retry);
  state.append(
    createElement("h2", "state-title", "메뉴를 가져오지 못했습니다"),
    createElement("p", "state-copy", message),
    button,
  );
  elements.content.replaceChildren(state);
}

export function renderEmpty(elements: Elements, title: string, description: string): void {
  const state = createElement("section", "state-panel empty-state");
  state.append(
    createElement("h2", "state-title", title),
    createElement("p", "state-copy", description),
  );
  elements.content.replaceChildren(state);
}

function renderMeal(meal: Meal): HTMLElement {
  const item = createElement("li", "meal");
  const menuNames = createElement("div", "menu-names");
  for (const menu of meal.menus) menuNames.append(createElement("span", "menu-name", menu));

  const details = createElement("div", "meal-details");
  if (meal.no_meat) details.append(createElement("span", "no-meat-badge", "육류 없음"));
  details.append(
    createElement(
      "span",
      meal.price === null ? "price price-unknown" : "price",
      meal.price === null ? "가격 정보 없음" : PRICE_FORMATTER.format(meal.price),
    ),
  );
  item.append(menuNames, details);
  return item;
}

function renderRestaurant(restaurant: Restaurant, hideHeading = false): HTMLElement {
  const article = createElement("article", "restaurant-card");
  if (!hideHeading) {
    const heading = createElement("div", "restaurant-heading");
    heading.append(createElement("h3", "restaurant-name", restaurant.name));
    if (restaurant.fixed_menu) heading.append(createElement("span", "fixed-badge", "상시 메뉴"));
    article.append(heading);
  }

  const meals = createElement("ul", "meal-list");
  if (restaurant.meals.length === 0) {
    meals.append(createElement("li", "restaurant-empty", "등록된 메뉴가 없습니다."));
  } else {
    for (const meal of restaurant.meals) meals.append(renderMeal(meal));
  }
  article.append(meals);
  return article;
}

function renderVenueCard(buildingNumber: string, venue: Venue): HTMLElement {
  const section = createElement("section", "building-card");
  const heading = createElement("header", "building-heading");
  const title = createElement("h2", "building-title");
  title.append(createElement("span", "building-number", buildingNumber));

  const standalone = venue.name === null && venue.restaurants.length === 1;
  const titleLabel = venue.name ?? (standalone ? venue.restaurants[0].name : null);
  if (titleLabel) title.append(createElement("span", "building-name", titleLabel));
  if (standalone && venue.restaurants[0].fixed_menu) {
    title.append(createElement("span", "fixed-badge", "상시 메뉴"));
  }
  heading.append(title);

  const restaurants = createElement("div", "restaurant-list");
  for (const restaurant of venue.restaurants) {
    restaurants.append(renderRestaurant(restaurant, standalone));
  }
  section.append(heading, restaurants);
  return section;
}

export function renderMenu(state: AppState, elements: Elements): void {
  if (!state.currentMenu || state.currentMenu.date !== state.selectedDate) return;
  const section = state.currentMenu.types.find(
    (candidate) => candidate.type === state.selectedType,
  );
  if (!section) {
    renderEmpty(
      elements,
      `${TYPE_LABELS[state.selectedType]} 메뉴가 없습니다`,
      "다른 식사 시간이나 날짜를 선택해 보세요.",
    );
    return;
  }

  const venueCards = section.buildings
    .flatMap((building) =>
      building.venues.map((venue) => ({
        building_number: building.building_number,
        name: venue.name,
        restaurants: venue.restaurants.filter(
          (restaurant) => state.includeFixed || !restaurant.fixed_menu,
        ),
      })),
    )
    .filter((venue) => venue.restaurants.length > 0);

  if (venueCards.length === 0) {
    renderEmpty(
      elements,
      state.includeFixed ? "등록된 메뉴가 없습니다" : "오늘의 식단 메뉴가 없습니다",
      state.includeFixed
        ? "다른 식사 시간이나 날짜를 선택해 보세요."
        : "상시 메뉴를 포함하거나 다른 식사 시간을 선택해 보세요.",
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  const heading = createElement("div", "result-heading");
  heading.append(
    createElement("p", "result-eyebrow", TYPE_LABELS[state.selectedType]),
    createElement(
      "h2",
      "result-title",
      DATE_HEADING_FORMATTER.format(dateFromIso(state.selectedDate)),
    ),
    createElement(
      "p",
      "result-count",
      `${new Set(venueCards.map((venue) => venue.building_number)).size}개 건물 · ${venueCards.reduce((sum, venue) => sum + venue.restaurants.length, 0)}개 식당`,
    ),
  );
  fragment.append(heading);
  const grid = createElement("div", "building-grid");
  for (const venue of venueCards) grid.append(renderVenueCard(venue.building_number, venue));
  fragment.append(grid);
  elements.content.replaceChildren(fragment);
}
