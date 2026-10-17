import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import BottomSheet from "@/components/mobile/BottomSheet";
import { parseDateString } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface PlannerMonthPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: string; // "YYYY-MM-DD"
  todayKey: string;
  onPick: (year: number, monthIndex: number) => void;
}

// A sheet with the 12 months of a year. Tap one to jump there.
export default function PlannerMonthPicker({
  open,
  onOpenChange,
  selected,
  todayKey,
  onPick,
}: PlannerMonthPickerProps) {
  const selectedDate = parseDateString(selected) ?? new Date();
  const todayDate = parseDateString(todayKey) ?? new Date();
  const [year, setYear] = useState(selectedDate.getFullYear());

  // Each time the sheet opens it starts on the year being viewed
  useEffect(() => {
    if (open) setYear(selectedDate.getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Choose a month">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Previous year"
            className="flex size-11 items-center justify-center rounded-full bg-muted"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <h2 className="text-lg font-bold">{year}</h2>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            aria-label="Next year"
            className="flex size-11 items-center justify-center rounded-full bg-muted"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((name, index) => {
            const isSelected =
              year === selectedDate.getFullYear() && index === selectedDate.getMonth();
            const isThisMonth =
              year === todayDate.getFullYear() && index === todayDate.getMonth();
            return (
              <button
                key={name}
                type="button"
                onClick={() => onPick(year, index)}
                className={cn(
                  "h-12 rounded-2xl text-sm font-semibold transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                  !isSelected && isThisMonth && "ring-2 ring-primary/60"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}