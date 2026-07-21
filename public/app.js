// src/web/data.ts
var REPOSITORY = "asp345/snu-meal";
async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`\uC694\uCCAD \uC2E4\uD328 (${response.status})`);
  return await response.json();
}
async function resolveDataBase() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return "./data";
  try {
    const commit = await fetchJson(
      `https://api.github.com/repos/${REPOSITORY}/commits/data`
    );
    if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/i.test(commit.sha)) {
      throw new Error("\uC62C\uBC14\uB978 \uB370\uC774\uD130 \uCEE4\uBC0B\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    }
    return `https://raw.githubusercontent.com/${REPOSITORY}/${commit.sha}`;
  } catch {
    return `https://raw.githubusercontent.com/${REPOSITORY}/data?t=${Date.now()}`;
  }
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
async function loadManifest(dataBase) {
  const manifest = await fetchJson(`${dataBase}/manifest.json`);
  if (![1, 2].includes(manifest.schema_version) || !Array.isArray(manifest.available_dates)) {
    throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uB370\uC774\uD130 \uD615\uC2DD\uC785\uB2C8\uB2E4.");
  }
  return manifest;
}
async function loadMenu(dataBase, date) {
  const response = await fetchJson(`${dataBase}/menus/${date}.json`);
  if (response.date !== date || !Array.isArray(response.types)) {
    throw new Error("\uBA54\uB274 \uB370\uC774\uD130 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
  return normalizeMenu(response);
}

// src/web/dom.ts
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

// src/web/state.ts
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
function createInitialState() {
  return {
    manifest: null,
    dataBase: "",
    selectedDate: "",
    selectedType: initialMealType(),
    includeFixed: false,
    currentMenu: null,
    menuCache: /* @__PURE__ */ new Map(),
    requestSequence: 0
  };
}
function applyQueryState(state2) {
  if (!state2.manifest) return;
  const params = new URLSearchParams(location.search);
  const queryDate = params.get("date");
  const queryType = params.get("type");
  const queryFixed = params.get("fixed");
  const dates = [...state2.manifest.available_dates].sort(
    (left, right) => left.localeCompare(right)
  );
  const today = localIsoDate();
  if (queryDate && dates.includes(queryDate)) state2.selectedDate = queryDate;
  else if (dates.includes(today)) state2.selectedDate = today;
  else state2.selectedDate = dates.at(-1) ?? "";
  if (queryType === "BR" || queryType === "LU" || queryType === "DN") {
    state2.selectedType = queryType;
  }
  state2.includeFixed = queryFixed === "1" || queryFixed === "true";
}
function updateQueryState(state2) {
  const params = new URLSearchParams();
  if (state2.selectedDate) params.set("date", state2.selectedDate);
  params.set("type", state2.selectedType);
  if (state2.includeFixed) params.set("fixed", "1");
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

// src/web/render.ts
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
var UPDATED_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
function renderManifest(state2, elements2) {
  if (!state2.manifest) return;
  const generated = new Date(state2.manifest.generated_at);
  elements2.statusLine.textContent = Number.isNaN(generated.getTime()) ? "\uBA54\uB274 \uC5C5\uB370\uC774\uD2B8 \uC2DC\uAC04 \uBBF8\uC0C1" : `${UPDATED_FORMATTER.format(generated)} \uC5C5\uB370\uC774\uD2B8`;
}
function renderDatePicker(state2, elements2, onSelect) {
  if (!state2.manifest) return;
  elements2.datePicker.replaceChildren();
  const today = localIsoDate();
  const dates = [...state2.manifest.available_dates].sort(
    (left, right) => left.localeCompare(right)
  );
  for (const date of dates) {
    const value = dateFromIso(date);
    const button = createElement("button", "date-option");
    button.type = "button";
    button.dataset.date = date;
    button.setAttribute("aria-pressed", String(date === state2.selectedDate));
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
      if (state2.selectedDate === date) return;
      state2.selectedDate = date;
      onSelect();
    });
    elements2.datePicker.append(button);
  }
  requestAnimationFrame(() => {
    const selected = elements2.datePicker.querySelector('[aria-pressed="true"]');
    if (!selected) return;
    const centeredLeft = selected.offsetLeft - (elements2.datePicker.clientWidth - selected.offsetWidth) / 2;
    elements2.datePicker.scrollTo({ left: Math.max(0, centeredLeft), behavior: "smooth" });
  });
}
function renderTypePicker(state2, elements2, onSelect) {
  elements2.typePicker.replaceChildren();
  for (const type of ["BR", "LU", "DN"]) {
    const button = createElement("button", "type-option", TYPE_LABELS[type]);
    button.type = "button";
    button.setAttribute("aria-pressed", String(type === state2.selectedType));
    button.addEventListener("click", () => {
      if (state2.selectedType === type) return;
      state2.selectedType = type;
      onSelect();
    });
    elements2.typePicker.append(button);
  }
}
function renderLoading(elements2) {
  const state2 = createElement("section", "state-panel loading-state");
  state2.setAttribute("aria-live", "polite");
  state2.append(
    createElement("span", "loading-mark"),
    createElement("h2", "state-title", "\uC624\uB298\uC758 \uC2DD\uB2E8\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4"),
    createElement("p", "state-copy", "\uC7A0\uC2DC\uB9CC \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.")
  );
  elements2.content.replaceChildren(state2);
}
function renderError(elements2, message, retry) {
  const state2 = createElement("section", "state-panel error-state");
  state2.setAttribute("role", "alert");
  const button = createElement("button", "retry-button", "\uB2E4\uC2DC \uC2DC\uB3C4");
  button.type = "button";
  button.addEventListener("click", retry);
  state2.append(
    createElement("span", "state-code", "\uC5F0\uACB0 \uC624\uB958"),
    createElement("h2", "state-title", "\uBA54\uB274\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4"),
    createElement("p", "state-copy", message),
    button
  );
  elements2.content.replaceChildren(state2);
}
function renderEmpty(elements2, title, description) {
  const state2 = createElement("section", "state-panel empty-state");
  state2.append(
    createElement("span", "empty-symbol", "\u2014"),
    createElement("h2", "state-title", title),
    createElement("p", "state-copy", description)
  );
  elements2.content.replaceChildren(state2);
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
function renderRestaurant(restaurant, hideHeading = false) {
  const article = createElement("article", "restaurant-card");
  if (!hideHeading) {
    const heading = createElement("div", "restaurant-heading");
    heading.append(createElement("h3", "restaurant-name", restaurant.name));
    if (restaurant.fixed_menu) heading.append(createElement("span", "fixed-badge", "\uC0C1\uC2DC \uBA54\uB274"));
    article.append(heading);
  }
  const meals = createElement("ul", "meal-list");
  if (restaurant.meals.length === 0) {
    meals.append(createElement("li", "restaurant-empty", "\uB4F1\uB85D\uB41C \uBA54\uB274\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."));
  } else {
    for (const meal of restaurant.meals) meals.append(renderMeal(meal));
  }
  article.append(meals);
  return article;
}
function renderVenueCard(buildingNumber, venue) {
  const section = createElement("section", "building-card");
  const heading = createElement("header", "building-heading");
  const title = createElement("h2", "building-title");
  title.append(createElement("span", "building-number", buildingNumber));
  const standalone = venue.name === null && venue.restaurants.length === 1;
  const titleLabel = venue.name ?? (standalone ? venue.restaurants[0].name : null);
  if (titleLabel) title.append(createElement("span", "building-name", titleLabel));
  if (standalone && venue.restaurants[0].fixed_menu) {
    title.append(createElement("span", "fixed-badge", "\uC0C1\uC2DC \uBA54\uB274"));
  }
  heading.append(title);
  const restaurants = createElement("div", "restaurant-list");
  for (const restaurant of venue.restaurants) {
    restaurants.append(renderRestaurant(restaurant, standalone));
  }
  section.append(heading, restaurants);
  return section;
}
function renderMenu(state2, elements2) {
  if (!state2.currentMenu || state2.currentMenu.date !== state2.selectedDate) return;
  const section = state2.currentMenu.types.find(
    (candidate) => candidate.type === state2.selectedType
  );
  if (!section) {
    renderEmpty(
      elements2,
      `${TYPE_LABELS[state2.selectedType]} \uBA54\uB274\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4`,
      "\uB2E4\uB978 \uC2DD\uC0AC \uC2DC\uAC04\uC774\uB098 \uB0A0\uC9DC\uB97C \uC120\uD0DD\uD574 \uBCF4\uC138\uC694."
    );
    return;
  }
  const venueCards = section.buildings.flatMap(
    (building) => building.venues.map((venue) => ({
      building_number: building.building_number,
      name: venue.name,
      restaurants: venue.restaurants.filter(
        (restaurant) => state2.includeFixed || !restaurant.fixed_menu
      )
    }))
  ).filter((venue) => venue.restaurants.length > 0);
  if (venueCards.length === 0) {
    renderEmpty(
      elements2,
      state2.includeFixed ? "\uB4F1\uB85D\uB41C \uBA54\uB274\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" : "\uC624\uB298\uC758 \uC2DD\uB2E8 \uBA54\uB274\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
      state2.includeFixed ? "\uB2E4\uB978 \uC2DD\uC0AC \uC2DC\uAC04\uC774\uB098 \uB0A0\uC9DC\uB97C \uC120\uD0DD\uD574 \uBCF4\uC138\uC694." : "\uC0C1\uC2DC \uBA54\uB274\uB97C \uD3EC\uD568\uD558\uAC70\uB098 \uB2E4\uB978 \uC2DD\uC0AC \uC2DC\uAC04\uC744 \uC120\uD0DD\uD574 \uBCF4\uC138\uC694."
    );
    return;
  }
  const fragment = document.createDocumentFragment();
  const heading = createElement("div", "result-heading");
  heading.append(
    createElement("p", "result-eyebrow", TYPE_LABELS[state2.selectedType]),
    createElement(
      "h2",
      "result-title",
      DATE_HEADING_FORMATTER.format(dateFromIso(state2.selectedDate))
    ),
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
  elements2.content.replaceChildren(fragment);
}

// src/web/app.ts
var elements = {
  app: requireElement("app"),
  statusLine: requireElement("data-status"),
  datePicker: requireElement("date-picker"),
  typePicker: requireElement("type-picker"),
  fixedToggle: requireElement("fixed-toggle"),
  content: requireElement("content")
};
var state = createInitialState();
function errorMessage(error) {
  return error instanceof Error ? error.message : "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
}
function renderControls() {
  renderManifest(state, elements);
  renderDatePicker(state, elements, () => {
    updateQueryState(state);
    renderControls();
    void loadSelectedMenu();
  });
  renderTypePicker(state, elements, () => {
    updateQueryState(state);
    renderControls();
    renderMenu(state, elements);
  });
}
async function loadSelectedMenu() {
  if (!state.dataBase || !state.selectedDate) {
    renderEmpty(elements, "\uC81C\uACF5\uB418\uB294 \uB0A0\uC9DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4", "\uC544\uC9C1 \uC0DD\uC131\uB41C \uBA54\uB274 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return;
  }
  const sequence = ++state.requestSequence;
  const cached = state.menuCache.get(state.selectedDate);
  if (cached) {
    state.currentMenu = cached;
    renderMenu(state, elements);
    return;
  }
  renderLoading(elements);
  try {
    const menu = await loadMenu(state.dataBase, state.selectedDate);
    if (sequence !== state.requestSequence) return;
    state.menuCache.set(state.selectedDate, menu);
    state.currentMenu = menu;
    renderMenu(state, elements);
  } catch (error) {
    if (sequence !== state.requestSequence) return;
    renderError(elements, errorMessage(error), () => void loadSelectedMenu());
  }
}
async function initialize() {
  state.requestSequence += 1;
  renderLoading(elements);
  elements.app.setAttribute("aria-busy", "true");
  try {
    state.dataBase = await resolveDataBase();
    state.manifest = await loadManifest(state.dataBase);
    state.menuCache.clear();
    applyQueryState(state);
    updateQueryState(state);
    elements.fixedToggle.checked = state.includeFixed;
    renderControls();
    await loadSelectedMenu();
  } catch (error) {
    renderError(elements, errorMessage(error), () => void initialize());
  } finally {
    elements.app.setAttribute("aria-busy", "false");
  }
}
elements.fixedToggle.addEventListener("change", () => {
  state.includeFixed = elements.fixedToggle.checked;
  updateQueryState(state);
  renderMenu(state, elements);
});
void initialize();
