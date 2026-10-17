import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, ChevronRight } from "lucide-react";

import { getCourses } from "@/api/courses";
import { getLectureOccurrences } from "@/api/lectureOccurrences";
import { getStudySessions } from "@/api/studySessions";
import { getTimetable } from "@/api/timetable";
import { useNow } from "@/hooks/useNow";
import { formatTimeLabel, toDateString } from "@/lib/dateTime";
import { getItemPath } from "@/lib/itemLinks";

const MAX_ROWS = 2;
const pad = (n: number) => String(n).padStart(2, "0");

interface RowProps {
  to: string;
  color: string | null;
  name: string;
  meta: string;
}

function ItemRow({ to, color, name, meta }: RowProps) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center gap-2 border-t border-border/70 py-2 first:border-t-0 dark:border-white/5"
    >
      <span
        aria-hidden="true"
        className="w-[3px] self-stretch rounded-full"
        style={{ backgroundColor: color || "var(--primary)" }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] leading-tight font-semibold">{name}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{meta}</span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

interface CardProps {
  icon: typeof BookOpen;
  title: string;
  leftText: string;
  children: React.ReactNode;
}

function TodayCard({ icon: Icon, title, leftText, children }: CardProps) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="size-[18px] shrink-0 text-primary" aria-hidden="true" />
        <h3 className="truncate text-sm font-semibold">{title}</h3>
      </div>
      <p className="mb-1 text-[11px] text-muted-foreground">{leftText}</p>
      {children}
    </section>
  );
}

// "Today's Classes" and "Study Sessions", side by side.
export default function MobileTodayCards() {
  const now = useNow();
  const todayKey = toDateString(now);
  const weekday = (now.getDay() + 6) % 7;
  const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const timetable = useQuery({ queryKey: ["timetable"], queryFn: getTimetable });
  const marks = useQuery({
    queryKey: ["lecture-occurrences", "all"],
    queryFn: () => getLectureOccurrences(),
  });
  const sessionsQuery = useQuery({
    queryKey: ["study-sessions", "day", todayKey],
    queryFn: () => getStudySessions({ date_from: todayKey, date_to: todayKey }),
  });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });

  // ---- Classes still to come today (not marked, not finished)
  const markedToday = new Set(
    (marks.data ?? [])
      .filter((m) => m.occurrence_date === todayKey)
      .map((m) => m.timetable_entry_id)
  );
  const classesLeft = (timetable.data ?? [])
    .filter((entry) => entry.day_of_week === weekday)
    .filter(
      (entry) =>
        !markedToday.has(String(entry.id)) &&
        entry.end_time.slice(0, 5) > nowTime
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // ---- Study sessions still to do today
  const sessionsLeft = (sessionsQuery.data ?? [])
    .filter((s) => s.status === "planned" || s.status === "in_progress")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const courseFor = (courseId: string | number) =>
    (courses.data ?? []).find((c) => String(c.id) === String(courseId));

  const moreClasses = classesLeft.length - MAX_ROWS;
  const moreSessions = sessionsLeft.length - MAX_ROWS;

  return (
    <div className="grid grid-cols-2 gap-3">
      <TodayCard
        icon={CalendarDays}
        title="Today's Classes"
        leftText={
          timetable.isLoading
            ? "Loading..."
            : classesLeft.length === 0
              ? "Nothing more today"
              : `${classesLeft.length} left`
        }
      >
        {classesLeft.slice(0, MAX_ROWS).map((entry) => (
          <ItemRow
            key={entry.id}
            to={getItemPath("lecture", entry.id, todayKey)}
            color={entry.course_color}
            name={[entry.course_code, entry.course_name].filter(Boolean).join(" – ")}
            meta={[
              `${formatTimeLabel(entry.start_time)} – ${formatTimeLabel(entry.end_time)}`,
              entry.venue,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
        {moreClasses > 0 && (
          <Link to="/timetable" className="block pt-1 text-[11px] font-semibold text-primary">
            +{moreClasses} more
          </Link>
        )}
      </TodayCard>

      <TodayCard
        icon={BookOpen}
        title="Study Sessions"
        leftText={
          sessionsQuery.isLoading
            ? "Loading..."
            : sessionsLeft.length === 0
              ? "Nothing planned"
              : `${sessionsLeft.length} left`
        }
      >
        {sessionsLeft.slice(0, MAX_ROWS).map((session) => {
          const course = courseFor(session.course_id);
          return (
            <ItemRow
              key={session.id}
              to={getItemPath("study_session", session.id, session.session_date)}
              color={course?.color ?? null}
              name={
                course
                  ? [course.code, course.name].filter(Boolean).join(" – ")
                  : "Study session"
              }
              meta={[formatTimeLabel(session.start_time), session.venue]
                .filter(Boolean)
                .join(" · ")}
            />
          );
        })}
        {sessionsLeft.length === 0 && !sessionsQuery.isLoading && (
          <Link to="/planner" className="block pt-1 text-[11px] font-semibold text-primary">
            Open the planner
          </Link>
        )}
        {moreSessions > 0 && (
          <Link to="/planner" className="block pt-1 text-[11px] font-semibold text-primary">
            +{moreSessions} more
          </Link>
        )}
      </TodayCard>
    </div>
  );
}