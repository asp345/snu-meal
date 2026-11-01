import { createEffect, on } from "solid-js";
import { dateFromIso } from "../state";
import { DATE_HEADING_FORMATTER, WEEKDAY_FORMATTER } from "../format";

interface DatePickerProps {
  dates: string[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}

function middle(element: HTMLElement): number {
  return element.offsetLeft + element.offsetWidth / 2;
}

export function DatePicker(props: DatePickerProps) {
  let container!: HTMLDivElement;
  let positioned = false;

  createEffect(
    on([() => props.dates, () => props.selectedDate], () => {
      const selected = container.querySelector<HTMLElement>(`[data-date="${props.selectedDate}"]`);
      if (!selected) return;
      container.scrollTo({
        left: middle(selected) - container.clientWidth / 2,
        behavior: positioned ? "smooth" : "instant",
      });
      positioned = true;
    }),
  );

  const selectCentered = () => {
    const center = container.scrollLeft + container.clientWidth / 2;
    const options = [...container.querySelectorAll<HTMLElement>(".date-option")];
    const centered = options.reduce((nearest, option) =>
      Math.abs(middle(option) - center) < Math.abs(middle(nearest) - center) ? option : nearest,
    );
    if (centered.dataset.date !== props.selectedDate) props.onSelect(centered.dataset.date!);
  };

  return (
    <div class="date-dial">
      <div
        class="date-picker"
        role="group"
        aria-label="날짜 선택"
        ref={container}
        onScrollEnd={selectCentered}
      >
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
              <span class="date-number">{`${value.getMonth() + 1}.${value.getDate()}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
