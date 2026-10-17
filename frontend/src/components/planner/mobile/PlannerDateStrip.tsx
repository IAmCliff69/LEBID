import { useEffect, useRef } from "react";

import { toDateString } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

const DAYS_BEFORE = 30;
const DAYS_AFTER = 60;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface PlannerDateStripProps {
  selected: string; // "YYYY-MM-DD"
  onSelect: (dateKey: string) => void;
}

// A row of days you can swipe sideways. The selected day is taller and filled.
export default function PlannerDateStrip({ selected, onSelect }: PlannerDateStripProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const todayKey = toDateString(new Date());

  // Days from 30 days ago to 60 days ahead
  const days = Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, i) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - DAYS_BEFORE + i);
    return { key: toDateString(date), date };
  });

  // Keep the selected day in the middle of the row
  useEffect(() => {
    const row = rowRef.current;
    const button = row?.querySelector<HTMLElement>(`[data-day="${selected}"]`);
    if (!row || !button) return;
    row.scrollTo({
      left: button.offsetLeft - (row.clientWidth - button.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [selected]);

  return (
    <div
      ref={rowRef}
      role="listbox"
      aria-label="Choose a day"
      className="-mx-4 flex items-end gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map(({ key, date }) => {
        const isSelected = key === selected;
        return (
          <button
            key={key}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-day={key}
            onClick={() => onSelect(key)}
            className={cn(
              "flex w-[46px] shrink-0 flex-col items-center justify-center rounded-full transition-all",
              isSelected
                ? "h-[74px] bg-primary text-primary-foreground shadow-md"
                : "h-[60px] bg-card text-foreground"
            )}
          >
            <span className={cn("text-[11px]", isSelected ? "opacity-90" : "text-muted-foreground")}>
              {WEEKDAYS[date.getDay()]}
            </span>
            <span className="text-base leading-tight font-semibold">{date.getDate()}</span>
            {key === todayKey && !isSelected && (
              <span className="mt-0.5 size-1 rounded-full bg-primary" aria-label="Today" />
            )}
          </button>
        );
      })}
    </div>
  );
}