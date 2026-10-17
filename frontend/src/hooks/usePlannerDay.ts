import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getCourses } from "@/api/courses";
import { getEvents } from "@/api/events";
import type { PlannerEvent } from "@/api/events";
import { getLectureOccurrences } from "@/api/lectureOccurrences";
import type { LectureOccurrence } from "@/api/lectureOccurrences";
import { getStudySessions } from "@/api/studySessions";
import type { StudySession } from "@/api/studySessions";
import { getTimetable } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";
import { useCalendarMarkers } from "@/hooks/useCalendarMarkers";
import type { CalendarMarker } from "@/hooks/useCalendarMarkers";
import { formatTimeLabel, parseDateString, parseTimeString } from "@/lib/dateTime";
import { accentFor, KIND_CHIPS } from "@/lib/plannerColors";
import type { PlannerKind } from "@/lib/plannerColors";

export type Visibility = Record<PlannerKind, boolean>;

// One thing on the planner's list: a class, a study session, an event, an
// exam, an assignment or a task.
export interface PlannerEntry {
  key: string;
  dateKey: string; // the day this entry belongs to ("YYYY-MM-DD")
  rawId: string; // the id of the lecture entry / session / event / marker
  kind: PlannerKind;
  title: string;
  subtitle: string;
  place: string;
  chips: string[];
  startMin: number;
  endMin: number;
  allDay: boolean;
  startLabel: string;
  endLabel: string;
  color: string;
  session?: StudySession;
  lecture?: { entry: TimetableEntry; mark?: LectureOccurrence };
  marker?: CalendarMarker;
  event?: PlannerEvent;
}

const minutesOf = (time: string | null | undefined): number => {
  const parts = parseTimeString(time);
  return parts ? parts.hour * 60 + parts.minute : 0;
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Everything on the planner for a RANGE of days (one day, a week or a month
// grid), sorted, with the "Other Calendars" toggles applied.
// `dateKeys` must be in order: the first and last decide which study sessions
// are loaded.
export function usePlannerRange(dateKeys: string[], visible: Visibility) {
  const from = dateKeys[0];
  const to = dateKeys[dateKeys.length - 1];

  const timetable = useQuery({ queryKey: ["timetable"], queryFn: getTimetable });
  const marks = useQuery({
    queryKey: ["lecture-occurrences", "all"],
    queryFn: () => getLectureOccurrences(),
  });
  const sessions = useQuery({
    queryKey: ["study-sessions", "range", from, to],
    queryFn: () => getStudySessions({ date_from: from, date_to: to }),
    // keep showing the old list while the new range loads (no flicker)
    placeholderData: keepPreviousData,
  });
  const events = useQuery({ queryKey: ["events", "all"], queryFn: () => getEvents() });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });
  const { getMarkersForDay } = useCalendarMarkers();

  const isLoading = [timetable, marks, sessions, events, courses].some((q) => q.isLoading);
  const isError = [timetable, sessions, events].some((q) => q.isError);

  const courseList = courses.data ?? [];
  const courseFor = (courseId: string | number) =>
    courseList.find((c) => String(c.id) === String(courseId));

  const buildDay = (dateKey: string): PlannerEntry[] => {
    const entries: PlannerEntry[] = [];

    // ---- Classes
    const day = parseDateString(dateKey);
    const weekday = day ? (day.getDay() + 6) % 7 : -1;
    if (visible.lecture) {
      for (const entry of timetable.data ?? []) {
        if (entry.day_of_week !== weekday) continue;
        const mark = (marks.data ?? []).find(
          (m) =>
            m.timetable_entry_id === String(entry.id) &&
            m.occurrence_date === dateKey
        );
        entries.push({
          key: `lecture-${entry.id}`,
          dateKey,
          rawId: String(entry.id),
          kind: "lecture",
          title: entry.course_name,
          subtitle: "",
          place: entry.venue ?? "",
          chips: [entry.course_code ?? KIND_CHIPS.lecture, capital(entry.class_type)],
          startMin: minutesOf(entry.start_time),
          endMin: minutesOf(entry.end_time),
          allDay: false,
          startLabel: formatTimeLabel(entry.start_time),
          endLabel: formatTimeLabel(entry.end_time),
          color: accentFor("lecture", entry.course_color),
          lecture: { entry, mark },
        });
      }
    }

    // ---- Study sessions (a rescheduled one is replaced by its new session)
    if (visible.study_session) {
      for (const s of sessions.data ?? []) {
        if (s.session_date !== dateKey) continue;
        if (s.status === "rescheduled") continue;
        const course = courseFor(s.course_id);
        entries.push({
          key: `session-${s.id}`,
          dateKey,
          rawId: s.id,
          kind: "study_session",
          title: course ? course.name : "Study session",
          subtitle: s.topic ?? "",
          place: s.venue,
          chips: [KIND_CHIPS.study_session, capital(s.priority)],
          startMin: minutesOf(s.start_time),
          endMin: minutesOf(s.end_time),
          allDay: false,
          startLabel: formatTimeLabel(s.start_time),
          endLabel: formatTimeLabel(s.end_time),
          color: accentFor("study_session", course?.color ?? null),
          session: s,
        });
      }
    }

    // ---- Personal events (an event without times is an "all day" entry)
    if (visible.event) {
      for (const ev of events.data ?? []) {
        if (ev.event_date !== dateKey) continue;
        const allDay = !ev.start_time;
        entries.push({
          key: `event-${ev.id}`,
          dateKey,
          rawId: ev.id,
          kind: "event",
          title: ev.title,
          subtitle: ev.description ?? "",
          place: ev.location ?? "",
          chips: [KIND_CHIPS.event, capital(ev.flexibility)],
          startMin: minutesOf(ev.start_time),
          endMin: ev.end_time ? minutesOf(ev.end_time) : minutesOf(ev.start_time) + 30,
          allDay,
          startLabel: allDay ? "All day" : formatTimeLabel(ev.start_time),
          endLabel: ev.end_time ? formatTimeLabel(ev.end_time) : "",
          color: accentFor("event", null),
          event: ev,
        });
      }
    }

    // ---- Exams, assignments and tasks (the same markers the desktop planner draws)
    for (const marker of getMarkersForDay(dateKey)) {
      if (marker.type === "event") continue;
      if (!visible[marker.type]) continue;
      const allDay = marker.timeLabel === "Time not set";
      entries.push({
        key: `${marker.type}-${marker.id}`,
        dateKey,
        rawId: marker.id,
        kind: marker.type,
        title: marker.title,
        subtitle: "",
        place: "",
        chips: [KIND_CHIPS[marker.type], marker.courseCode ?? ""].filter(Boolean),
        startMin: marker.startMin,
        endMin: marker.endMin,
        allDay,
        startLabel: allDay ? "All day" : marker.timeLabel,
        endLabel: "",
        color: accentFor(marker.type, marker.color),
        marker,
      });
    }

    entries.sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startMin - b.startMin || a.endMin - b.endMin;
    });

    return entries;
  };

  const entriesByDay = new Map<string, PlannerEntry[]>();
  for (const dateKey of dateKeys) {
    entriesByDay.set(dateKey, buildDay(dateKey));
  }

  return { entriesByDay, courses: courseList, isLoading, isError };
}

// One day (the same hook the Day view used before).
export function usePlannerDay(dateKey: string, visible: Visibility) {
  const { entriesByDay, courses, isLoading, isError } = usePlannerRange(
    [dateKey],
    visible
  );
  return { entries: entriesByDay.get(dateKey) ?? [], courses, isLoading, isError };
}