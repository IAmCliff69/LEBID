import { useQuery } from "@tanstack/react-query";

import { getLectureOccurrences } from "@/api/lectureOccurrences";
import type { LectureOccurrence } from "@/api/lectureOccurrences";
import { getTimetable } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";
import { parseTimeString } from "@/lib/dateTime";
import { accentFor } from "@/lib/plannerColors";
import { weekKeys } from "@/lib/plannerDates";

// One class on one weekday of THIS week (so it has a real date to be marked on)
export interface ClassItem {
  key: string;
  entry: TimetableEntry;
  dateKey: string;
  mark?: LectureOccurrence;
  startMin: number;
  endMin: number;
  color: string;
}

export interface WeekDay {
  index: number; // 0 = Monday ... 6 = Sunday
  dateKey: string;
  items: ClassItem[];
}

const minutesOf = (time: string): number => {
  const parts = parseTimeString(time);
  return parts ? parts.hour * 60 + parts.minute : 0;
};

// The weekly timetable as 7 days (Monday first), each class matched with the
// Missed / Cancelled / Completed mark for its date this week.
export function useTimetableWeek(todayKey: string) {
  const timetable = useQuery({ queryKey: ["timetable"], queryFn: getTimetable });
  const marks = useQuery({
    queryKey: ["lecture-occurrences", "all"],
    queryFn: () => getLectureOccurrences(),
  });

  const entries = timetable.data ?? [];

  const days: WeekDay[] = weekKeys(todayKey).map((dateKey, index) => {
    const items = entries
      .filter((entry) => entry.day_of_week === index)
      .map<ClassItem>((entry) => ({
        key: `${entry.id}-${dateKey}`,
        entry,
        dateKey,
        mark: (marks.data ?? []).find(
          (m) =>
            m.timetable_entry_id === String(entry.id) && m.occurrence_date === dateKey
        ),
        startMin: minutesOf(entry.start_time),
        endMin: minutesOf(entry.end_time),
        color: accentFor("lecture", entry.course_color),
      }))
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    return { index, dateKey, items };
  });

  return {
    days,
    entries,
    isLoading: timetable.isLoading || marks.isLoading,
    isError: timetable.isError,
  };
}