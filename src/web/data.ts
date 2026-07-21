import type { DateMenu, Manifest } from "./types.js";

const REPOSITORY = "asp345/snu-meal";

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`요청 실패 (${response.status})`);
  return (await response.json()) as T;
}

export async function resolveDataBase(): Promise<string> {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return "./data";
  const commit = await fetchJson<{ sha?: unknown }>(
    `https://api.github.com/repos/${REPOSITORY}/commits/data`,
  );
  if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/i.test(commit.sha)) {
    throw new Error("올바른 데이터 커밋을 찾지 못했습니다.");
  }
  return `https://raw.githubusercontent.com/${REPOSITORY}/${commit.sha}`;
}

export async function loadManifest(dataBase: string): Promise<Manifest> {
  const manifest = await fetchJson<Manifest>(`${dataBase}/manifest.json`);
  if (manifest.schema_version !== 2 || !Array.isArray(manifest.available_dates)) {
    throw new Error("지원하지 않는 데이터 형식입니다.");
  }
  return manifest;
}

export async function loadMenu(dataBase: string, date: string): Promise<DateMenu> {
  const menu = await fetchJson<DateMenu>(`${dataBase}/menus/${date}.json`);
  if (menu.date !== date || !Array.isArray(menu.types)) {
    throw new Error("메뉴 데이터 형식이 올바르지 않습니다.");
  }
  return menu;
}
