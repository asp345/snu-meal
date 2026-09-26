import { dateFromIso } from "../state";
import { DATE_HEADING_FORMATTER, DATE_SHORT_FORMATTER, WEEKDAY_FORMATTER } from "../format";

interface DatePickerProps {
  dates: string[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}

export function DatePicker(props: DatePickerProps) {
  return (
    <div class="date-picker" role="group" aria-label="날짜 선택">
      {props.dates.map((date) => {
        const value = dateFromIso(date);
        const isSelected = date === props.selectedDate;
        return (
          <button
            type="button"
            class="date-option"
            data-date={date}
            aria-pressed={isSelected}
            aria-label={`${DATE_HEADING_FORMATTER.format(value)} 메뉴`}
            onClick={() => props.onSelect(date)}
          >
            <span class="date-weekday">
              {date === props.today ? "오늘" : WEEKDAY_FORMATTER.format(value)}
            </span>
            <span class="date-number">{DATE_SHORT_FORMATTER.format(value)}</span>
          </button>
        );
      })}
    </div>
  );
}
