import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Check, MapPin } from "lucide-react";
import { toast } from "sonner";

import { getCourses } from "@/api/courses";
import { getStudySessions, updateStudySession } from "@/api/studySessions";
import type { StudySession } from "@/api/studySessions";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { useNow } from "@/hooks/useNow";
import { formatTimeLabel, toDateString, toTimeString } from "@/lib/dateTime";
import { getItemPath } from "@/lib/itemLinks";

// Today's study sessions that are still to do. Students can mark a session
// completed or skip it without leaving the dashboard.
export default function TodaySessionsWidget({ className }: { className?: string }) {
  const now = useNow();
  const queryClient = useQueryClient();
  const todayKey = toDateString(now);
  const nowTime = toTimeString(now.getHours(), now.getMinutes());
  const [busyId, setBusyId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["study-sessions", "day", todayKey],
    queryFn: () => getStudySessions({ date_from: todayKey, date_to: todayKey }),
  });
  const coursesQuery = useQuery({ queryKey: ["courses"], queryFn: getCourses });

  const getCourseName = (courseId: string) => {
    const course = (coursesQuery.data ?? []).find(
      (c) => String(c.id) === String(courseId)
    );
    return course ? `${course.code} · ${course.name}` : "Study session";
  };

  const sessions = (sessionsQuery.data ?? [])
    .filter((s) => s.status !== "rescheduled")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const remaining = sessions.filter(
    (s) => s.status === "planned" || s.status === "in_progress"
  );
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const total = completedCount + remaining.length; // skipped ones are not counted
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  // The first session that has not started yet gets an "Up next" tag
  const upNextId = remaining.find(
    (s) => s.start_time.slice(0, 5) > nowTime
  )?.id;

  const handleStatus = async (
    session: StudySession,
    status: "completed" | "skipped"
  ) => {
    setBusyId(session.id);
    try {
      await updateStudySession(session.id, { status });
      await queryClient.invalidateQueries({ queryKey: ["study-sessions"] });
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
  if (!sessionsQuery.isLoading) {
    subtitle =
      remaining.length === 0
        ? total === 0
          ? "None planned today"
          : "All done for today"
        : `${remaining.length} left today`;
  }

  return (
    <DashboardCard
      title="Study sessions"
      subtitle={subtitle}
      icon={BookOpen}
      action={{ label: "Planner", to: "/planner" }}
      className={className}
    >
      {sessionsQuery.isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load your study sessions.{" "}
          <button
            type="button"
            onClick={() => sessionsQuery.refetch()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </p>
      )}

      {total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {completedCount} of {total} done
            </span>
            <span>{percent}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {!sessionsQuery.isLoading && !sessionsQuery.isError && remaining.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {total === 0 ? (
            <>
              No study sessions planned for today.{" "}
              <Link to="/planner" className="font-semibold text-primary hover:underline">
                Plan one
              </Link>
            </>
          ) : (
            "You've finished every study session for today. Well done!"
          )}
        </p>
      )}

      <ul className="space-y-2">
        {remaining.map((session) => {
          const started = session.start_time.slice(0, 5) <= nowTime;
          const ended = session.end_time.slice(0, 5) <= nowTime;
          const isBusy = busyId === session.id;

          return (
            <li key={session.id} className="rounded-xl border border-border p-3">
              <Link
                to={getItemPath("study_session", session.id, session.session_date)}
                className="block transition hover:opacity-80"
              >
                <p className="flex items-center gap-2 text-xs font-semibold">
                  {formatTimeLabel(session.start_time)} –{" "}
                  {formatTimeLabel(session.end_time)}
                  {session.id === upNextId && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                      Up next
                    </span>
                  )}
                  {started && !ended && (
                    <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] text-success">
                      Now
                    </span>
                  )}
                  {ended && (
                    <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] text-warning">
                      Time passed
                    </span>
                  )}
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

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={isBusy || !started}
                  title={started ? undefined : "Available once the session starts"}
                  onClick={() => handleStatus(session, "completed")}
                  className="inline-flex items-center gap-1 rounded-lg bg-success px-2.5 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}