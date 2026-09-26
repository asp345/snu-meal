import {
  createSignal,
  createEffect,
  createResource,
  Show,
  Suspense,
  ErrorBoundary,
} from "solid-js";
import type { MealType } from "./types";
import { resolveDataBase, loadManifest, loadMenu } from "./data";
import { localIsoDate, initialMealType } from "./state";
import { UPDATED_FORMATTER } from "./format";
import { Header } from "./components/Header";
import { ControlBar } from "./components/ControlBar";
import { MenuGrid } from "./components/MenuGrid";
import { StatePanel } from "./components/StatePanel";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

export function App() {
  const today = localIsoDate();
  const params = new URLSearchParams(location.search);

  const [selectedDate, setSelectedDate] = createSignal(params.get("date") || "");
  const [selectedType, setSelectedType] = createSignal<MealType>(
    params.get("type") === "BR" || params.get("type") === "LU" || params.get("type") === "DN"
      ? (params.get("type") as MealType)
      : initialMealType(),
  );
  const [includeFixed, setIncludeFixed] = createSignal(
    params.get("fixed") === "1" || params.get("fixed") === "true",
  );

  const [dataBase] = createResource(resolveDataBase);
  const [manifest] = createResource(dataBase, (base) => loadManifest(base));
  const [menu] = createResource(
    () => ({ base: dataBase(), date: selectedDate() }),
    ({ base, date }) => {
      if (!base || !date) return null;
      return loadMenu(base, date);
    },
  );

  createEffect(() => {
    const params = new URLSearchParams();
    if (selectedDate()) params.set("date", selectedDate());
    params.set("type", selectedType());
    if (includeFixed()) params.set("fixed", "1");
    const query = params.toString();
    history.replaceState(
      null,
      "",
      `${location.pathname}${query ? "?" + query : ""}${location.hash}`,
    );
  });

  createEffect(() => {
    if (manifest.state === "ready" && !selectedDate()) {
      const dates = [...manifest()!.available_dates].sort();
      const initial =
        params.get("date") && dates.includes(params.get("date")!)
          ? params.get("date")!
          : dates.includes(today)
            ? today
            : dates[dates.length - 1];
      setSelectedDate(initial);
    }
  });

  const statusText = () => {
    const m = manifest();
    if (!m) return "최신 메뉴 확인 중";
    const generated = new Date(m.generated_at);
    return Number.isNaN(generated.getTime())
      ? "메뉴 업데이트 시간 미상"
      : `${UPDATED_FORMATTER.format(generated)} 업데이트`;
  };

  const sortedDates = () => {
    const m = manifest();
    if (!m) return [];
    return [...m.available_dates].sort((a, b) => a.localeCompare(b));
  };

  return (
    <div class="page-shell">
      <Header statusText={statusText()} />
      <main>
        <div class="content">
          <ErrorBoundary
            fallback={(err, reset) => (
              <StatePanel variant="error" description={errorMessage(err)} onRetry={reset} />
            )}
          >
            <Suspense fallback={<StatePanel variant="loading" />}>
              <Show when={manifest()}>
                <Show when={menu()}>
                  {(menuData) => (
                    <MenuGrid
                      menu={menuData()}
                      selectedType={selectedType()}
                      includeFixed={includeFixed()}
                    />
                  )}
                </Show>
              </Show>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <ControlBar
        dates={sortedDates()}
        selectedDate={selectedDate()}
        selectedType={selectedType()}
        includeFixed={includeFixed()}
        today={today}
        onDateSelect={setSelectedDate}
        onTypeSelect={setSelectedType}
        onFixedToggle={setIncludeFixed}
      />
      <footer class="site-footer">
        <p>식단과 가격은 식당 사정에 따라 달라질 수 있습니다.</p>
      </footer>
    </div>
  );
}
