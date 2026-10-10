import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  pickerTriggerClass,
} from "@/components/ui/popover";
import { TimeColumns } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import {
  formatDateLabel,
  formatDateTimeLabel,
  joinDateTime,
  parseDateString,
  splitDateTime,
  toDateString,
} from "@/lib/dateTime";

// When a student picks only a date for a deadline, the time becomes 11:59 PM
// (the end of that day). They can change it in the time columns.
const DEFAULT_DEADLINE_TIME = "23:59";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface CalendarMonthProps {
  selected: string; // "YYYY-MM-DD" or ""
  onSelect: (value: string) => void;
}

// The month grid (weeks start on Monday, like the Study Planner).
function CalendarMonth({ selected, onSelect }: CalendarMonthProps) {
  const today = new Date();
  const todayString = toDateString(today);
  const selectedDate = parseDateString(selected);
  const selectedString = selectedDate ? toDateString(selectedDate) : "";

  // The month being shown (the 1st of it). Starts on the selected date's month.
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const goToMonth = (offset: number) => {
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1)
    );
  };

  // 42 cells (6 weeks) so the grid never changes height between months.
  const firstWeekday = (viewMonth.getDay() + 6) % 7; // Monday = 0
  const cells = Array.from({ length: 42 }, (_, index) => {
    return new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      index - firstWeekday + 1
    );
  });

  return (
    <div className="w-[17.5rem]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => goToMonth(-1)}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>

        <p className="text-sm font-semibold">
          {viewMonth.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>

        <button
          type="button"
          aria-label="Next month"
          onClick={() => goToMonth(1)}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="flex size-9 items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {cells.map((date) => {
          const dateString = toDateString(date);
          const isOutsideMonth = date.getMonth() !== viewMonth.getMonth();
          const isSelected = dateString === selectedString;
          const isToday = dateString === todayString;

          return (
            <button
              key={dateString}
              type="button"
              onClick={() => onSelect(dateString)}
              className={cn(
                "flex size-9 items-center justify-center rounded-xl text-sm transition-colors",
                isOutsideMonth ? "text-muted-foreground/50" : "text-foreground",
                isSelected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "hover:bg-muted",
                isToday &&
                  !isSelected &&
                  "border border-primary font-semibold text-primary"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean; // show a Clear button (for optional fields)
  disabled?: boolean;
  invalid?: boolean;
}

// Date only:  value like "2026-10-07"
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Select date",
  clearable = false,
  disabled = false,
  invalid = false,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const label = formatDateLabel(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={pickerTriggerClass}
        >
          <span className={cn("truncate", !label && "text-muted-foreground")}>
            {label || placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent>
        <CalendarMonth
          selected={value ?? ""}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />

        <div className="mt-3 flex items-center justify-between border-t border-input pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(toDateString(new Date()));
              setOpen(false);
            }}
          >
            Today
          </Button>

          {clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Date and time together:  value like "2026-10-07T14:30"
export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "Select date and time",
  clearable = false,
  disabled = false,
  invalid = false,
  defaultTime = DEFAULT_DEADLINE_TIME,
}: PickerProps & { defaultTime?: string }) {
  const [open, setOpen] = useState(false);
  const { date, time } = splitDateTime(value);
  const label = formatDateTimeLabel(value);

  const handleDate = (newDate: string) => {
        onChange(joinDateTime(newDate, time || defaultTime));
  };

  const handleTime = (newTime: string) => {
    onChange(joinDateTime(date || toDateString(new Date()), newTime));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={pickerTriggerClass}
        >
          <span className={cn("truncate", !label && "text-muted-foreground")}>
            {label || placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent>
        <CalendarMonth selected={date} onSelect={handleDate} />

        <div className="mt-3 border-t border-input pt-3">
          <TimeColumns value={time} onChange={handleTime} />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-input pt-3">
          {clearable && value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}