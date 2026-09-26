import type { MealType } from "../types";
import { TYPE_LABELS } from "../format";

interface TypePickerProps {
  selectedType: MealType;
  onSelect: (type: MealType) => void;
}

export function TypePicker(props: TypePickerProps) {
  return (
    <div class="type-picker" role="group" aria-label="식사 시간">
      {(["BR", "LU", "DN"] as const).map((type) => (
        <button
          type="button"
          class="type-option"
          aria-pressed={type === props.selectedType}
          onClick={() => props.onSelect(type)}
        >
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}
