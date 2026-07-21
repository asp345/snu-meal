type MealType = "BR" | "LU" | "DN";

interface Manifest {
  schema_version: 1 | 2;
  generated_at: string;
  available_dates: string[];
  sources: {
    snuco: number;
    snudorm: number;
    vet: number;
  };
}

interface Meal {
  price: number | null;
  no_meat: boolean;
  menus: string[];
}

interface Restaurant {
  code: string;
  name: string;
  fixed_menu: boolean;
  meals: Meal[];
}

interface Venue {
  name: string | null;
  restaurants: Restaurant[];
}

interface Building {
  building_number: string;
  venues: Venue[];
}

interface LegacyBuilding {
  building_number: string;
  building_name: string | null;
  restaurants: Restaurant[];
}

interface MealSection {
  type: MealType;
  buildings: Building[];
}

interface DateMenu {
  date: string;
  types: MealSection[];
}

interface LegacyDateMenu {
  date: string;
  types: Array<{
    type: MealType;
    buildings: LegacyBuilding[];
  }>;
}

interface DataLocation {
  base: string;
  cacheBust: string;
}

const REPOSITORY = "asp345/snu-meal";
const TYPE_LABELS: Record<MealType, string> = {
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

const app = requireElement<HTMLElement>("app");
const statusLine = requireElement<HTMLElement>("data-status");
const datePicker = requireElement<HTMLElement>("date-picker");
const typePicker = requireElement<HTMLElement>("type-picker");
const fixedToggle = requireElement<HTMLInputElement>("fixed-toggle");
const content = requireElement<HTMLElement>("content");

let manifest: Manifest | null = null;
let dataLocation: DataLocation | null = null;
let selectedDate = "";
let selectedType: MealType = initialMealType();
let includeFixed = false;
let currentMenu: DateMenu | null = null;
let requestSequence = 0;
const menuCache = new Map<string, DateMenu>();

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`필수 요소를 찾을 수 없습니다: ${id}`);
  return element as T;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localIsoDate(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return "BR";
  if (hour < 16) return "LU";
  return "DN";
}

function dataUrl(location: DataLocation, path: string): string {
  return `${location.base}/${path}${location.cacheBust}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`요청 실패 (${response.status})`);
  return (await response.json()) as T;
}

function normalizeMenu(menu: DateMenu | LegacyDateMenu): DateMenu {
  return {
    date: menu.date,
    types: menu.types.map((section) => ({
      type: section.type,
      buildings: section.buildings.map((building) =>
        "venues" in building
          ? building
          : {
              building_number: building.building_number,
              venues: [{ name: null, restaurants: building.restaurants }],
            },
      ),
    })),
  };
}

async function resolveDataLocation(): Promise<DataLocation> {
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (isLocal) return { base: "./data", cacheBust: "" };

  try {
    const commit = await fetchJson<{ sha?: unknown }>(
      `https://api.github.com/repos/${REPOSITORY}/commits/data`,
    );
    if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/i.test(commit.sha)) {
      throw new Error("올바른 데이터 커밋을 찾지 못했습니다.");
    }
    return {
      base: `https://raw.githubusercontent.com/${REPOSITORY}/${commit.sha}`,
      cacheBust: "",
    };
  } catch {
    return {
      base: `https://raw.githubusercontent.com/${REPOSITORY}/data`,
      cacheBust: `?t=${Date.now()}`,
    };
  }
}

function parseQueryState(availableDates: string[]): void {
  const params = new URLSearchParams(location.search);
  const queryDate = params.get("date");
  const queryType = params.get("type");
  const queryFixed = params.get("fixed");
  const dates = [...availableDates].sort((left, right) => left.localeCompare(right));
  const today = localIsoDate();

  if (queryDate && dates.includes(queryDate)) selectedDate = queryDate;
  else if (dates.includes(today)) selectedDate = today;
  else selectedDate = dates.at(-1) ?? "";
  if (queryType === "BR" || queryType === "LU" || queryType === "DN") {
    selectedType = queryType;
  }
  includeFixed = queryFixed === "1" || queryFixed === "true";
  fixedToggle.checked = includeFixed;
}

function updateQueryState(): void {
  const params = new URLSearchParams();
  if (selectedDate) params.set("date", selectedDate);
  params.set("type", selectedType);
  if (includeFixed) params.set("fixed", "1");
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

function renderManifest(): void {
  if (!manifest) return;
  const generated = new Date(manifest.generated_at);
  statusLine.textContent = Number.isNaN(generated.getTime())
    ? "메뉴 데이터 업데이트 시간 미상"
    : `${new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(generated)} 업데이트`;
}

function renderDatePicker(): void {
  if (!manifest) return;
  datePicker.replaceChildren();
  const today = localIsoDate();
  const dates = [...manifest.available_dates].sort((left, right) => left.localeCompare(right));

  for (const date of dates) {
    const value = dateFromIso(date);
    const button = createElement("button", "date-option");
    button.type = "button";
    button.dataset.date = date;
    button.setAttribute("aria-pressed", String(date === selectedDate));
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
      if (selectedDate === date) return;
      selectedDate = date;
      updateQueryState();
      renderDatePicker();
      void loadSelectedMenu();
    });
    datePicker.append(button);
  }

  requestAnimationFrame(() => {
    const selected = datePicker.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!selected) return;
    const centeredLeft = selected.offsetLeft - (datePicker.clientWidth - selected.offsetWidth) / 2;
    datePicker.scrollTo({ left: Math.max(0, centeredLeft), behavior: "smooth" });
  });
}

function renderTypePicker(): void {
  typePicker.replaceChildren();
  for (const type of ["BR", "LU", "DN"] as const) {
    const button = createElement("button", "type-option", TYPE_LABELS[type]);
    button.type = "button";
    button.setAttribute("aria-pressed", String(type === selectedType));
    button.addEventListener("click", () => {
      if (selectedType === type) return;
      selectedType = type;
      updateQueryState();
      renderTypePicker();
      renderMenu();
    });
    typePicker.append(button);
  }
}

function renderLoading(): void {
  const state = createElement("section", "state-panel loading-state");
  state.setAttribute("aria-live", "polite");
  state.append(
    createElement("span", "loading-mark"),
    createElement("h2", "state-title", "오늘의 식단을 불러오는 중입니다"),
    createElement("p", "state-copy", "잠시만 기다려 주세요."),
  );
  content.replaceChildren(state);
}

function renderError(message: string, retry: () => void): void {
  const state = createElement("section", "state-panel error-state");
  state.setAttribute("role", "alert");
  const button = createElement("button", "retry-button", "다시 시도");
  button.type = "button";
  button.addEventListener("click", retry);
  state.append(
    createElement("span", "state-code", "연결 오류"),
    createElement("h2", "state-title", "메뉴를 가져오지 못했습니다"),
    createElement("p", "state-copy", message),
    button,
  );
  content.replaceChildren(state);
}

function renderEmpty(title: string, description: string): void {
  const state = createElement("section", "state-panel empty-state");
  state.append(
    createElement("span", "empty-symbol", "—"),
    createElement("h2", "state-title", title),
    createElement("p", "state-copy", description),
  );
  content.replaceChildren(state);
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

function renderRestaurant(restaurant: Restaurant): HTMLElement {
  const article = createElement("article", "restaurant-card");
  const heading = createElement("div", "restaurant-heading");
  heading.append(createElement("h3", "restaurant-name", restaurant.name));
  if (restaurant.fixed_menu) heading.append(createElement("span", "fixed-badge", "상시 메뉴"));

  const meals = createElement("ul", "meal-list");
  if (restaurant.meals.length === 0) {
    meals.append(createElement("li", "restaurant-empty", "등록된 메뉴가 없습니다."));
  } else {
    for (const meal of restaurant.meals) meals.append(renderMeal(meal));
  }
  article.append(heading, meals);
  return article;
}

function renderVenueCard(buildingNumber: string, venue: Venue): HTMLElement {
  const section = createElement("section", "building-card");
  const heading = createElement("header", "building-heading");
  const title = createElement("h2", "building-title");
  title.append(createElement("span", "building-number", buildingNumber));
  if (venue.name) title.append(createElement("span", "building-name", venue.name));
  heading.append(title);

  const restaurants = createElement("div", "restaurant-list");
  for (const restaurant of venue.restaurants) restaurants.append(renderRestaurant(restaurant));
  section.append(heading, restaurants);
  return section;
}

function renderMenu(): void {
  if (!currentMenu || currentMenu.date !== selectedDate) return;
  const section = currentMenu.types.find((candidate) => candidate.type === selectedType);
  if (!section) {
    renderEmpty(
      `${TYPE_LABELS[selectedType]} 메뉴가 없습니다`,
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
          (restaurant) => includeFixed || !restaurant.fixed_menu,
        ),
      })),
    )
    .filter((venue) => venue.restaurants.length > 0);

  if (venueCards.length === 0) {
    renderEmpty(
      includeFixed ? "등록된 메뉴가 없습니다" : "오늘의 식단 메뉴가 없습니다",
      includeFixed
        ? "다른 식사 시간이나 날짜를 선택해 보세요."
        : "상시 메뉴를 포함하거나 다른 식사 시간을 선택해 보세요.",
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  const heading = createElement("div", "result-heading");
  const selectedDateValue = dateFromIso(selectedDate);
  heading.append(
    createElement("p", "result-eyebrow", TYPE_LABELS[selectedType]),
    createElement("h2", "result-title", DATE_HEADING_FORMATTER.format(selectedDateValue)),
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
  content.replaceChildren(fragment);
}

async function loadSelectedMenu(): Promise<void> {
  if (!dataLocation || !selectedDate) {
    renderEmpty("제공되는 날짜가 없습니다", "아직 생성된 메뉴 데이터가 없습니다.");
    return;
  }
  const sequence = ++requestSequence;
  const cached = menuCache.get(selectedDate);
  if (cached) {
    currentMenu = cached;
    renderMenu();
    return;
  }

  renderLoading();
  try {
    const response = await fetchJson<DateMenu | LegacyDateMenu>(
      dataUrl(dataLocation, `menus/${selectedDate}.json`),
    );
    if (sequence !== requestSequence) return;
    if (response.date !== selectedDate || !Array.isArray(response.types)) {
      throw new Error("메뉴 데이터 형식이 올바르지 않습니다.");
    }
    const menu = normalizeMenu(response);
    menuCache.set(selectedDate, menu);
    currentMenu = menu;
    renderMenu();
  } catch (error) {
    if (sequence !== requestSequence) return;
    const detail = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    renderError(detail, () => void loadSelectedMenu());
  }
}

async function initialize(): Promise<void> {
  requestSequence += 1;
  renderLoading();
  app.setAttribute("aria-busy", "true");
  try {
    const location = await resolveDataLocation();
    const nextManifest = await fetchJson<Manifest>(dataUrl(location, "manifest.json"));
    if (
      ![1, 2].includes(nextManifest.schema_version) ||
      !Array.isArray(nextManifest.available_dates)
    ) {
      throw new Error("지원하지 않는 데이터 형식입니다.");
    }
    dataLocation = location;
    manifest = nextManifest;
    menuCache.clear();
    parseQueryState(manifest.available_dates);
    updateQueryState();
    renderManifest();
    renderDatePicker();
    renderTypePicker();
    await loadSelectedMenu();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    renderError(detail, () => void initialize());
  } finally {
    app.setAttribute("aria-busy", "false");
  }
}

fixedToggle.addEventListener("change", () => {
  includeFixed = fixedToggle.checked;
  updateQueryState();
  renderMenu();
});

void initialize();
