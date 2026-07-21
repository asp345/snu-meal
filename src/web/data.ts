import type { DateMenu, LegacyDateMenu, Manifest } from "./types.js";

const REPOSITORY = "asp345/snu-meal";

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`요청 실패 (${response.status})`);
  return (await response.json()) as T;
}

export async function resolveDataBase(): Promise<string> {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return "./data";
  try {
    const commit = await fetchJson<{ sha?: unknown }>(
      `https://api.github.com/repos/${REPOSITORY}/commits/data`,
    );
    if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/i.test(commit.sha)) {
      throw new Error("올바른 데이터 커밋을 찾지 못했습니다.");
    }
    return `https://raw.githubusercontent.com/${REPOSITORY}/${commit.sha}`;
  } catch {
    return `https://raw.githubusercontent.com/${REPOSITORY}/data?t=${Date.now()}`;
  }
}

export function normalizeMenu(menu: DateMenu | LegacyDateMenu): DateMenu {
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

export async function loadManifest(dataBase: string): Promise<Manifest> {
  const manifest = await fetchJson<Manifest>(`${dataBase}/manifest.json`);
  if (![1, 2].includes(manifest.schema_version) || !Array.isArray(manifest.available_dates)) {
    throw new Error("지원하지 않는 데이터 형식입니다.");
  }
  return manifest;
}

export async function loadMenu(dataBase: string, date: string): Promise<DateMenu> {
  const response = await fetchJson<DateMenu | LegacyDateMenu>(`${dataBase}/menus/${date}.json`);
  if (response.date !== date || !Array.isArray(response.types)) {
    throw new Error("메뉴 데이터 형식이 올바르지 않습니다.");
  }
  return normalizeMenu(response);
}
