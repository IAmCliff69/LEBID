import { useQuery } from "@tanstack/react-query";

import { getAssignments } from "@/api/assignments";
import { getCourses } from "@/api/courses";
import { getExams } from "@/api/exams";
import { getTasks } from "@/api/tasks";
import { useNow } from "@/hooks/useNow";

export interface DeadlineItem {
  type: "assignment" | "task" | "exam";
  id: string;
  title: string;
  courseCode: string | null;
  color: string | null;
  due: Date;
  isOverdue: boolean;
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Assignments, tasks and exams in date order (the same rules as the desktop
// "Upcoming deadlines" widget). Overdue items come first.
export function useUpcomingDeadlines() {
  const now = useNow();

  const assignments = useQuery({ queryKey: ["assignments"], queryFn: getAssignments });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: getTasks });
  const exams = useQuery({ queryKey: ["exams"], queryFn: getExams });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });

  const isLoading = assignments.isLoading || tasks.isLoading || exams.isLoading;
  const isError = assignments.isError || tasks.isError || exams.isError;

  const items: DeadlineItem[] = [];

  for (const a of assignments.data ?? []) {
    if (a.status === "completed" || !a.deadline) continue;
    const due = new Date(a.deadline);
    items.push({
      type: "assignment",
      id: a.id,
      title: a.title,
      courseCode: a.course_code,
      color: a.course_color,
      due,
      isOverdue: due < now,
    });
  }

  for (const t of tasks.data ?? []) {
    if (t.status === "completed" || !t.deadline) continue;
    const due = new Date(t.deadline);
    items.push({
      type: "task",
      id: t.id,
      title: t.title,
      courseCode: t.course_code,
      color: t.course_color,
      due,
      isOverdue: due < now,
    });
  }

  for (const e of exams.data ?? []) {
    const due = new Date(`${e.exam_date}T${(e.start_time ?? "00:00:00").slice(0, 8)}`);
    // An exam that has already happened is not a deadline any more
    if (due < startOfDay(now)) continue;
    const course = (courses.data ?? []).find(
      (c) => String(c.id) === String(e.course_id)
    );
    items.push({
      type: "exam",
      id: e.id,
      title: e.title,
      courseCode: course?.code ?? null,
      color: course?.color ?? null,
      due,
      isOverdue: false,
    });
  }

  // Overdue first, then the soonest
  items.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return a.due.getTime() - b.due.getTime();
  });

  const upcoming = items.filter((item) => !item.isOverdue);
  // The soonest one that has not passed (or, if none, the most urgent overdue one)
  const closest = upcoming[0] ?? items[0];

  return { items, upcoming, closest, isLoading, isError };
}