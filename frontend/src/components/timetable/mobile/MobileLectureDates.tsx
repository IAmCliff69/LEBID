import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getLectureOccurrences } from "@/api/lectureOccurrences";
import type { LectureOccurrence, LectureStatus } from "@/api/lectureOccurrences";
import type { TimetableEntry } from "@/api/timetable";
import { classHasStarted, useLectureMarks } from "@/hooks/useLectureMarks";
import { parseDateString } from "@/lib/dateTime";
import { addDays } from "@/lib/plannerDates";
import { weekdayIndex } from "@/lib/timetableWeek";
import { cn } from "@/lib/utils";

const MARK_LABELS: Record<LectureStatus, string> = {
  missed: "Missed",
  cancelled: "Cancelled",
  completed: "Completed",
};

const MARK_STYLES: Record<LectureStatus, string> = {
  missed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-success/10 text-success",
};

const dayLabel = (dateKey: string) =>
  (parseDateString(dateKey) ?? new Date()).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const choice =
  "h-9 rounded-full border px-3 text-xs font-semibold disabled:opacity-50";

interface MobileLectureDatesProps {
  entry: TimetableEntry;
  todayKey: string;
  now: Date;
}

// "Lecture dates": mark ONE week's class as completed, missed or cancelled
// (or remove the mark). The last 4 dates and the next 2.
export default function MobileLectureDates({
  entry,
  todayKey,
  now,
}: MobileLectureDatesProps) {
  const { mark, unmark } = useLectureMarks();
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const entryId = String(entry.id);

  const { data: marks = [] } = useQuery({
    queryKey: ["lecture-occurrences", entryId],
    queryFn: () => getLectureOccurrences({ timetable_entry_id: entryId }),
  });
  const markByDate = new Map(marks.map((m) => [m.occurrence_date, m]));

  // The latest date of this weekly class (today or earlier), then 3 before it
  // and the 2 after it
  const today = parseDateString(todayKey) ?? new Date();
  const sinceLatest = (weekdayIndex(today) - entry.day_of_week + 7) % 7;
  const latest = addDays(todayKey, -sinceLatest);
  const recent = [0, 1, 2, 3].map((week) => addDays(latest, -7 * week));
  const upcoming = [addDays(latest, 7), addDays(latest, 14)];

  const run = async (dateKey: string, action: () => Promise<void>) => {
    setBusyDate(dateKey);
    await action();
    setBusyDate(null);
  };

  const renderRow = (dateKey: string) => {
    const existing: LectureOccurrence | undefined = markByDate.get(dateKey);
    const busy = busyDate === dateKey;
    const started = classHasStarted(dateKey, entry.start_time, now);

    return (
      <li key={dateKey} className="rounded-2xl bg-muted/50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {dayLabel(dateKey)}
            {dateKey === todayKey && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Today
              </span>
            )}
          </p>
          {existing && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                MARK_STYLES[existing.status]
              )}
            >
              {MARK_LABELS[existing.status]}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {existing ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(dateKey, () => unmark(existing, entry))}
              className={cn(choice, "border-border text-muted-foreground")}
            >
              Undo
            </button>
          ) : (
            <>
              {started && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(dateKey, () => mark(entry, dateKey, "completed"))
                    }
                    className={cn(choice, "border-success/40 text-success")}
                  >
                    Completed
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(dateKey, () => mark(entry, dateKey, "missed"))}
                    className={cn(choice, "border-destructive/30 text-destructive")}
                  >
                    Missed
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(dateKey, () => mark(entry, dateKey, "cancelled"))}
                className={cn(choice, "border-border text-muted-foreground")}
              >
                Cancelled
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div>
      <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
        Lecture dates
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Missed a lecture, or did the lecturer cancel it? Mark just that date. Other
        weeks stay as they are.
      </p>
      <ul className="mt-3 space-y-2">{recent.map(renderRow)}</ul>
      <p className="mt-3 mb-2 text-xs font-semibold text-muted-foreground">Coming up</p>
      <ul className="space-y-2">{upcoming.map(renderRow)}</ul>
    </div>
  );
}