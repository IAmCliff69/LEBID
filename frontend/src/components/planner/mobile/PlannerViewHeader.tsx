import { ChevronDown } from "lucide-react";

import type { PlannerMode } from "@/lib/plannerDates";
import { cn } from "@/lib/utils";

const MODES: { value: PlannerMode; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

interface PlannerViewHeaderProps {
  monthLabel: string;
  mode: PlannerMode;
  onModeChange: (mode: PlannerMode) => void;
  onOpenPicker: () => void;
}

// "October 2026 v" (opens the month picker) and the Day | Week | Month switch.
export default function PlannerViewHeader({
  monthLabel,
  mode,
  onModeChange,
  onOpenPicker,
}: PlannerViewHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onOpenPicker}
        aria-label={`${monthLabel}. Choose a month`}
        className="inline-flex min-h-11 min-w-0 items-center gap-1 text-base font-bold"
      >
        <span className="truncate">{monthLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <div
        role="tablist"
        aria-label="Calendar view"
        className="flex shrink-0 rounded-full bg-card p-0.5"
      >
        {MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={mode === item.value}
            onClick={() => onModeChange(item.value)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-semibold transition-colors",
              mode === item.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}