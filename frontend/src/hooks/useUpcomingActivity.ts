import { useQuery } from "@tanstack/react-query";

import { getAssignments } from "@/api/assignments";
import { getCourses } from "@/api/courses";
import { getUpcomingEvents } from "@/api/events";
import { getExams } from "@/api/exams";
import { getLectureOccurrences } from "@/api/lectureOccurrences";
import { getStudySessions } from "@/api/studySessions";
import { getTasks } from "@/api/tasks";
import { getTimetable } from "@/api/timetable";
import { useNow } from "@/hooks/useNow";
import { formatTimeLabel, toDateString } from "@/lib/dateTime";
import { getItemPath } from "@/lib/itemLinks";
import type { ItemType } from "@/lib/itemLinks";

// Today plus the next 6 days
const DAYS_AHEAD = 7;

export interface ActivityItem {
  key: string;
  type: ItemType;
  title: string;
  detail: string;
  start: Date;
  end: Date; // when it finishes (for a deadline: the deadline itself)
  timeLabel: string;
  to: string;
  color: string | null;
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// ("2026-10-09", "14:30:00") -> a Date
const atTime = (dateKey: string, time: string) =>
  new Date(`${dateKey}T${time.slice(0, 8)}`);

// Everything coming up in the next 7 days, soonest first. This follows the
// same rules as the desktop "Upcoming activity" widget.
export function useUpcomingActivity() {
  const now = useNow();
  const todayStart = startOfDay(now);
  const windowEnd = addDays(todayStart, DAYS_AHEAD); // not included
  const fromKey = toDateString(todayStart);
  const toKey = toDateString(addDays(todayStart, DAYS_AHEAD - 1));

  const timetable = useQuery({ queryKey: ["timetable"], queryFn: getTimetable });
  const marks = useQuery({
    queryKey: ["lecture-occurrences", "all"],
    queryFn: () => getLectureOccurrences(),
  });
  const sessions = useQuery({
    queryKey: ["study-sessions", "range", fromKey, toKey],
    queryFn: () => getStudySessions({ date_from: fromKey, date_to: toKey }),
  });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: getTasks });
  const assignments = useQuery({ queryKey: ["assignments"], queryFn: getAssignments });
  const exams = useQuery({ queryKey: ["exams"], queryFn: getExams });
  const events = useQuery({
    queryKey: ["events", "upcoming", DAYS_AHEAD],
    queryFn: () => getUpcomingEvents(DAYS_AHEAD),
  });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });

  const isLoading = [timetable, marks, sessions, tasks, assignments, exams, events].some(
    (query) => query.isLoading
  );
  const isError = [timetable, sessions, tasks, assignments, exams, events].some(
    (query) => query.isError
  );

  const courseFor = (courseId: string | number) =>
    (courses.data ?? []).find((c) => String(c.id) === String(courseId));

  const items: ActivityItem[] = [];

  // ---- Classes: every date in the window, minus cancelled / already marked
  const markedKeys = new Set(
    (marks.data ?? []).map((m) => `${m.timetable_entry_id}|${m.occurrence_date}`)
  );
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = addDays(todayStart, offset);
    const dateKey = toDateString(day);
    const weekday = (day.getDay() + 6) % 7;

    for (const entry of timetable.data ?? []) {
      if (entry.day_of_week !== weekday) continue;
      if (markedKeys.has(`${entry.id}|${dateKey}`)) continue;
      if (atTime(dateKey, entry.end_time) <= now) continue;

      items.push({
        key: `lecture-${entry.id}-${dateKey}`,
        type: "lecture",
        title: entry.course_name,
        detail: [entry.course_code, entry.venue, entry.class_type]
          .filter(Boolean)
          .join(" · "),
        start: atTime(dateKey, entry.start_time),
        end: atTime(dateKey, entry.end_time),
        timeLabel: formatTimeLabel(entry.start_time),
        to: getItemPath("lecture", entry.id, dateKey),
        color: entry.course_color,
      });
    }
  }

  // ---- Study sessions still to do
  for (const s of sessions.data ?? []) {
    if (s.status !== "planned" && s.status !== "in_progress") continue;
    if (atTime(s.session_date, s.end_time) <= now) continue;
    const course = courseFor(s.course_id);

    items.push({
      key: `session-${s.id}`,
      type: "study_session",
      title: course ? course.name : "Study session",
      detail: [course?.code, s.venue, s.topic].filter(Boolean).join(" · "),
      start: atTime(s.session_date, s.start_time),
      end: atTime(s.session_date, s.end_time),
      timeLabel: formatTimeLabel(s.start_time),
      to: getItemPath("study_session", s.id, s.session_date),
      color: course?.color ?? null,
    });
  }

  // ---- Tasks and assignments with a deadline in the window
  const addDeadline = (
    type: "task" | "assignment",
    id: string,
    title: string,
    deadline: string | null,
    courseCode: string | null,
    color: string | null
  ) => {
    if (!deadline) return;
    const due = new Date(deadline);
    if (due < now || due >= windowEnd) return;
    items.push({
      key: `${type}-${id}`,
      type,
      title,
      detail: courseCode ?? "",
      start: due,
      end: due,
      timeLabel: `Due ${due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      to: getItemPath(type, id),
      color,
    });
  };

  for (const t of tasks.data ?? []) {
    if (t.status !== "completed") {
      addDeadline("task", t.id, t.title, t.deadline, t.course_code, t.course_color);
    }
  }
  for (const a of assignments.data ?? []) {
    if (a.status !== "completed") {
      addDeadline("assignment", a.id, a.title, a.deadline, a.course_code, a.course_color);
    }
  }

  // ---- Exams
  for (const e of exams.data ?? []) {
    const start = atTime(e.exam_date, e.start_time ?? "00:00:00");
    const end = e.end_time ? atTime(e.exam_date, e.end_time) : atTime(e.exam_date, "23:59:59");
    if (end < now || start >= windowEnd) continue;
    const course = courseFor(e.course_id);

    items.push({
      key: `exam-${e.id}`,
      type: "exam",
      title: e.title,
      detail: [course?.code, e.venue].filter(Boolean).join(" · "),
      start,
      end,
      timeLabel: e.start_time ? formatTimeLabel(e.start_time) : "All day",
      to: getItemPath("exam", e.id),
      color: course?.color ?? null,
    });
  }

  // ---- Events
  for (const ev of events.data ?? []) {
    if (ev.event_date < fromKey || ev.event_date > toKey) continue;
    const start = atTime(ev.event_date, ev.start_time ?? "00:00:00");
    const end = ev.end_time
      ? atTime(ev.event_date, ev.end_time)
      : atTime(ev.event_date, "23:59:59");
    if (end < now) continue;

    items.push({
      key: `event-${ev.id}`,
      type: "event",
      title: ev.title,
      detail: ev.location ?? "",
      start,
      end,
      timeLabel: ev.start_time ? formatTimeLabel(ev.start_time) : "All day",
      to: getItemPath("event", ev.id),
      color: null,
    });
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());

  return { items, isLoading, isError };
}