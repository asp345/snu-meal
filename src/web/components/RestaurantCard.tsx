import type { Restaurant } from "../types";
import { MealItem } from "./MealItem";

interface RestaurantCardProps {
  restaurant: Restaurant;
  hideHeading?: boolean;
}

export function RestaurantCard(props: RestaurantCardProps) {
  return (
    <article class="restaurant-card">
      {!props.hideHeading && (
        <div class="restaurant-heading">
          <h3 class="restaurant-name">{props.restaurant.name}</h3>
          {props.restaurant.fixed_menu && <span class="fixed-badge">상시 메뉴</span>}
        </div>
      )}
      <ul class="meal-list">
        {props.restaurant.meals.length === 0 ? (
          <li class="restaurant-empty">등록된 메뉴가 없습니다.</li>
        ) : (
          props.restaurant.meals.map((meal) => <MealItem meal={meal} />)
        )}
      </ul>
    </article>
  );
}
