// src/web/app.ts
var REPOSITORY = "asp345/snu-meal";
var TYPE_LABELS = {
  BR: "\uC544\uCE68",
  LU: "\uC810\uC2EC",
  DN: "\uC800\uB141"
};
var PRICE_FORMATTER = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});
var DATE_HEADING_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long"
});
var DATE_SHORT_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric"
});
var WEEKDAY_FORMATTER = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
var app = requireElement("app");
var statusLine = requireElement("data-status");
var datePicker = requireElement("date-picker");
var typePicker = requireElement("type-picker");
var fixedToggle = requireElement("fixed-toggle");
var content = requireElement("content");
var manifest = null;
var dataLocation = null;
var selectedDate = "";
var selectedType = initialMealType();
var includeFixed = false;
var currentMenu = null;
var requestSequence = 0;
var menuCache = /* @__PURE__ */ new Map();
function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`\uD544\uC218 \uC694\uC18C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${id}`);
  return element;
}
function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== void 0) element.textContent = text;
  return element;
}
function dateFromIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function localIsoDate() {
  const now = /* @__PURE__ */ new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function initialMealType() {
  const hour = (/* @__PURE__ */ new Date()).getHours();
  if (hour < 10) return "BR";
  if (hour < 16) return "LU";
  return "DN";
}
function dataUrl(location2, path) {
  return `${location2.base}/${path}${location2.cacheBust}`;
}
async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`\uC694\uCCAD \uC2E4\uD328 (${response.status})`);
  return await response.json();
}
function normalizeMenu(menu) {
  return {
    date: menu.date,
    types: menu.types.map((section) => ({
      type: section.type,
      buildings: section.buildings.map(
        (building) => "venues" in building ? building : {
          building_number: building.building_number,
          venues: [{ name: null, restaurants: building.restaurants }]
        }
      )
    }))
  };
}
async function resolveDataLocation() {
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (isLocal) return { base: "./data", cacheBust: "" };
  try {
    const commit = await fetchJson(
      `https://api.github.com/repos/${REPOSITORY}/commits/data`
    );
    if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/i.test(commit.sha)) {
      throw new Error("\uC62C\uBC14\uB978 \uB370\uC774\uD130 \uCEE4\uBC0B\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    }
    return {
      base: `https://raw.githubusercontent.com/${REPOSITORY}/${commit.sha}`,
      cacheBust: ""
    };
  } catch {
    return {
      base: `https://raw.githubusercontent.com/${REPOSITORY}/data`,
      cacheBust: `?t=${Date.now()}`
    };
  }
}
function parseQueryState(availableDates) {
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
function updateQueryState() {
  const params = new URLSearchParams();
  if (selectedDate) params.set("date", selectedDate);
  params.set("type", selectedType);
  if (includeFixed) params.set("fixed", "1");
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}
function renderManifest() {
  if (!manifest) return;
  const generated = new Date(manifest.generated_at);
  statusLine.textContent = Number.isNaN(generated.getTime()) ? "\uBA54\uB274 \uB370\uC774\uD130 \uC5C5\uB370\uC774\uD2B8 \uC2DC\uAC04 \uBBF8\uC0C1" : `${new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(generated)} \uC5C5\uB370\uC774\uD2B8`;
}
function renderDatePicker() {
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
    button.setAttribute("aria-label", `${DATE_HEADING_FORMATTER.format(value)} \uBA54\uB274`);
    button.append(
      createElement(
        "span",
        "date-weekday",
        date === today ? "\uC624\uB298" : WEEKDAY_FORMATTER.format(value)
      ),
      createElement("span", "date-number", DATE_SHORT_FORMATTER.format(value))
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
    datePicker.querySelector('[aria-pressed="true"]')?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  });
}
function renderTypePicker() {
  typePicker.replaceChildren();
  for (const type of ["BR", "LU", "DN"]) {
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
function renderLoading() {
  const state = createElement("section", "state-panel loading-state");
  state.setAttribute("aria-live", "polite");
  state.append(
    createElement("span", "loading-mark"),
    createElement("h2", "state-title", "\uC624\uB298\uC758 \uC2DD\uB2E8\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4"),
    createElement("p", "state-copy", "\uC7A0\uC2DC\uB9CC \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.")
  );
  content.replaceChildren(state);
}
function renderError(message, retry) {
  const state = createElement("section", "state-panel error-state");
  state.setAttribute("role", "alert");
  const button = createElement("button", "retry-button", "\uB2E4\uC2DC \uC2DC\uB3C4");
  button.type = "button";
  button.addEventListener("click", retry);
  state.append(
    createElement("span", "state-code", "\uC5F0\uACB0 \uC624\uB958"),
    createElement("h2", "state-title", "\uBA54\uB274\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4"),
    createElement("p", "state-copy", message),
    button
  );
  content.replaceChildren(state);
}
function renderEmpty(title, description) {
  const state = createElement("section", "state-panel empty-state");
  state.append(
    createElement("span", "empty-symbol", "\u2014"),
    createElement("h2", "state-title", title),
    createElement("p", "state-copy", description)
  );
  content.replaceChildren(state);
}
function renderMeal(meal) {
  const item = createElement("li", "meal");
  const menuNames = createElement("div", "menu-names");
  for (const menu of meal.menus) menuNames.append(createElement("span", "menu-name", menu));
  const details = createElement("div", "meal-details");
  if (meal.no_meat) details.append(createElement("span", "no-meat-badge", "\uC721\uB958 \uC5C6\uC74C"));
  details.append(
    createElement(
      "span",
      meal.price === null ? "price price-unknown" : "price",
      meal.price === null ? "\uAC00\uACA9 \uC815\uBCF4 \uC5C6\uC74C" : PRICE_FORMATTER.format(meal.price)
    )
  );
  item.append(menuNames, details);
  return item;
}
function renderRestaurant(restaurant) {
  const article = createElement("article", "restaurant-card");
  const heading = createElement("div", "restaurant-heading");
  heading.append(createElement("h3", "restaurant-name", restaurant.name));
  if (restaurant.fixed_menu) heading.append(createElement("span", "fixed-badge", "\uC0C1\uC2DC \uBA54\uB274"));
  const meals = createElement("ul", "meal-list");
  if (restaurant.meals.length === 0) {
    meals.append(createElement("li", "restaurant-empty", "\uB4F1\uB85D\uB41C \uBA54\uB274\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."));
  } else {
    for (const meal of restaurant.meals) meals.append(renderMeal(meal));
  }
  article.append(heading, meals);
  return article;
}
function renderVenueCard(buildingNumber, venue) {
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
function renderMenu() {
  if (!currentMenu || currentMenu.date !== selectedDate) return;
  const section = currentMenu.types.find((candidate) => candidate.type === selectedType);
  if (!section) {
    renderEmpty(
      `${TYPE_LABELS[selectedType]} \uBA54\uB274\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4`,
      "\uB2E4\uB978 \uC2DD\uC0AC \uC2DC\uAC04\uC774\uB098 \uB0A0\uC9DC\uB97C \uC120\uD0DD\uD574 \uBCF4\uC138\uC694."
    );
    return;
  }
  const venueCards = section.buildings.flatMap(
    (building) => building.venues.map((venue) => ({
      building_number: building.building_number,
      name: venue.name,
      restaurants: venue.restaurants.filter(
        (restaurant) => includeFixed || !restaurant.fixed_menu
      )
    }))
  ).filter((venue) => venue.restaurants.length > 0);
  if (venueCards.length === 0) {
    renderEmpty(
      includeFixed ? "\uB4F1\uB85D\uB41C \uBA54\uB274\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" : "\uC624\uB298\uC758 \uC2DD\uB2E8 \uBA54\uB274\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
      includeFixed ? "\uB2E4\uB978 \uC2DD\uC0AC \uC2DC\uAC04\uC774\uB098 \uB0A0\uC9DC\uB97C \uC120\uD0DD\uD574 \uBCF4\uC138\uC694." : "\uC0C1\uC2DC \uBA54\uB274\uB97C \uD3EC\uD568\uD558\uAC70\uB098 \uB2E4\uB978 \uC2DD\uC0AC \uC2DC\uAC04\uC744 \uC120\uD0DD\uD574 \uBCF4\uC138\uC694."
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
      `${new Set(venueCards.map((venue) => venue.building_number)).size}\uAC1C \uAC74\uBB3C \xB7 ${venueCards.reduce((sum, venue) => sum + venue.restaurants.length, 0)}\uAC1C \uC2DD\uB2F9`
    )
  );
  fragment.append(heading);
  const grid = createElement("div", "building-grid");
  for (const venue of venueCards) grid.append(renderVenueCard(venue.building_number, venue));
  fragment.append(grid);
  content.replaceChildren(fragment);
}
async function loadSelectedMenu() {
  if (!dataLocation || !selectedDate) {
    renderEmpty("\uC81C\uACF5\uB418\uB294 \uB0A0\uC9DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4", "\uC544\uC9C1 \uC0DD\uC131\uB41C \uBA54\uB274 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
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
    const response = await fetchJson(
      dataUrl(dataLocation, `menus/${selectedDate}.json`)
    );
    if (sequence !== requestSequence) return;
    if (response.date !== selectedDate || !Array.isArray(response.types)) {
      throw new Error("\uBA54\uB274 \uB370\uC774\uD130 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    }
    const menu = normalizeMenu(response);
    menuCache.set(selectedDate, menu);
    currentMenu = menu;
    renderMenu();
  } catch (error) {
    if (sequence !== requestSequence) return;
    const detail = error instanceof Error ? error.message : "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
    renderError(detail, () => void loadSelectedMenu());
  }
}
async function initialize() {
  requestSequence += 1;
  renderLoading();
  app.setAttribute("aria-busy", "true");
  try {
    const location2 = await resolveDataLocation();
    const nextManifest = await fetchJson(dataUrl(location2, "manifest.json"));
    if (![1, 2].includes(nextManifest.schema_version) || !Array.isArray(nextManifest.available_dates)) {
      throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uB370\uC774\uD130 \uD615\uC2DD\uC785\uB2C8\uB2E4.");
    }
    dataLocation = location2;
    manifest = nextManifest;
    menuCache.clear();
    parseQueryState(manifest.available_dates);
    updateQueryState();
    renderManifest();
    renderDatePicker();
    renderTypePicker();
    await loadSelectedMenu();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
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
