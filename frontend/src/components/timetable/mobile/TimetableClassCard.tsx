import { ChevronRight, Clock, MapPin, UserRound } from "lucide-react";

import type { ClassItem } from "@/hooks/useTimetableWeek";
import { formatTimeLabel } from "@/lib/dateTime";
import { hexToRgba } from "@/lib/plannerColors";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "warn" | "bad";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-success/15 text-success",
  warn: "bg-warning/15 text-warning",
  bad: "bg-destructive/15 text-destructive",
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// The chip on a class: Now, Missed, Cancelled or Completed
export function classStatus(
  item: ClassItem,
  todayKey: string,
  now: Date
): { label: string; tone: Tone } | null {
  if (item.mark?.status === "missed") return { label: "Missed", tone: "bad" };
  if (item.mark?.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  if (item.mark?.status === "completed") return { label: "Completed", tone: "good" };

  if (item.dateKey === todayKey) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= item.startMin && nowMin < item.endMin) {
      return { label: "Now", tone: "warn" };
    }
  }
  return null;
}

interface TimetableClassCardProps {
  item: ClassItem;
  todayKey: string;
  now: Date;
  onOpen: () => void;
}

export default function TimetableClassCard({
  item,
  todayKey,
  now,
  onOpen,
}: TimetableClassCardProps) {
  const { entry, color, mark } = item;
  const status = classStatus(item, todayKey, now);
  const tint = hexToRgba(color, 0.16) ?? "var(--muted)";
  const cancelled = mark?.status === "cancelled";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-2 rounded-2xl p-3 text-left",
        cancelled && "opacity-70",
        status?.tone === "bad" && "outline outline-2 -outline-offset-2 outline-destructive/40"
      )}
      style={{ backgroundColor: tint, borderLeft: `4px solid ${color}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-md bg-card/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
            style={{ color }}
          >
            {entry.course_code}
          </span>
          <span className="rounded-md bg-card/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
            {capital(entry.class_type)}
          </span>
          {status && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                TONES[status.tone]
              )}
            >
              {status.label}
            </span>
          )}
        </div>

        <p
          className={cn(
            "mt-1.5 text-sm leading-snug font-semibold",
            cancelled && "line-through"
          )}
        >
          {entry.course_name}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden="true" />
            {formatTimeLabel(entry.start_time)} – {formatTimeLabel(entry.end_time)}
          </span>
          {entry.venue && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{entry.venue}</span>
            </span>
          )}
          {entry.lecturer && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <UserRound className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{entry.lecturer}</span>
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}