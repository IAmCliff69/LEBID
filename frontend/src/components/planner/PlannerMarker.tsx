import type { CalendarMarker } from "@/hooks/useCalendarMarkers";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

// Markers drawn in a day column use its right 60%.
const ZONE_LEFT_PERCENT = 40;
const ZONE_WIDTH_PERCENT = 60;

// A marker is drawn at least this many minutes tall, so the overlap check
// uses the same minimum.
const MIN_VISIBLE_MINUTES = 40;

// Puts markers that overlap in time into the same group.
// Example: two tasks both due at 11:59 PM end up in one group of 2.
export function groupOverlappingMarkers(
  markers: CalendarMarker[]
): CalendarMarker[][] {
  const sorted = [...markers].sort((a, b) => a.startMin - b.startMin);
  const groups: CalendarMarker[][] = [];
  let groupEnd = -1;

  for (const marker of sorted) {
    const visibleEnd = Math.max(marker.endMin, marker.startMin + MIN_VISIBLE_MINUTES);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && marker.startMin < groupEnd) {
      lastGroup.push(marker);
      groupEnd = Math.max(groupEnd, visibleEnd);
    } else {
      groups.push([marker]);
      groupEnd = visibleEnd;
    }
  }

  return groups;
}

interface BlockProps {
  marker: CalendarMarker;
  top: number;
  height: number;
  // When markers overlap, they share the space side by side
  column?: number;
  columns?: number;
  onOpen: () => void;
}

// A marker in the week/day view: a small tag on the right side of the column.
export function PlannerMarkerBlock({
  marker,
  top,
  height,
  column = 0,
  columns = 1,
  onOpen,
}: BlockProps) {
  const info = TYPE_INFO[marker.type];
  const slice = ZONE_WIDTH_PERCENT / columns;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${info.label}: ${marker.title} (${marker.timeLabel})`}
      className={cn(
        "absolute z-20 overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        info.classes,
        marker.isDone && "opacity-60"
      )}
      style={{
        top,
        height,
        left: `calc(${ZONE_LEFT_PERCENT + slice * column}% + 1px)`,
        width: `calc(${slice}% - 2px)`,
      }}
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
      {height >= 52 && columns === 1 && (
        <p className="truncate text-[9px] opacity-80">{marker.timeLabel}</p>
      )}
    </button>
  );
}

interface GroupProps {
  markers: CalendarMarker[];
  top: number;
  height: number;
  onOpenItem: (marker: CalendarMarker) => void;
}

// Three or more markers at the same time: one block that opens a short list.
export function PlannerMarkerGroup({
  markers,
  top,
  height,
  onOpenItem,
}: GroupProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${markers.length} items at this time`}
          className="absolute z-20 overflow-hidden rounded-md border border-border bg-secondary px-1.5 py-1 text-left text-secondary-foreground shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          style={{
            top,
            height,
            left: `calc(${ZONE_LEFT_PERCENT}% + 1px)`,
            width: `calc(${ZONE_WIDTH_PERCENT}% - 2px)`,
          }}
        >
          <p className="truncate text-[8px] font-bold uppercase tracking-wide">
            {markers.length} items
          </p>
          {height >= 34 && (
            <p className="truncate text-[10px] font-semibold">Tap to see</p>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-2">
        <ul className="space-y-1">
          {markers.map((marker) => {
            const info = TYPE_INFO[marker.type];
            return (
              <li key={`${marker.type}-${marker.id}`}>
                <button
                  type="button"
                  onClick={() => onOpenItem(marker)}
                  className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left transition hover:bg-muted"
                >
                  <span
                    className={cn(
                      "w-fit rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                      info.classes
                    )}
                  >
                    {info.label}
                    {marker.courseCode ? ` · ${marker.courseCode}` : ""}
                  </span>
                  <span
                    className={cn(
                      "mt-1 truncate text-sm font-semibold",
                      marker.isDone && "line-through opacity-60"
                    )}
                  >
                    {marker.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {marker.timeLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
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