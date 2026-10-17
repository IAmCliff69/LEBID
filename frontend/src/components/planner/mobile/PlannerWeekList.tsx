import PlannerTimeline from "@/components/planner/mobile/PlannerTimeline";
import type { PlannerEntry } from "@/hooks/usePlannerDay";
import { formatDateLabel } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

interface PlannerWeekListProps {
  days: string[]; // the 7 days, Monday first
  entriesByDay: Map<string, PlannerEntry[]>;
  selected: string;
  todayKey: string;
  now: Date;
  highlightId: string | null;
  onOpen: (entry: PlannerEntry) => void;
  onSelect: (dateKey: string) => void;
}

// The week as a list: a sticky heading per day, then that day's cards.
// The headings stay under the pinned calendar header while you scroll
// (the page sets --planner-head to the height of that header).
export default function PlannerWeekList({
  days,
  entriesByDay,
  selected,
  todayKey,
  now,
  highlightId,
  onOpen,
  onSelect,
}: PlannerWeekListProps) {
  return (
    <div className="space-y-1">
      {days.map((dateKey) => {
        const entries = entriesByDay.get(dateKey) ?? [];
        const isToday = dateKey === todayKey;
        const isSelected = dateKey === selected;

        return (
          <section key={dateKey} aria-label={formatDateLabel(dateKey)}>
            <button
              type="button"
              onClick={() => onSelect(dateKey)}
              className="sticky top-[calc(3.75rem+env(safe-area-inset-top)+var(--planner-head,9rem))] z-10 flex w-full items-baseline justify-between bg-background py-2 text-left"
            >
              <span
                className={cn(
                  "text-sm font-bold",
                  isToday || isSelected ? "text-primary" : "text-foreground"
                )}
              >
                {formatDateLabel(dateKey).replace(/, \d{4}$/, "")}
                {isToday && (
                  <span className="ml-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    Today
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? "item" : "items"}
              </span>
            </button>

            {entries.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                Nothing planned
              </p>
            ) : (
              <PlannerTimeline
                entries={entries}
                isToday={isToday}
                now={now}
                highlightId={highlightId}
                onOpen={onOpen}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}