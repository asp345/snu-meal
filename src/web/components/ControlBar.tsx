import type { MealType } from "../types";
import { DatePicker } from "./DatePicker";
import { TypePicker } from "./TypePicker";
import { FixedToggle } from "./FixedToggle";

interface ControlBarProps {
  dates: string[];
  selectedDate: string;
  selectedType: MealType;
  includeFixed: boolean;
  today: string;
  onDateSelect: (date: string) => void;
  onTypeSelect: (type: MealType) => void;
  onFixedToggle: (checked: boolean) => void;
}

export function ControlBar(props: ControlBarProps) {
  return (
    <section class="control-bar" aria-label="메뉴 조회 조건">
      <div class="control-inner">
        <DatePicker
          dates={props.dates}
          selectedDate={props.selectedDate}
          today={props.today}
          onSelect={props.onDateSelect}
        />
        <div class="control-row">
          <TypePicker selectedType={props.selectedType} onSelect={props.onTypeSelect} />
          <FixedToggle checked={props.includeFixed} onChange={props.onFixedToggle} />
        </div>
      </div>
    </section>
  );
}
