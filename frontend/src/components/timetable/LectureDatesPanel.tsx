import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  deleteLectureMark,
  getLectureOccurrences,
  markLecture,
} from "@/api/lectureOccurrences";
import type {
  LectureOccurrence,
  LectureStatus,
} from "@/api/lectureOccurrences";
import type { TimetableEntry } from "@/api/timetable";
import { toDateString } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// The dates this weekly class happens on: the latest 4 (up to today)
// and the next 2.
function getClassDates(dayOfWeek: number): { recent: Date[]; upcoming: Date[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // JavaScript counts Sunday as 0, our timetable counts Monday as 0
  const todayIndex = (today.getDay() + 6) % 7;
  const daysSince = (todayIndex - dayOfWeek + 7) % 7;
  const latest = addDays(today, -daysSince);

  const recent = [0, 1, 2, 3].map((week) => addDays(latest, -7 * week));
  const next = addDays(latest, 7);
  return { recent, upcoming: [next, addDays(next, 7)] };
}

// Has the lecture on this date already started?
function hasStarted(date: Date, startTime: string): boolean {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startsAt = new Date(date);
  startsAt.setHours(hours, minutes, 0, 0);
  return new Date() >= startsAt;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const MARK_LABELS: Record<LectureStatus, string> = {
  missed: "Missed",
  cancelled: "Cancelled",
  completed: "Completed",
};

interface DateRowProps {
  date: Date;
  isToday: boolean;
  canMiss: boolean;
  mark: LectureOccurrence | undefined;
  isBusy: boolean;
  onMark: (status: LectureStatus) => void;
  onUndo: (mark: LectureOccurrence) => void;
}

function DateRow({
  date,
  isToday,
  canMiss,
  mark,
  isBusy,
  onMark,
  onUndo,
}: DateRowProps) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
      <p className="flex items-center gap-2 text-xs font-semibold">
        {formatDay(date)}
        {isToday && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            Today
          </span>
        )}
      </p>

      {mark ? (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-semibold",
              mark.status === "missed"
                ? "bg-destructive/10 text-destructive"
                : mark.status === "completed"
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {MARK_LABELS[mark.status]}
          </span>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onUndo(mark)}
            className="text-[11px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
           {canMiss && (
            <>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onMark("completed")}
                className="rounded-lg border border-success/40 px-2.5 py-1 text-[11px] font-semibold text-success transition hover:bg-success/10 disabled:opacity-50"
              >
                Completed
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onMark("missed")}
                className="rounded-lg border border-destructive/30 px-2.5 py-1 text-[11px] font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
              >
                Missed
              </button>
            </>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onMark("cancelled")}
            className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            Cancelled
          </button>
        </div>
      )}
    </li>
  );
}

// "Mark a date": lets the student say that ONE week's lecture was missed or
// cancelled, without touching the other weeks.
export default function LectureDatesPanel({ entry }: { entry: TimetableEntry }) {
  const queryClient = useQueryClient();
  const entryId = String(entry.id);
  const [busyDate, setBusyDate] = useState<string | null>(null);

  const { data: marks = [] } = useQuery({
    queryKey: ["lecture-occurrences", entryId],
    queryFn: () => getLectureOccurrences({ timetable_entry_id: entryId }),
  });

  const markByDate = new Map(marks.map((m) => [m.occurrence_date, m]));
  const { recent, upcoming } = getClassDates(entry.day_of_week);
  const todayString = toDateString(new Date());

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["lecture-occurrences"] });

  const getErrorText = (error: unknown): string => {
    const detail = (
      error as { response?: { data?: { detail?: unknown } } }
    ).response?.data?.detail;
    return typeof detail === "string" ? detail : "Please try again.";
  };

  const handleMark = async (date: Date, status: LectureStatus) => {
    const dateString = toDateString(date);
    setBusyDate(dateString);
    try {
      await markLecture({
        timetable_entry_id: entryId,
        occurrence_date: dateString,
        status,
      });
      await refresh();
      toast.success(`Marked as ${status}`, {
        description: `${entry.course_code} · ${formatDay(date)}`,
      });
    } catch (error) {
      toast.error("Couldn't save that", { description: getErrorText(error) });
    } finally {
      setBusyDate(null);
    }
  };

  const handleUndo = async (mark: LectureOccurrence) => {
    setBusyDate(mark.occurrence_date);
    try {
      await deleteLectureMark(mark.id);
      await refresh();
      toast.success("Mark removed", {
        description: `${entry.course_code} · ${mark.occurrence_date}`,
      });
    } catch (error) {
      toast.error("Couldn't remove the mark", {
        description: getErrorText(error),
      });
    } finally {
      setBusyDate(null);
    }
  };

  const renderRow = (date: Date) => {
    const dateString = toDateString(date);
    return (
      <DateRow
        key={dateString}
        date={date}
        isToday={dateString === todayString}
        canMiss={hasStarted(date, entry.start_time)}
        mark={markByDate.get(dateString)}
        isBusy={busyDate === dateString}
        onMark={(status) => handleMark(date, status)}
        onUndo={handleUndo}
      />
    );
  };

  return (
    <div className="mt-5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Mark a date
      </h4>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Missed a lecture, or did the lecturer cancel it? Mark just that date.
        Other weeks stay as they are.
      </p>

      <ul className="mt-3 space-y-1.5">{recent.map(renderRow)}</ul>

      <p className="mb-1.5 mt-3 text-[11px] font-semibold text-muted-foreground">
        Coming up
      </p>
      <ul className="space-y-1.5">{upcoming.map(renderRow)}</ul>
    </div>
  );
}