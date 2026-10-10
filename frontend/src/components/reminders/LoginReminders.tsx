import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarClock, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { getAssignments } from "@/api/assignments";
import { getCourses } from "@/api/courses";
import { getUpcomingEvents } from "@/api/events";
import { getExams } from "@/api/exams";
import { getStudySessions } from "@/api/studySessions";
import { getTasks } from "@/api/tasks";
import { useAuth } from "@/context/AuthContext";
import { formatTimeLabel, toDateString } from "@/lib/dateTime";
import { getItemPath } from "@/lib/itemLinks";
import type { ItemType } from "@/lib/itemLinks";
import { REMINDER_STORAGE_PREFIX } from "@/lib/reminders";
import { cn } from "@/lib/utils";

const AWAY_MINUTES = 30; // away this long = "coming back"
const SESSION_SOON_MINUTES = 60; // a session this close counts as "close"
const DEADLINE_HOURS = 24; // something due within this long counts as "almost due"
const MAX_TOASTS_PER_KIND = 3;
const TOAST_DURATION_MS = 15_000;

const atTime = (dateKey: string, time: string) =>
  new Date(`${dateKey}T${time.slice(0, 8)}`);

// 45 -> "45 min", 130 -> "2 h 10 min"
function formatCountdown(minutes: number): string {
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// "Today, 5:00 PM" or "Tomorrow, 9:00 AM"
function formatWhen(date: Date, now: Date): string {
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return date.toDateString() === now.toDateString()
    ? `Today, ${time}`
    : `Tomorrow, ${time}`;
}

interface ReminderToastProps {
  icon: LucideIcon;
  accent: string;
  title: string;
  lines: string[];
  onOpen: () => void;
  onClose: () => void;
}

// The look of one reminder pop-up. The whole card is clickable.
function ReminderToast({
  icon: Icon,
  accent,
  title,
  lines,
  onOpen,
  onClose,
}: ReminderToastProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-input bg-card p-3.5 text-left text-card-foreground shadow-lg transition hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          accent
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {lines.map((line) => (
          <p key={line} className="truncate text-xs text-muted-foreground">
            {line}
          </p>
        ))}
        <p className="mt-1 text-[11px] font-semibold text-primary">
          Tap to open
        </p>
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="rounded p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

interface DueItem {
  type: ItemType;
  id: string;
  label: string; // "Assignment", "Exam"...
  title: string;
  courseCode: string | null;
  when: Date;
  allDay: boolean;
}

// Shows pop-ups when the student comes back: study sessions that are close,
// and deadlines / exams / events due within 24 hours. Mounted once in AppLayout.
export default function LoginReminders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const open = (toastId: string | number, path: string) => {
      toast.dismiss(toastId);
      navigate(path);
    };

    const showReminders = async () => {
      const now = new Date();
      const todayKey = toDateString(now);
      const limit = new Date(now.getTime() + DEADLINE_HOURS * 3_600_000);

      try {
        const [courses, sessions, tasks, assignments, exams, events] =
          await Promise.all([
            queryClient.fetchQuery({ queryKey: ["courses"], queryFn: getCourses }),
            queryClient.fetchQuery({
              queryKey: ["study-sessions", "day", todayKey],
              queryFn: () =>
                getStudySessions({ date_from: todayKey, date_to: todayKey }),
            }),
            queryClient.fetchQuery({ queryKey: ["tasks"], queryFn: getTasks }),
            queryClient.fetchQuery({
              queryKey: ["assignments"],
              queryFn: getAssignments,
            }),
            queryClient.fetchQuery({ queryKey: ["exams"], queryFn: getExams }),
            queryClient.fetchQuery({
              queryKey: ["events", "upcoming", 2],
              queryFn: () => getUpcomingEvents(2),
            }),
          ]);

        // ---------- 1. Study sessions that are close (or in progress) ----------
        const soonSessions = sessions
          .filter((s) => s.status === "planned" || s.status === "in_progress")
          .map((s) => ({
            session: s,
            start: atTime(s.session_date, s.start_time),
            end: atTime(s.session_date, s.end_time),
          }))
          .filter(
            ({ start, end }) =>
              end > now &&
              start.getTime() - now.getTime() <= SESSION_SOON_MINUTES * 60_000
          )
          .sort((a, b) => a.start.getTime() - b.start.getTime())
          .slice(0, MAX_TOASTS_PER_KIND);

        for (const { session, start } of soonSessions) {
          const course = courses.find(
            (c) => String(c.id) === String(session.course_id)
          );
          const minutesLeft = Math.round(
            (start.getTime() - now.getTime()) / 60_000
          );
          const title =
            start <= now
              ? "Study session in progress"
              : `Study session starts in ${formatCountdown(minutesLeft)}`;
          const path = getItemPath(
            "study_session",
            session.id,
            session.session_date
          );

          toast.custom(
            (toastId) => (
              <ReminderToast
                icon={BookOpen}
                accent="bg-primary/10 text-primary"
                title={title}
                lines={[
                  course ? `${course.code} · ${course.name}` : "Study session",
                  `${formatTimeLabel(session.start_time)} – ${formatTimeLabel(
                    session.end_time
                  )} · ${session.venue || "No venue set"}`,
                ]}
                onOpen={() => open(toastId, path)}
                onClose={() => toast.dismiss(toastId)}
              />
            ),
            { id: `reminder-session-${session.id}`, duration: TOAST_DURATION_MS }
          );
        }

        // ---------- 2. Deadlines, exams and events due within 24 hours ----------
        const due: DueItem[] = [];

        const addIfDue = (item: DueItem) => {
          if (item.when >= now && item.when <= limit) due.push(item);
        };

        for (const t of tasks) {
          if (t.status === "completed" || !t.deadline) continue;
          addIfDue({
            type: "task",
            id: t.id,
            label: "Task",
            title: t.title,
            courseCode: t.course_code,
            when: new Date(t.deadline),
            allDay: false,
          });
        }

        for (const a of assignments) {
          if (a.status === "completed" || !a.deadline) continue;
          addIfDue({
            type: "assignment",
            id: a.id,
            label: "Assignment",
            title: a.title,
            courseCode: a.course_code,
            when: new Date(a.deadline),
            allDay: false,
          });
        }

        for (const e of exams) {
          const course = courses.find(
            (c) => String(c.id) === String(e.course_id)
          );
          addIfDue({
            type: "exam",
            id: e.id,
            label: "Exam",
            title: e.title,
            courseCode: course?.code ?? null,
            when: e.start_time
              ? atTime(e.exam_date, e.start_time)
              : atTime(e.exam_date, "23:59:59"),
            allDay: !e.start_time,
          });
        }

        for (const ev of events) {
          addIfDue({
            type: "event",
            id: ev.id,
            label: "Event",
            title: ev.title,
            courseCode: null,
            when: ev.start_time
              ? atTime(ev.event_date, ev.start_time)
              : atTime(ev.event_date, "23:59:59"),
            allDay: !ev.start_time,
          });
        }

        due.sort((a, b) => a.when.getTime() - b.when.getTime());

        for (const item of due.slice(0, MAX_TOASTS_PER_KIND)) {
          const isDeadline = item.type === "task" || item.type === "assignment";
          const minutesLeft = Math.round(
            (item.when.getTime() - now.getTime()) / 60_000
          );
          const isUrgent = minutesLeft <= 180;

          const title = item.allDay
            ? `${item.label} ${
                item.when.toDateString() === now.toDateString()
                  ? "today"
                  : "tomorrow"
              }`
            : `${item.label} ${isDeadline ? "due" : "starts"} in ${formatCountdown(
                minutesLeft
              )}`;

          const detail = item.allDay
            ? "All day"
            : `${isDeadline ? "Due" : "Starts"} ${formatWhen(item.when, now)}`;

          const path = getItemPath(item.type, item.id);

          toast.custom(
            (toastId) => (
              <ReminderToast
                icon={CalendarClock}
                accent={
                  isUrgent
                    ? "bg-destructive/10 text-destructive"
                    : "bg-warning/15 text-warning"
                }
                title={title}
                lines={[
                  item.courseCode
                    ? `${item.title} · ${item.courseCode}`
                    : item.title,
                  detail,
                ]}
                onOpen={() => open(toastId, path)}
                onClose={() => toast.dismiss(toastId)}
              />
            ),
            {
              id: `reminder-${item.type}-${item.id}`,
              duration: TOAST_DURATION_MS,
            }
          );
        }

        // More than 3? One extra pop-up for the rest.
        if (due.length > MAX_TOASTS_PER_KIND) {
          const extra = due.length - MAX_TOASTS_PER_KIND;
          toast.custom(
            (toastId) => (
              <ReminderToast
                icon={CalendarClock}
                accent="bg-warning/15 text-warning"
                title={`${extra} more ${
                  extra === 1 ? "thing is" : "things are"
                } due within 24 hours`}
                lines={["See everything on your Dashboard"]}
                onOpen={() => open(toastId, "/dashboard")}
                onClose={() => toast.dismiss(toastId)}
              />
            ),
            { id: "reminder-more", duration: TOAST_DURATION_MS }
          );
        }
      } catch {
        // Reminders are a bonus: if something fails, stay quiet.
      }
    };

    // Show them the first time this tab opens the app after a login
    const storageKey = `${REMINDER_STORAGE_PREFIX}${userId}`;
    if (!sessionStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, "1");
      void showReminders();
    }

    // ...and again when the student comes back after being away for a while
    let hiddenAt: number | null = null;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_MINUTES * 60_000) {
        void showReminders();
      }
      hiddenAt = null;
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [userId, navigate, queryClient]);

  return null;
}