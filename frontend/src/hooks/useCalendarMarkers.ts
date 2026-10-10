import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAssignments } from "@/api/assignments";
import { getCourses } from "@/api/courses";
import type { PlannerEvent } from "@/api/events";
import { getExams } from "@/api/exams";
import { getTasks } from "@/api/tasks";
import { formatTimeLabel, parseTimeString, toDateString } from "@/lib/dateTime";
import { getItemPath } from "@/lib/itemLinks";

// Something that sits on the calendar without being a class or a study
// session: a task or assignment deadline, an exam, or an event with no times.
export interface CalendarMarker {
  id: string;
  type: "task" | "assignment" | "exam" | "event";
  title: string;
  courseCode: string | null;
  color: string | null;
  dateKey: string; // "YYYY-MM-DD"
  startMin: number; // minutes after midnight
  endMin: number;
  timeLabel: string;
  to: string; // the page that shows this item
  isDone: boolean;
}

const minutesOf = (time: string): number => {
  const parts = parseTimeString(time);
  return parts ? parts.hour * 60 + parts.minute : 0;
};

// The planner draws events that have BOTH a start and an end time as normal
// blocks. Any other event becomes a marker so it still shows up.
export function eventToMarker(event: PlannerEvent): CalendarMarker | null {
  if (event.start_time && event.end_time) return null;

  const startMin = event.start_time ? minutesOf(event.start_time) : 8 * 60;

  return {
    id: event.id,
    type: "event",
    title: event.title,
    courseCode: null,
    color: null,
    dateKey: event.event_date,
    startMin,
    endMin: startMin + 60,
    timeLabel: event.start_time ? formatTimeLabel(event.start_time) : "All day",
    to: getItemPath("event", event.id),
    isDone: false,
  };
}

// Loads tasks, assignments and exams and sorts them into calendar markers,
// ready to be looked up one day at a time.
export function useCalendarMarkers() {
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: getTasks });
  const assignments = useQuery({ queryKey: ["assignments"], queryFn: getAssignments });
  const exams = useQuery({ queryKey: ["exams"], queryFn: getExams });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });

  const markersByDay = useMemo(() => {
    const map = new Map<string, CalendarMarker[]>();
    const add = (marker: CalendarMarker) => {
      map.set(marker.dateKey, [...(map.get(marker.dateKey) ?? []), marker]);
    };

    // A deadline is drawn as the 30 minutes before the due time
    const addDeadline = (
      type: "task" | "assignment",
      id: string,
      title: string,
      deadline: string | null,
      courseCode: string | null,
      color: string | null,
      isDone: boolean
    ) => {
      if (!deadline) return;
      const due = new Date(deadline);
      if (Number.isNaN(due.getTime())) return;

      const endMin = Math.max(due.getHours() * 60 + due.getMinutes(), 30);
      add({
        id,
        type,
        title,
        courseCode,
        color,
        dateKey: toDateString(due),
        startMin: endMin - 30,
        endMin,
        timeLabel: `Due ${due.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}`,
        to: getItemPath(type, id),
        isDone,
      });
    };

    for (const t of tasks.data ?? []) {
      addDeadline("task", t.id, t.title, t.deadline, t.course_code, t.course_color, t.status === "completed");
    }
    for (const a of assignments.data ?? []) {
      addDeadline("assignment", a.id, a.title, a.deadline, a.course_code, a.course_color, a.status === "completed");
    }

    for (const e of exams.data ?? []) {
      const course = (courses.data ?? []).find(
        (c) => String(c.id) === String(e.course_id)
      );
      const startMin = e.start_time ? minutesOf(e.start_time) : 8 * 60;
      const endMin = e.end_time ? minutesOf(e.end_time) : startMin + 60;

      add({
        id: e.id,
        type: "exam",
        title: e.title,
        courseCode: course?.code ?? null,
        color: course?.color ?? null,
        dateKey: e.exam_date,
        startMin,
        endMin: Math.max(endMin, startMin + 30),
        timeLabel: e.start_time ? formatTimeLabel(e.start_time) : "Time not set",
        to: getItemPath("exam", e.id),
        isDone: false,
      });
    }

    return map;
  }, [tasks.data, assignments.data, exams.data, courses.data]);

  return {
    getMarkersForDay: (dateKey: string): CalendarMarker[] =>
      markersByDay.get(dateKey) ?? [],
  };
}