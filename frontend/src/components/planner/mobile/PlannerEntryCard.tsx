import { Check, ChevronRight, Clock, MapPin } from "lucide-react";

import { hexToRgba } from "@/lib/plannerColors";
import { sessionHasEnded, sessionHasStarted } from "@/hooks/useStudySessionActions";
import type { PlannerEntry } from "@/hooks/usePlannerDay";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "warn" | "bad";

// The status chip on a card: Now, Missed, Completed, Skipped, Cancelled...
export function statusOf(entry: PlannerEntry, now: Date): { label: string; tone: Tone } | null {
  const s = entry.session;
  if (s) {
    if (s.status === "completed") return { label: "Completed", tone: "good" };
    if (s.status === "skipped") return { label: "Skipped", tone: "neutral" };
    if (sessionHasEnded(s, now)) return { label: "Missed", tone: "bad" };
    if (sessionHasStarted(s, now)) return { label: "Now", tone: "warn" };
    return null;
  }
  const mark = entry.lecture?.mark;
  if (mark?.status === "missed") return { label: "Missed", tone: "bad" };
  if (mark?.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  return null;
}

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-success/15 text-success",
  warn: "bg-warning/15 text-warning",
  bad: "bg-destructive/15 text-destructive",
};

interface PlannerEntryCardProps {
  entry: PlannerEntry;
  now: Date;
  highlighted: boolean;
  onOpen: () => void;
}

export default function PlannerEntryCard({
  entry,
  now,
  highlighted,
  onOpen,
}: PlannerEntryCardProps) {
  const status = statusOf(entry, now);
  const tint = hexToRgba(entry.color, 0.16) ?? "var(--muted)";
  const dimmed =
    entry.session?.status === "skipped" ||
    entry.lecture?.mark?.status === "cancelled" ||
    entry.session?.status === "completed";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-2 rounded-2xl p-3 text-left transition-shadow",
        dimmed && "opacity-70",
        highlighted && "ring-2 ring-primary",
        status?.tone === "bad" && "outline outline-2 -outline-offset-2 outline-destructive/40"
      )}
      style={{ backgroundColor: tint, borderLeft: `4px solid ${entry.color}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.chips.map((chip, index) => (
            <span
              key={`${chip}-${index}`}
              className="rounded-md bg-card/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
              style={index === 0 ? { color: entry.color } : undefined}
            >
              {chip}
            </span>
          ))}
          {status && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                TONES[status.tone]
              )}
            >
              {status.label === "Completed" && <Check className="size-3" aria-hidden="true" />}
              {status.label}
            </span>
          )}
        </div>

        <p
          className={cn(
            "mt-1.5 text-sm leading-snug font-semibold",
            entry.session?.status === "skipped" && "line-through"
          )}
        >
          {entry.title}
        </p>
        {entry.subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.subtitle}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden="true" />
            {entry.allDay
              ? "All day"
              : entry.endLabel
                ? `${entry.startLabel} – ${entry.endLabel}`
                : entry.startLabel}
          </span>
          {entry.place && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{entry.place}</span>
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}