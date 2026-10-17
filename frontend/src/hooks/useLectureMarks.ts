import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deleteLectureMark, markLecture } from "@/api/lectureOccurrences";
import type { LectureOccurrence, LectureStatus } from "@/api/lectureOccurrences";
import type { TimetableEntry } from "@/api/timetable";
import { formatDateLabel, parseDateString, parseTimeString } from "@/lib/dateTime";

// Has this class (on this date) already started?
export function classHasStarted(
  dateKey: string,
  startTime: string,
  now: Date = new Date()
): boolean {
  const date = parseDateString(dateKey);
  const time = parseTimeString(startTime);
  if (!date || !time) return false;
  date.setHours(time.hour, time.minute, 0, 0);
  return now >= date;
}

function errorText(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } }).response
    ?.data?.detail;
  return typeof detail === "string" ? detail : "Please try again.";
}

// Mark one date of a weekly class as completed / missed / cancelled, or remove
// the mark. Every change shows a toast with Undo.
export function useLectureMarks() {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["lecture-occurrences"] });

  async function mark(
    entry: TimetableEntry,
    dateKey: string,
    status: LectureStatus,
    withUndo = true
  ) {
    try {
      const created = await markLecture({
        timetable_entry_id: String(entry.id),
        occurrence_date: dateKey,
        status,
      });
      await refresh();
      toast.success(`Marked as ${status}`, {
        description: `${entry.course_code} · ${formatDateLabel(dateKey)}`,
        action: withUndo
          ? { label: "Undo", onClick: () => void unmark(created, entry, false) }
          : undefined,
      });
    } catch (error) {
      toast.error("Couldn't save that", { description: errorText(error) });
    }
  }

  async function unmark(existing: LectureOccurrence, entry: TimetableEntry, withUndo = true) {
    try {
      await deleteLectureMark(existing.id);
      await refresh();
      toast.success("Mark removed", {
        description: `${entry.course_code} · ${formatDateLabel(existing.occurrence_date)}`,
        action: withUndo
          ? {
              label: "Undo",
              onClick: () =>
                void mark(entry, existing.occurrence_date, existing.status, false),
            }
          : undefined,
      });
    } catch (error) {
      toast.error("Couldn't remove the mark", { description: errorText(error) });
    }
  }

  return { mark, unmark };
}