import type { CalendarMarker } from "@/hooks/useCalendarMarkers";
import { cn } from "@/lib/utils";

const TYPE_INFO: Record<
  CalendarMarker["type"],
  { label: string; classes: string }
> = {
  exam: {
    label: "Exam",
    classes: "border-destructive/40 bg-destructive/15 text-destructive",
  },
  assignment: {
    label: "Assignment",
    classes: "border-warning/40 bg-warning/15 text-warning",
  },
  task: {
    label: "Task",
    classes: "border-primary/30 bg-primary/10 text-primary",
  },
  event: {
    label: "Event",
    classes: "border-border bg-secondary text-secondary-foreground",
  },
};

interface BlockProps {
  marker: CalendarMarker;
  top: number;
  height: number;
  onOpen: () => void;
}

// A marker in the week/day view: a small tag on the right half of the column.
export function PlannerMarkerBlock({ marker, top, height, onOpen }: BlockProps) {
  const info = TYPE_INFO[marker.type];

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${info.label}: ${marker.title} (${marker.timeLabel})`}
      className={cn(
        "absolute right-0.5 z-20 w-[58%] overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        info.classes,
        marker.isDone && "opacity-60"
      )}
      style={{ top, height }}
    >
      <p className="truncate text-[8px] font-bold uppercase tracking-wide">
        {info.label}
        {marker.courseCode ? ` · ${marker.courseCode}` : ""}
      </p>
      {height >= 34 && (
        <p
          className={cn(
            "truncate text-[10px] font-semibold",
            marker.isDone && "line-through"
          )}
        >
          {marker.title}
        </p>
      )}
      {height >= 52 && (
        <p className="truncate text-[9px] opacity-80">{marker.timeLabel}</p>
      )}
    </button>
  );
}

// A marker in the month view: a one-line chip.
export function PlannerMarkerChip({
  marker,
  onOpen,
}: {
  marker: CalendarMarker;
  onOpen: () => void;
}) {
  const info = TYPE_INFO[marker.type];

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${info.label}: ${marker.title} (${marker.timeLabel})`}
      className={cn(
        "block w-full truncate rounded border px-1 py-0.5 text-left text-[8px] font-semibold sm:text-[9px]",
        info.classes,
        marker.isDone && "line-through opacity-60"
      )}
    >
      {info.label}: {marker.title}
    </button>
  );
}

// A tick box row for the "Other calendars" card.
export function CalendarToggle({
  checked,
  onChange,
  label,
  dotClassName,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  dotClassName: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-muted"
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border",
          checked ? "border-primary bg-primary" : "border-border"
        )}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-card" />}
      </span>
      <span className={cn("h-2.5 w-2.5 rounded-full", dotClassName)} />
      <span className="text-xs text-secondary-foreground">{label}</span>
    </button>
  );
}