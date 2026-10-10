import { useState } from "react";
import { toast } from "sonner";

import { deleteLectureMark, markLecture } from "@/api/lectureOccurrences";
import type { LectureOccurrence, LectureStatus } from "@/api/lectureOccurrences";
import type { TimetableEntry } from "@/api/timetable";
import { cn } from "@/lib/utils";

interface LectureDateMarkerProps {
  entry: TimetableEntry;
  dateKey: string; // "YYYY-MM-DD", the date of the block that was clicked
  mark: LectureOccurrence | undefined; // existing mark for this date, if any
  onChanged: () => void; // tells the page to reload
}

const MARK_STYLES: Record<LectureStatus, string> = {
  missed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-success/10 text-success",
};

const MARK_MESSAGES: Record<LectureStatus, string> = {
  missed: "You missed this lecture on ",
  cancelled: "This lecture was cancelled on ",
  completed: "You completed this lecture on ",
};

function formatDay(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Has the lecture on this date already started?
function hasStarted(dateKey: string, startTime: string): boolean {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startsAt = new Date(`${dateKey}T00:00:00`);
  startsAt.setHours(hours, minutes, 0, 0);
  return new Date() >= startsAt;
}

// Lets the student mark THIS date's lecture as completed, missed or cancelled
// (or undo it) right from the planner pop-up.
export default function LectureDateMarker({
  entry,
  dateKey,
  mark,
  onChanged,
}: LectureDateMarkerProps) {
  const [isBusy, setIsBusy] = useState(false);

  const getErrorText = (error: unknown): string => {
    const detail = (
      error as { response?: { data?: { detail?: unknown } } }
    ).response?.data?.detail;
    return typeof detail === "string" ? detail : "Please try again.";
  };

  const handleMark = async (status: LectureStatus) => {
    setIsBusy(true);
    try {
      await markLecture({
        timetable_entry_id: String(entry.id),
        occurrence_date: dateKey,
        status,
      });
      onChanged();
      toast.success(`Marked as ${status}`, {
        description: `${entry.course_code} · ${formatDay(dateKey)}`,
      });
    } catch (error) {
      toast.error("Couldn't save that", { description: getErrorText(error) });
    } finally {
      setIsBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!mark) return;
    setIsBusy(true);
    try {
      await deleteLectureMark(mark.id);
      onChanged();
      toast.success("Mark removed", {
        description: `${entry.course_code} · ${formatDay(dateKey)}`,
      });
    } catch (error) {
      toast.error("Couldn't remove the mark", {
        description: getErrorText(error),
      });
    } finally {
      setIsBusy(false);
    }
  };

  // Already marked: show what happened, with an Undo button
  if (mark) {
    return (
      <div
        className={cn(
          "mx-3 mt-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium",
          MARK_STYLES[mark.status]
        )}
      >
        <span>
          {MARK_MESSAGES[mark.status]}
          {formatDay(dateKey)}
        </span>
        <button
          type="button"
          disabled={isBusy}
          onClick={handleUndo}
          className="shrink-0 text-[11px] font-semibold underline-offset-2 hover:underline disabled:opacity-50"
        >
          Undo
        </button>
      </div>
    );
  }

  const started = hasStarted(dateKey, entry.start_time);

  // Not marked yet: offer the choices for this date
  return (
    <div className="mx-3 mt-3 rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-[11px] font-semibold text-muted-foreground">
        {formatDay(dateKey)}: how did it go?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {started && (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleMark("completed")}
              className="rounded-lg border border-success/40 px-3 py-1 text-[11px] font-semibold text-success transition hover:bg-success/10 disabled:opacity-50"
            >
              Completed
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleMark("missed")}
              className="rounded-lg border border-destructive/30 px-3 py-1 text-[11px] font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
            >
              Missed
            </button>
          </>
        )}
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleMark("cancelled")}
          className="rounded-lg border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-background disabled:opacity-50"
        >
          Cancelled
        </button>
      </div>
    </div>
  );
}