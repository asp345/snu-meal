import { createEffect, on } from "solid-js";
import { dateFromIso } from "../state";
import { DATE_HEADING_FORMATTER, WEEKDAY_FORMATTER } from "../format";

interface DatePickerProps {
  dates: string[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}

interface Drag {
  pointerId: number;
  startX: number;
  startLeft: number;
  moved: boolean;
}

const DRAG_THRESHOLD = 6;

function middle(element: HTMLElement): number {
  return element.offsetLeft + element.offsetWidth / 2;
}

export function DatePicker(props: DatePickerProps) {
  let container!: HTMLDivElement;
  let positioned = false;
  let drag: Drag | undefined;

  const centerOn = (option: HTMLElement, behavior: ScrollBehavior) => {
    container.scrollTo({ left: middle(option) - container.clientWidth / 2, behavior });
  };

  const centeredOption = () => {
    const center = container.scrollLeft + container.clientWidth / 2;
    const options = [...container.querySelectorAll<HTMLElement>(".date-option")];
    return options.reduce((nearest, option) =>
      Math.abs(middle(option) - center) < Math.abs(middle(nearest) - center) ? option : nearest,
    );
  };

  createEffect(
    on([() => props.dates, () => props.selectedDate], () => {
      const selected = container.querySelector<HTMLElement>(`[data-date="${props.selectedDate}"]`);
      if (!selected) return;
      centerOn(selected, positioned ? "smooth" : "instant");
      positioned = true;
    }),
  );

  const selectCentered = () => {
    if (drag) return;
    const date = centeredOption().dataset.date!;
    if (date !== props.selectedDate) props.onSelect(date);
  };

  const startDrag = (event: PointerEvent) => {
    if (event.button !== 0) return;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startLeft: container.scrollLeft,
      moved: false,
    };
  };

  const moveDrag = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(distance) < DRAG_THRESHOLD) return;
      drag.moved = true;
      container.setPointerCapture(event.pointerId);
      container.classList.add("dragging");
    }
    container.scrollLeft = drag.startLeft - distance;
  };

  const endDrag = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    drag = undefined;
    if (!moved) return;
    container.classList.remove("dragging");
    centerOn(centeredOption(), "smooth");
  };

  return (
    <div class="date-dial">
      <div
        class="date-picker"
        role="group"
        aria-label="날짜 선택"
        ref={container}
        onScrollEnd={selectCentered}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
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
