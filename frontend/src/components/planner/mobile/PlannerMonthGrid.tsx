import { ChevronLeft, ChevronRight } from "lucide-react";

import type { PlannerEntry } from "@/hooks/usePlannerDay";
import { parseDateString } from "@/lib/dateTime";
import { KIND_COLORS, KIND_ORDER } from "@/lib/plannerColors";
import { sameMonth } from "@/lib/plannerDates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface PlannerMonthGridProps {
  monthKey: string; // any day inside the month being shown
  days: string[]; // every cell, Monday first
  entriesByDay: Map<string, PlannerEntry[]>;
  selected: string;
  todayKey: string;
  onPickDay: (dateKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

// The month as a grid. Each day shows a small dot for every kind of item on
// it (class, study session, exam...). Tap a day to open it.
export default function PlannerMonthGrid({
  monthKey,
  days,
  entriesByDay,
  selected,
  todayKey,
  onPickDay,
  onPrev,
  onNext,
}: PlannerMonthGridProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className="flex size-11 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="text-xs text-muted-foreground">Tap a day to open it</span>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className="flex size-11 items-center justify-center rounded-full bg-card"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((name) => (
          <span key={name} className="py-1 text-[11px] font-medium text-muted-foreground">
            {name}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((dateKey) => {
          const entries = entriesByDay.get(dateKey) ?? [];
          const kinds = KIND_ORDER.filter((kind) => entries.some((e) => e.kind === kind));
          const inMonth = sameMonth(dateKey, monthKey);
          const isSelected = dateKey === selected;
          const isToday = dateKey === todayKey;
          const dayNumber = parseDateString(dateKey)?.getDate() ?? "";

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onPickDay(dateKey)}
              aria-label={`${dateKey}, ${entries.length} items`}
              aria-pressed={isSelected}
              className={cn(
                "flex h-14 flex-col items-center justify-start gap-1 rounded-2xl pt-1.5 transition-colors",
                !inMonth && "opacity-40"
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "ring-2 ring-primary/70"
                      : ""
                )}
              >
                {dayNumber}
              </span>
              <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                {kinds.slice(0, 4).map((kind) => (
                  <span
                    key={kind}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: KIND_COLORS[kind] }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}