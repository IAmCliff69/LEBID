import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronRight,
  GraduationCap,
  Library,
  Upload,
} from "lucide-react";

import { getAssignments } from "@/api/assignments";
import { getCourses } from "@/api/courses";
import { getEvents } from "@/api/events";
import { getExams } from "@/api/exams";
import { useNow } from "@/hooks/useNow";
import { parseDateString, toDateString, toTimeString } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

type Tone = "normal" | "warn" | "bad";
interface Status {
  text: string;
  tone: Tone;
}

const tiles = [
  { label: "Assignments", to: "/assignments", icon: BookOpen, hint: "Deadlines and submissions" },
  { label: "Exams", to: "/exams", icon: GraduationCap, hint: "Dates, venues and countdowns" },
  { label: "Events", to: "/events", icon: Calendar, hint: "Your personal commitments" },
  { label: "Courses", to: "/courses", icon: Library, hint: "What you are studying" },
  { label: "Conflict Checker", to: "/conflicts", icon: AlertCircle, hint: "Find clashes in your schedule" },
  { label: "Analytics", to: "/analytics", icon: BarChart3, hint: "Your study habits" },
];

const TONES: Record<Tone, string> = {
  normal: "text-muted-foreground",
  warn: "font-medium text-warning",
  bad: "font-medium text-destructive",
};

// Whole days from today to a date (0 = today, 1 = tomorrow...)
function daysUntil(dateKey: string, todayKey: string): number {
  const date = parseDateString(dateKey);
  const today = parseDateString(todayKey);
  if (!date || !today) return NaN;
  date.setHours(12, 0, 0, 0);
  today.setHours(12, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

// The live line under each tile's name. Shared queries, so nothing is loaded twice.
function useMoreStatus(): Record<string, Status | null> {
  const now = useNow();
  const todayKey = toDateString(now);
  const nowTime = toTimeString(now.getHours(), now.getMinutes());

  const assignments = useQuery({ queryKey: ["assignments"], queryFn: getAssignments });
  const exams = useQuery({ queryKey: ["exams"], queryFn: getExams });
  const events = useQuery({ queryKey: ["events", "all"], queryFn: () => getEvents() });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });

  const status: Record<string, Status | null> = {};

  // ---- Assignments
  if (assignments.data) {
    const list = assignments.data;
    const open = list.filter((a) => a.status !== "completed");
    const overdue = open.filter(
      (a) => a.deadline && new Date(a.deadline).getTime() < now.getTime()
    );
    const weekAhead = now.getTime() + 7 * 86_400_000;
    const dueSoon = open.filter(
      (a) =>
        a.deadline &&
        new Date(a.deadline).getTime() >= now.getTime() &&
        new Date(a.deadline).getTime() <= weekAhead
    );

    if (overdue.length > 0) {
      status["/assignments"] = { text: `${overdue.length} overdue`, tone: "bad" };
    } else if (dueSoon.length > 0) {
      status["/assignments"] = { text: `${dueSoon.length} due this week`, tone: "normal" };
    } else if (open.length > 0) {
      status["/assignments"] = { text: `${open.length} to do`, tone: "normal" };
    } else if (list.length > 0) {
      status["/assignments"] = { text: "All caught up", tone: "normal" };
    } else {
      status["/assignments"] = { text: "No assignments yet", tone: "normal" };
    }
  }

  // ---- Exams (the colours match the countdown chip on the Exams page)
  if (exams.data) {
    const next = exams.data
      .filter((e) => e.exam_date >= todayKey)
      .sort(
        (a, b) =>
          a.exam_date.localeCompare(b.exam_date) ||
          (a.start_time ?? "").localeCompare(b.start_time ?? "")
      )[0];

    if (next) {
      const days = daysUntil(next.exam_date, todayKey);
      const course = (courses.data ?? []).find(
        (c) => String(c.id) === String(next.course_id)
      );
      const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`;
      status["/exams"] = {
        text: `${course?.code ?? next.title} · ${when}`,
        tone: days <= 3 ? "bad" : days <= 7 ? "warn" : "normal",
      };
    } else {
      status["/exams"] = { text: "No upcoming exams", tone: "normal" };
    }
  }

  // ---- Events (today's events that have already finished are skipped)
  if (events.data) {
    const next = events.data
      .filter((e) => {
        if (e.event_date < todayKey) return false;
        const endsAt = e.end_time ?? e.start_time;
        if (e.event_date === todayKey && endsAt && endsAt.slice(0, 5) < nowTime) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.event_date.localeCompare(b.event_date) ||
          (a.start_time ?? "").localeCompare(b.start_time ?? "")
      )[0];

    if (next) {
      const days = daysUntil(next.event_date, todayKey);
      const when =
        days === 0
          ? "Today"
          : days === 1
            ? "Tomorrow"
            : (parseDateString(next.event_date) ?? new Date()).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
      status["/events"] = { text: `${next.title} · ${when}`, tone: "normal" };
    } else {
      status["/events"] = { text: "No upcoming events", tone: "normal" };
    }
  }

  // ---- Courses
  if (courses.data) {
    status["/courses"] = {
      text: courses.data.length === 0 ? "No courses yet" : plural(courses.data.length, "course"),
      tone: "normal",
    };
  }

  return status;
}

// Everything that does not have its own tab in the bottom bar.
export default function MorePage() {
  const status = useMoreStatus();

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-3xl leading-tight"
          style={{ fontFamily: "'Original Surfer', cursive" }}
        >
          More
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything else in Lebid.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const line = status[tile.to];
          return (
            <Link
              key={tile.to}
              to={tile.to}
              className="flex min-h-11 flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-primary">
                <tile.icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{tile.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-xs",
                    line ? TONES[line.tone] : "text-muted-foreground"
                  )}
                >
                  {line ? line.text : tile.hint}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        to="/timetable-import"
        className="flex min-h-11 items-center gap-3 rounded-2xl bg-card p-4 shadow-sm transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-primary">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">Import timetable</span>
          <span className="block text-xs text-muted-foreground">
            From a photo or PDF
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Link>
    </div>
  );
}