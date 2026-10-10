import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin } from "lucide-react";

import { getLectureOccurrences } from "@/api/lectureOccurrences";
import { getTimetable } from "@/api/timetable";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { useNow } from "@/hooks/useNow";
import { formatTimeLabel, toDateString, toTimeString } from "@/lib/dateTime";
import { getItemPath } from "@/lib/itemLinks";

// Today's classes that are still to come (or happening now).
// Cancelled classes, and ones the student marked completed or missed, are skipped.
export default function TodayClassesWidget({ className }: { className?: string }) {
  const now = useNow();
  const todayKey = toDateString(now);
  const weekday = (now.getDay() + 6) % 7; // Monday = 0
  const nowTime = toTimeString(now.getHours(), now.getMinutes());

  const timetable = useQuery({ queryKey: ["timetable"], queryFn: getTimetable });
  const marks = useQuery({
    queryKey: ["lecture-occurrences", "all"],
    queryFn: () => getLectureOccurrences(),
  });

  const todaysClasses = (timetable.data ?? [])
    .filter((entry) => entry.day_of_week === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const markFor = (entryId: string | number) =>
    (marks.data ?? []).find(
      (mark) =>
        mark.timetable_entry_id === String(entryId) &&
        mark.occurrence_date === todayKey
    );

  const cancelledCount = todaysClasses.filter(
    (entry) => markFor(entry.id)?.status === "cancelled"
  ).length;

  const upcoming = todaysClasses.filter(
    (entry) => !markFor(entry.id) && entry.end_time.slice(0, 5) > nowTime
  );

  const isLoading = timetable.isLoading || marks.isLoading;

  let subtitle = "Loading...";
  if (!isLoading) {
    subtitle =
      upcoming.length === 0
        ? "Nothing left today"
        : `${upcoming.length} ${upcoming.length === 1 ? "class" : "classes"} left`;
  }

  return (
    <DashboardCard
      title="Today's classes"
      subtitle={subtitle}
      icon={CalendarDays}
      action={{ label: "Timetable", to: "/timetable" }}
      className={className}
    >
      {timetable.isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load your classes.{" "}
          <button
            type="button"
            onClick={() => timetable.refetch()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </p>
      )}

      {!isLoading && !timetable.isError && upcoming.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {todaysClasses.length === 0
            ? "No classes today. Enjoy the day!"
            : "You're done with classes for today."}
          {cancelledCount > 0 &&
            ` ${cancelledCount} ${cancelledCount === 1 ? "class was" : "classes were"} cancelled.`}
        </p>
      )}

      <ul className="space-y-2">
        {upcoming.map((entry) => {
          const isNow = entry.start_time.slice(0, 5) <= nowTime;
          const color = entry.course_color || "var(--primary)";

          return (
            <li key={entry.id}>
              <Link
                to={getItemPath("lecture", entry.id, todayKey)}
                className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-border px-3 py-2.5 pl-4 transition hover:border-primary/40 hover:bg-primary/5"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: color }}
                />
                <div className="w-16 shrink-0 text-xs font-semibold leading-tight">
                  <p>{formatTimeLabel(entry.start_time)}</p>
                  <p className="font-normal text-muted-foreground">
                    {formatTimeLabel(entry.end_time)}
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color }}
                  >
                    {entry.course_code}
                    {isNow && (
                      <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] text-success">
                        Now
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {entry.course_name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    {entry.venue || "No venue"} ·{" "}
                    <span className="capitalize">{entry.class_type}</span>
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