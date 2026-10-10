import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CalendarX2,
  Clock3,
  MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import {
  deleteLectureMark,
  getLectureOccurrences,
} from "@/api/lectureOccurrences";
import type { LectureOccurrence } from "@/api/lectureOccurrences";

// This page only shows these two kinds of marks
type ListedStatus = "missed" | "cancelled";
import { Button } from "@/components/ui/button";
import { formatTimeLabel, parseDateString } from "@/lib/dateTime";

const PAGE_TEXT: Record<
  ListedStatus,
  { title: string; description: string; empty: string; icon: LucideIcon }
> = {
  missed: {
    title: "Missed lectures",
    description: "Lectures you marked as missed, newest first.",
    empty: "No missed lectures. Keep it up!",
    icon: AlertCircle,
  },
  cancelled: {
    title: "Cancelled lectures",
    description: "Lectures you marked as cancelled by the lecturer, newest first.",
    empty: "No cancelled lectures.",
    icon: CalendarX2,
  },
};

// "2026-10-05" -> "Monday, October 5, 2026"
function formatFullDate(value: string): string {
  const date = parseDateString(value);
  if (!date) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const courseLabel = (mark: LectureOccurrence) =>
  mark.course_code || mark.course_name;

export default function LectureMarksPage({ status }: { status: ListedStatus }) {
  const queryClient = useQueryClient();
  const text = PAGE_TEXT[status];
  const Icon = text.icon;

  const [courseFilter, setCourseFilter] = useState("all");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: marks = [], isLoading, isError } = useQuery({
    queryKey: ["lecture-occurrences", "list", status],
    queryFn: () => getLectureOccurrences({ status }),
  });

  const courseOptions = Array.from(new Set(marks.map(courseLabel)));
  const visibleMarks =
    courseFilter === "all"
      ? marks
      : marks.filter((mark) => courseLabel(mark) === courseFilter);

  const handleRemove = async (mark: LectureOccurrence) => {
    setRemovingId(mark.id);
    try {
      await deleteLectureMark(mark.id);
      await queryClient.invalidateQueries({ queryKey: ["lecture-occurrences"] });
      toast.success("Mark removed", {
        description: `${courseLabel(mark)} · ${formatFullDate(mark.occurrence_date)}`,
      });
    } catch {
      toast.error("Couldn't remove the mark", {
        description: "Please try again.",
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/timetable"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to timetable
      </Link>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {text.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {text.description}
          </p>
        </div>

        {courseOptions.length > 1 && (
          <select
            aria-label="Filter by course"
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="all">All courses</option>
            {courseOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </section>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          We couldn&apos;t load this list. Please refresh the page.
        </p>
      )}

      {!isLoading && !isError && (
        <p className="text-sm font-medium text-muted-foreground">
          {visibleMarks.length}{" "}
          {visibleMarks.length === 1 ? "lecture" : "lectures"}
        </p>
      )}

      {!isLoading && !isError && visibleMarks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-input px-6 py-12 text-center text-sm text-muted-foreground">
          {text.empty}
        </div>
      )}

      <ul className="space-y-3">
        {visibleMarks.map((mark) => {
          const color = mark.course_color || "var(--primary)";
          return (
            <li
              key={mark.id}
              className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 pl-6 shadow-sm"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: color }}
              />

              <div className="min-w-0 flex-1">
                {mark.course_code && (
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color }}
                  >
                    {mark.course_code}
                  </p>
                )}
                <h3 className="mt-0.5 text-base font-semibold leading-tight">
                  {mark.course_name}
                </h3>
                <p className="mt-1 text-sm font-medium">
                  {formatFullDate(mark.occurrence_date)}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" />
                    {formatTimeLabel(mark.start_time)} –{" "}
                    {formatTimeLabel(mark.end_time)}
                  </span>
                  {mark.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {mark.venue}
                    </span>
                  )}
                  <span className="capitalize">{mark.class_type}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removingId === mark.id}
                onClick={() => handleRemove(mark)}
              >
                {removingId === mark.id ? "Removing..." : "Remove mark"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}