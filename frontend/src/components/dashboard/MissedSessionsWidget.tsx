import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, CalendarClock, Check, Lock, MapPin } from "lucide-react";
import { toast } from "sonner";

import { getCourses } from "@/api/courses";
import {
  getMissedStudySessions,
  updateStudySession,
} from "@/api/studySessions";
import type { StudySession } from "@/api/studySessions";
import DashboardCard from "@/components/dashboard/DashboardCard";
import RescheduleStudySessionDialog from "@/components/study-sessions/RescheduleStudySessionDialog";
import { formatTimeLabel } from "@/lib/dateTime";
import { getItemPath } from "@/lib/itemLinks";
import { useNow } from "@/hooks/useNow";

// True once the session ended more than 24 hours ago (the same rule the backend uses)
const isTooOld = (session: StudySession, now: Date): boolean =>
  now.getTime() -
    new Date(`${session.session_date}T${session.end_time.slice(0, 8)}`).getTime() >
  24 * 3_600_000;

// Planned study sessions from earlier days that were never marked as done.
// The student can complete, skip or reschedule them right here.
export default function MissedSessionsWidget({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedulingSession, setReschedulingSession] =
    useState<StudySession | null>(null);

  const missedQuery = useQuery({
    queryKey: ["study-sessions", "missed"],
    queryFn: getMissedStudySessions,
  });
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: getCourses });

  const courses = coursesQuery.data ?? [];

  const getCourseName = (courseId: string) => {
    const course = courses.find((c) => String(c.id) === String(courseId));
    return course ? `${course.code} · ${course.name}` : "Study session";
  };

  // Only sessions the student has not dealt with yet (skipped ones are a decision
  // already made), newest first
  const missed = [...(missedQuery.data ?? [])]
    .filter((session) => session.status === "planned")
    .sort((a, b) =>
      `${b.session_date}${b.start_time}`.localeCompare(`${a.session_date}${a.start_time}`)
    );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["study-sessions"] });

  const handleStatus = async (
    session: StudySession,
    status: "completed" | "skipped"
  ) => {
    setBusyId(session.id);
    try {
      await updateStudySession(session.id, { status });
      await refresh();
      toast.success(
        status === "completed" ? "Session marked as completed" : "Session skipped",
        { description: getCourseName(session.course_id) }
      );
    } catch (error) {
      const detail = (
        error as { response?: { data?: { detail?: unknown } } }
      ).response?.data?.detail;
      toast.error("Couldn't update the session", {
        description: typeof detail === "string" ? detail : "Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  let subtitle = "Loading...";
  if (!missedQuery.isLoading) {
    subtitle =
      missed.length === 0
        ? "Nothing missed"
        : `${missed.length} ${missed.length === 1 ? "session" : "sessions"} missed`;
  }

  return (
    <>
      <DashboardCard
        title="Missed study sessions"
        subtitle={subtitle}
        icon={AlertCircle}
        action={{ label: "Planner", to: "/planner" }}
        className={className}
      >
        {missedQuery.isError && (
          <p className="text-sm text-destructive">
            We couldn&apos;t load your missed sessions.{" "}
            <button
              type="button"
              onClick={() => missedQuery.refetch()}
              className="font-semibold underline"
            >
              Retry
            </button>
          </p>
        )}

        {!missedQuery.isLoading && !missedQuery.isError && missed.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No missed study sessions. Great consistency!
          </p>
        )}

        <ul className="space-y-2">
          {missed.map((session) => {
            const isBusy = busyId === session.id;
            const date = new Date(`${session.session_date}T00:00:00`);

            return (
              <li key={session.id} className="rounded-xl border border-border p-3">
                <Link
                  to={getItemPath("study_session", session.id, session.session_date)}
                  className="block transition hover:opacity-80"
                >
                  <p className="text-xs font-semibold">
                    {date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {formatTimeLabel(session.start_time)} –{" "}
                    {formatTimeLabel(session.end_time)}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {getCourseName(session.course_id)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    {session.venue || "No venue"}
                    {session.topic ? ` · ${session.topic}` : ""}
                  </p>
                </Link>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleStatus(session, "completed")}
                    className="inline-flex items-center gap-1 rounded-lg bg-success px-2.5 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                  >
                    <Check className="size-3" aria-hidden="true" />
                    Complete
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleStatus(session, "skipped")}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    Skip
                  </button>

                  {session.is_edit_locked || isTooOld(session, now) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Lock className="size-3" aria-hidden="true" />
                      Too old to reschedule
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setReschedulingSession(session)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-secondary disabled:opacity-50"
                    >
                      <CalendarClock className="size-3" aria-hidden="true" />
                      Reschedule
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </DashboardCard>

      <RescheduleStudySessionDialog
        session={reschedulingSession}
        courses={courses}
        onClose={() => setReschedulingSession(null)}
        onSessionRescheduled={(newSession) => {
          refresh();
          toast.success("Study session rescheduled", {
            description: getCourseName(newSession.course_id),
          });
        }}
      />
    </>
  );
}