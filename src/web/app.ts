import { loadManifest, loadMenu, resolveDataBase } from "./data.js";
import { requireElement } from "./dom.js";
import {
  renderDatePicker,
  renderEmpty,
  renderError,
  renderLoading,
  renderManifest,
  renderMenu,
  renderTypePicker,
  type Elements,
} from "./render.js";
import { applyQueryState, createInitialState, updateQueryState } from "./state.js";

const elements: Elements = {
  app: requireElement<HTMLElement>("app"),
  statusLine: requireElement<HTMLElement>("data-status"),
  datePicker: requireElement<HTMLElement>("date-picker"),
  typePicker: requireElement<HTMLElement>("type-picker"),
  fixedToggle: requireElement<HTMLInputElement>("fixed-toggle"),
  content: requireElement<HTMLElement>("content"),
};
const state = createInitialState();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

function renderControls(): void {
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

async function loadSelectedMenu(): Promise<void> {
  if (!state.dataBase || !state.selectedDate) {
    renderEmpty(elements, "제공되는 날짜가 없습니다", "아직 생성된 메뉴 데이터가 없습니다.");
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

async function initialize(): Promise<void> {
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
