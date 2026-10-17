import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

import { getCourses } from "@/api/courses";
import { getStudySessions } from "@/api/studySessions";
import { Checkbox } from "@/components/ui/checkbox";
import { sessionHasEnded, sessionHasStarted, useStudySessionActions } from "@/hooks/useStudySessionActions";
import { useNow } from "@/hooks/useNow";
import type { Visibility } from "@/hooks/usePlannerDay";
import { formatTimeLabel, toDateString } from "@/lib/dateTime";
import { KIND_COLORS, KIND_LABELS, KIND_ORDER } from "@/lib/plannerColors";
import type { PlannerKind } from "@/lib/plannerColors";

interface PlannerTopCardsProps {
  visible: Visibility;
  onToggle: (kind: PlannerKind, value: boolean) => void;
}

// "Today" summary card (with the next session) beside the "Other Calendars" toggles.
export default function PlannerTopCards({ visible, onToggle }: PlannerTopCardsProps) {
  const now = useNow();
  const todayKey = toDateString(now);
  const { setStatus } = useStudySessionActions();

  const sessionsQuery = useQuery({
    queryKey: ["study-sessions", "day", todayKey],
    queryFn: () => getStudySessions({ date_from: todayKey, date_to: todayKey }),
  });
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });

  const sessions = (sessionsQuery.data ?? []).filter((s) => s.status !== "rescheduled");
  const done = sessions.filter((s) => s.status === "completed").length;
  const left = sessions
    .filter((s) => (s.status === "planned" || s.status === "in_progress") && !sessionHasEnded(s, now))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const next = left[0];
  const nextCourse = next
    ? (courses.data ?? []).find((c) => String(c.id) === String(next.course_id))
    : undefined;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Today */}
      <section className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Today</h2>
          <BookOpen className="size-4 text-primary" aria-hidden="true" />
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {left.length} left · {done} done
        </p>

        {next ? (
          <div className="mt-2">
            <p className="text-[11px] text-muted-foreground">Next</p>
            <p className="text-[12.5px] leading-tight font-semibold">
              {nextCourse ? nextCourse.name : "Study session"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatTimeLabel(next.start_time)}
            </p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  sessionHasStarted(next, now)
                    ? void setStatus(next, "completed")
                    : toast.info("Available once the session starts")
                }
                className={
                  sessionHasStarted(next, now)
                    ? "h-8 flex-1 rounded-lg bg-success text-[11px] font-semibold text-white"
                    : "h-8 flex-1 rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground"
                }
              >
                Complete
              </button>
              <button
                type="button"
                onClick={() => void setStatus(next, "skipped")}
                className="h-8 flex-1 rounded-lg bg-muted text-[11px] font-semibold"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {sessionsQuery.isLoading ? "Loading..." : "No sessions left today."}
          </p>
        )}
      </section>

      {/* Other calendars */}
      <section className="rounded-2xl border border-border bg-card p-3">
        <h2 className="text-sm font-semibold">Other Calendars</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Choose what shows on your calendar.
        </p>
        <ul className="mt-2 space-y-1.5">
          {KIND_ORDER.map((kind) => (
            <li key={kind}>
              <label className="flex min-h-6 items-center gap-2 text-xs">
                <Checkbox
                  checked={visible[kind]}
                  onCheckedChange={(value) => onToggle(kind, value === true)}
                  aria-label={KIND_LABELS[kind]}
                />
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: KIND_COLORS[kind] }}
                />
                {KIND_LABELS[kind]}
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}