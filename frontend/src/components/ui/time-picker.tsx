import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  pickerTriggerClass,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatTimeLabel,
  parseTimeString,
  toTimeString,
} from "@/lib/dateTime";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59
const PERIODS = ["AM", "PM"] as const;

const itemClass =
  "flex h-8 w-full items-center justify-center rounded-lg text-sm tabular-nums transition-colors";

interface TimeColumnsProps {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
}

// Three columns: hour, minute and AM/PM. Also used inside DateTimePicker.
export function TimeColumns({ value, onChange }: TimeColumnsProps) {
  const parsed = parseTimeString(value);
  const hasValue = parsed !== null;
  // With no time chosen yet, the first click starts from 9:00 AM.
  const base = parsed ?? { hour: 9, minute: 0 };
  const period = base.hour >= 12 ? "PM" : "AM";
  const hour12 = base.hour % 12 || 12;

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // When the picker opens, scroll the chosen hour and minute into view.
  useEffect(() => {
    for (const ref of [hourRef, minuteRef]) {
      const container = ref.current;
      const selected = container?.querySelector<HTMLElement>(
        '[data-selected="true"]'
      );
      if (container && selected) {
        container.scrollTop =
          selected.offsetTop -
          container.clientHeight / 2 +
          selected.clientHeight / 2;
      }
    }
  }, []);

  const pickHour = (hour: number) => {
    const hour24 = period === "PM" ? (hour % 12) + 12 : hour % 12;
    onChange(toTimeString(hour24, base.minute));
  };

  const pickMinute = (minute: number) => {
    onChange(toTimeString(base.hour, minute));
  };

  const pickPeriod = (newPeriod: "AM" | "PM") => {
    const hour24 = newPeriod === "PM" ? (base.hour % 12) + 12 : base.hour % 12;
    onChange(toTimeString(hour24, base.minute));
  };

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <p className="mb-1 text-center text-xs font-medium text-muted-foreground">
          Hour
        </p>
        <div ref={hourRef} className="relative h-44 space-y-0.5 overflow-y-auto pr-1">
          {HOURS.map((hour) => {
            const isSelected = hasValue && hour === hour12;
            return (
              <button
                key={hour}
                type="button"
                data-selected={isSelected}
                onClick={() => pickHour(hour)}
                className={cn(
                  itemClass,
                  isSelected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {hour}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1">
        <p className="mb-1 text-center text-xs font-medium text-muted-foreground">
          Minute
        </p>
        <div ref={minuteRef} className="relative h-44 space-y-0.5 overflow-y-auto pr-1">
          {MINUTES.map((minute) => {
            const isSelected = hasValue && minute === base.minute;
            return (
              <button
                key={minute}
                type="button"
                data-selected={isSelected}
                onClick={() => pickMinute(minute)}
                className={cn(
                  itemClass,
                  isSelected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {String(minute).padStart(2, "0")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-14">
        <p className="mb-1 text-center text-xs font-medium text-muted-foreground">
          &nbsp;
        </p>
        <div className="space-y-0.5">
          {PERIODS.map((p) => {
            const isSelected = hasValue && p === period;
            return (
              <button
                key={p}
                type="button"
                onClick={() => pickPeriod(p)}
                className={cn(
                  itemClass,
                  isSelected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TimePickerProps {
  id?: string;
  value?: string; // "HH:MM"
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean; // show a Clear button (for optional times)
  disabled?: boolean;
  invalid?: boolean;
}

export function TimePicker({
  id,
  value,
  onChange,
  placeholder = "Select time",
  clearable = false,
  disabled = false,
  invalid = false,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const label = formatTimeLabel(value);

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
          <Clock3 className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-60">
        <TimeColumns value={value ?? ""} onChange={onChange} />

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