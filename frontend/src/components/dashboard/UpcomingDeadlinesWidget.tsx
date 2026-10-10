import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Clock3 } from "lucide-react";

import { getAssignments } from "@/api/assignments";
import { getCourses } from "@/api/courses";
import { getExams } from "@/api/exams";
import { getTasks } from "@/api/tasks";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { useNow } from "@/hooks/useNow";
import { getItemPath } from "@/lib/itemLinks";
import { cn } from "@/lib/utils";

type DeadlineType = "assignment" | "task" | "exam";

interface DeadlineItem {
  type: DeadlineType;
  id: string;
  title: string;
  courseCode: string | null;
  color: string | null;
  due: Date;
  isOverdue: boolean;
}

const TYPE_LABELS: Record<DeadlineType, string> = {
  assignment: "Assignment",
  task: "Task",
  exam: "Exam",
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

// "Today, 5:00 PM", "Tomorrow, 9:00 AM", "Fri, Oct 9, 11:59 PM"
function formatDue(due: Date, now: Date): string {
  const time = due.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dayDiff = Math.round(
    (startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000
  );

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  const day = due.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day}, ${time}`;
}

// Assignments, tasks and exams in date order. Overdue items come first.
export default function UpcomingDeadlinesWidget({ className }: { className?: string }) {
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

  // "Closest deadline": the soonest one that has not passed (or, if there are
  // none, the most urgent overdue one)
  const closest = items.find((item) => !item.isOverdue) ?? items[0];

  const overdueCount = items.filter((item) => item.isOverdue).length;
  let subtitle = "Loading...";
  if (!isLoading) {
    subtitle =
      items.length === 0
        ? "Nothing coming up"
        : overdueCount > 0
          ? `${items.length} total, ${overdueCount} overdue`
          : `${items.length} coming up`;
  }

  return (
    <DashboardCard
      title="Upcoming deadlines"
      subtitle={subtitle}
      icon={Clock3}
      action={
        closest
          ? {
              label: "Closest deadline",
              to: getItemPath(closest.type, closest.id),
            }
          : undefined
      }
      className={className}
    >
      {isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load your deadlines.{" "}
          <button
            type="button"
            onClick={() => {
              assignments.refetch();
              tasks.refetch();
              exams.refetch();
            }}
            className="font-semibold underline"
          >
            Retry
          </button>
        </p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No deadlines coming up. You&apos;re all caught up!
        </p>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const hoursLeft = (item.due.getTime() - now.getTime()) / 3_600_000;
          const isSoon = !item.isOverdue && hoursLeft <= 24;
          const color = item.color || "var(--primary)";

          return (
            <li key={`${item.type}-${item.id}`}>
              <Link
                to={getItemPath(item.type, item.id)}
                className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-border px-3 py-2.5 pl-4 transition hover:border-primary/40 hover:bg-primary/5"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABELS[item.type]}
                    {item.courseCode && (
                      <span style={{ color }}>{item.courseCode}</span>
                    )}
                  </p>
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs",
                      item.isOverdue
                        ? "font-semibold text-destructive"
                        : isSoon
                          ? "font-semibold text-warning"
                          : "text-muted-foreground"
                    )}
                  >
                    {item.isOverdue ? "Overdue · " : ""}
                    {formatDue(item.due, now)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}