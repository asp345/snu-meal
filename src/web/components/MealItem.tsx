import type { Meal } from "../types";
import { PRICE_FORMATTER } from "../format";

interface MealItemProps {
  meal: Meal;
}

export function MealItem(props: MealItemProps) {
  return (
    <li class="meal">
      <div class="menu-names">
        {props.meal.menus.map((menu) => (
          <span class="menu-name">{menu}</span>
        ))}
      </div>
      <div class="meal-details">
        {props.meal.no_meat && <span class="no-meat-badge">육류 없음</span>}
        <span class={props.meal.price === null ? "price price-unknown" : "price"}>
          {props.meal.price === null ? "가격 정보 없음" : PRICE_FORMATTER.format(props.meal.price)}
        </span>
      </div>
    </li>
  );
}
