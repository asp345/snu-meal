import type { Venue } from "../types";
import { RestaurantCard } from "./RestaurantCard";

interface BuildingCardProps {
  buildingNumber: string;
  venue: Venue;
}

export function BuildingCard(props: BuildingCardProps) {
  const standalone = props.venue.name === null && props.venue.restaurants.length === 1;
  const titleLabel = props.venue.name ?? (standalone ? props.venue.restaurants[0].name : null);

  return (
    <section class="building-card">
      <header class="building-heading">
        <h2 class="building-title">
          <span class="building-number">{props.buildingNumber}</span>
          {titleLabel && <span class="building-name">{titleLabel}</span>}
          {standalone && props.venue.restaurants[0].fixed_menu && (
            <span class="fixed-badge">상시 메뉴</span>
          )}
        </h2>
      </header>
      <div class="restaurant-list">
        {props.venue.restaurants.map((restaurant) => (
          <RestaurantCard restaurant={restaurant} hideHeading={standalone} />
        ))}
      </div>
    </section>
  );
}
