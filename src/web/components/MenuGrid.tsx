import { For, Show, createMemo } from "solid-js";
import type { DateMenu, MealType } from "../types";
import { dateFromIso } from "../state";
import { DATE_HEADING_FORMATTER, TYPE_LABELS } from "../format";
import { BuildingCard } from "./BuildingCard";
import { StatePanel } from "./StatePanel";

interface MenuGridProps {
  menu: DateMenu;
  selectedType: MealType;
  includeFixed: boolean;
}

export function MenuGrid(props: MenuGridProps) {
  const section = createMemo(() => props.menu.types.find((t) => t.type === props.selectedType));

  const venues = createMemo(() =>
    (section()?.buildings ?? [])
      .flatMap((building) =>
        building.venues.map((venue) => ({
          building_number: building.building_number,
          name: venue.name,
          restaurants: venue.restaurants.filter((r) => props.includeFixed || !r.fixed_menu),
        })),
      )
      .filter((venue) => venue.restaurants.length > 0),
  );

  const buildingCount = createMemo(() => new Set(venues().map((v) => v.building_number)).size);
  const restaurantCount = createMemo(() =>
    venues().reduce((sum, venue) => sum + venue.restaurants.length, 0),
  );

  return (
    <Show
      when={section()}
      fallback={
        <StatePanel
          variant="empty"
          title={`${TYPE_LABELS[props.selectedType]} 메뉴가 없습니다`}
          description="다른 식사 시간이나 날짜를 선택해 보세요."
        />
      }
    >
      <Show
        when={venues().length > 0}
        fallback={
          <StatePanel
            variant="empty"
            title={props.includeFixed ? "등록된 메뉴가 없습니다" : "오늘의 식단 메뉴가 없습니다"}
            description={
              props.includeFixed
                ? "다른 식사 시간이나 날짜를 선택해 보세요."
                : "상시 메뉴를 포함하거나 다른 식사 시간을 선택해 보세요."
            }
          />
        }
      >
        <div class="result-heading">
          <p class="result-eyebrow">{TYPE_LABELS[props.selectedType]}</p>
          <h2 class="result-title">
            {DATE_HEADING_FORMATTER.format(dateFromIso(props.menu.date))}
          </h2>
          <p class="result-count">
            {buildingCount()}개 건물 · {restaurantCount()}개 식당
          </p>
        </div>
        <div class="building-grid">
          <For each={venues()}>
            {(venue) => <BuildingCard buildingNumber={venue.building_number} venue={venue} />}
          </For>
        </div>
      </Show>
    </Show>
  );
}
