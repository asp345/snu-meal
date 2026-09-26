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
  const section = props.menu.types.find((t) => t.type === props.selectedType);

  if (!section) {
    return (
      <StatePanel
        variant="empty"
        title={`${TYPE_LABELS[props.selectedType]} 메뉴가 없습니다`}
        description="다른 식사 시간이나 날짜를 선택해 보세요."
      />
    );
  }

  const venueCards = section.buildings
    .flatMap((building) =>
      building.venues.map((venue) => ({
        building_number: building.building_number,
        name: venue.name,
        restaurants: venue.restaurants.filter((r) => props.includeFixed || !r.fixed_menu),
      })),
    )
    .filter((v) => v.restaurants.length > 0);

  if (venueCards.length === 0) {
    return (
      <StatePanel
        variant="empty"
        title={props.includeFixed ? "등록된 메뉴가 없습니다" : "오늘의 식단 메뉴가 없습니다"}
        description={
          props.includeFixed
            ? "다른 식사 시간이나 날짜를 선택해 보세요."
            : "상시 메뉴를 포함하거나 다른 식사 시간을 선택해 보세요."
        }
      />
    );
  }

  const buildingCount = new Set(venueCards.map((v) => v.building_number)).size;
  const restaurantCount = venueCards.reduce((sum, v) => sum + v.restaurants.length, 0);

  return (
    <>
      <div class="result-heading">
        <p class="result-eyebrow">{TYPE_LABELS[props.selectedType]}</p>
        <h2 class="result-title">{DATE_HEADING_FORMATTER.format(dateFromIso(props.menu.date))}</h2>
        <p class="result-count">
          {buildingCount}개 건물 · {restaurantCount}개 식당
        </p>
      </div>
      <div class="building-grid">
        {venueCards.map((v) => (
          <BuildingCard buildingNumber={v.building_number} venue={v} />
        ))}
      </div>
    </>
  );
}
