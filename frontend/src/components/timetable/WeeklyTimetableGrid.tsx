import { useEffect, useMemo, useState } from "react";

import type { TimetableEntry } from "@/api/timetable";
import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const TIME_SLOTS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith("#")) {
    return `rgba(127, 29, 29, ${alpha})`;
  }

  const cleanHex = hex.replace("#", "");

  if (cleanHex.length !== 6) {
    return `rgba(127, 29, 29, ${alpha})`;
  }

  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  entries: TimetableEntry[];
}

export default function WeeklyTimetableGrid({ entries }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedEntry, setSelectedEntry] =
    useState<TimetableEntry | null>(null);

  const ROW_HEIGHT = 72;
  const TIME_COLUMN_WIDTH = 58;

  const GRID_START = timeToMinutes("07:00");

  const DAY_INDEX: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const data = await getCourses();
        setCourses(data);
      } catch (error) {
        console.error("Failed to load courses:", error);
      }
    };

    loadCourses();
  }, []);

  const courseMap = useMemo(() => {
    const map: Record<number, Course> = {};

    courses.forEach((course) => {
      map[course.id] = course;
    });

    return map;
  }, [courses]);

  function getCourse(entry: TimetableEntry): Course | undefined {
    return courseMap[entry.course_id];
  }

  function getCourseColor(entry: TimetableEntry): string {
    const course = getCourse(entry);

    if (course?.color) {
      return course.color;
    }

    if (
      typeof entry.course_color === "string" &&
      entry.course_color.length > 0
    ) {
      return entry.course_color;
    }

    return "#7f1d1d";
  }

  function getCourseName(entry: TimetableEntry): string {
    const course = getCourse(entry);

    if (course?.name) {
      return course.name;
    }

    if (
      typeof entry.course_name === "string" &&
      entry.course_name.length > 0
    ) {
      return entry.course_name;
    }

    return "Course";
  }

  function getCourseCode(entry: TimetableEntry): string {
    const course = getCourse(entry);

    if (course?.code) {
      return course.code;
    }

    if (
      typeof entry.course_code === "string" &&
      entry.course_code.length > 0
    ) {
      return entry.course_code;
    }

    return "";
  }

  function getEntryStyle(entry: TimetableEntry) {
    const start = timeToMinutes(entry.start_time);
    const end = timeToMinutes(entry.end_time);

    const top = ((start - GRID_START) / 60) * ROW_HEIGHT;

    const height = ((end - start) / 60) * ROW_HEIGHT;

    return {
      top,
      height,
    };
  }

  function getEntriesForDay(day: string): TimetableEntry[] {
    return entries.filter(
      (entry) => entry.day_of_week === DAY_INDEX[day]
    );
  }

  function closeDetails() {
    setSelectedEntry(null);
  }

  return (
    <>
      {/* TIMETABLE */}
      <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* DAY HEADER */}
        <div
          className="grid border-b border-border bg-muted/30"
          style={{
            gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(5, minmax(0, 1fr))`,
          }}
        >
          <div />

          {DAYS.map((day) => (
            <div
              key={day}
              className="min-w-0 px-1 py-4 text-center sm:px-2"
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
                {day.slice(0, 3)}
              </p>

              <p className="mt-1 truncate text-[10px] font-semibold sm:text-xs">
                {day}
              </p>
            </div>
          ))}
        </div>

        {/* TIMETABLE BODY */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(5, minmax(0, 1fr))`,
          }}
        >
          {/* TIME COLUMN */}
          <div className="bg-muted/10">
            {TIME_SLOTS.map((time) => (
              <div
                key={time}
                className="flex items-start justify-end pr-2 pt-2"
                style={{
                  height: ROW_HEIGHT,
                }}
              >
                <span className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                  {formatTime(time)}
                </span>
              </div>
            ))}
          </div>

          {/* DAYS */}
          {DAYS.map((day) => (
            <div
              key={day}
              className="relative min-w-0 bg-background"
              style={{
                height: ROW_HEIGHT * TIME_SLOTS.length,
              }}
            >
              {getEntriesForDay(day).map((entry) => {
                const { top, height } =
                  getEntryStyle(entry);

                const color =
                  getCourseColor(entry);

                const courseName =
                  getCourseName(entry);

                const courseCode =
                  getCourseCode(entry);

                const blockHeight = Math.max(
                  height - 10,
                  62
                );

                const nameLength =
                  courseName.length;

                const courseNameSize =
                  nameLength > 45
                    ? "text-[8px]"
                    : nameLength > 32
                    ? "text-[9px]"
                    : "text-[10px]";

                const isSelected =
                  selectedEntry?.id === entry.id;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() =>
                      setSelectedEntry(entry)
                    }
                    className="group absolute left-1 right-1 z-10 min-w-0 overflow-hidden rounded-xl border text-left transition-all duration-200 hover:z-30 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none"
                    style={{
                      top: top + 5,
                      height: blockHeight,

                      backgroundColor:
                        hexToRgba(color, 0.16),

                      borderColor:
                        isSelected
                          ? color
                          : hexToRgba(color, 0.38),

                      borderLeftWidth: "4px",

                      borderLeftColor: color,

                      boxShadow: isSelected
                        ? `0 0 0 2px ${hexToRgba(
                            color,
                            0.2
                          )}, 0 8px 24px ${hexToRgba(
                            color,
                            0.2
                          )}`
                        : undefined,
                    }}
                  >
                    <div className="flex h-full min-h-0 flex-col px-1.5 py-2 sm:px-2">
                      {/* COURSE NAME */}
                      <div className="min-w-0">
                        <p
                          className={`${courseNameSize} font-bold leading-tight`}
                          style={{
                            color,
                            overflowWrap: "break-word",
                            wordBreak: "normal",
                          }}
                        >
                          {courseName}
                        </p>

                        {courseCode && (
                          <p
                            className="mt-0.5 truncate text-[7px] font-semibold uppercase tracking-wide"
                            style={{
                              color,
                              opacity: 0.7,
                            }}
                          >
                            {courseCode}
                          </p>
                        )}
                      </div>

                      {/* CLASS TYPE */}
                      <p className="mt-1 truncate text-[8px] font-semibold text-foreground sm:text-[9px]">
                        {entry.class_type || "Class"}
                      </p>

                      {/* VENUE */}
                      {entry.venue && (
                        <p className="mt-0.5 truncate text-[7px] text-foreground/60 sm:text-[8px]">
                          📍 {entry.venue}
                        </p>
                      )}

                      {/* LECTURER */}
                      {entry.lecturer && (
                        <p className="mt-0.5 truncate text-[7px] text-foreground/60 sm:text-[8px]">
                          👤 {entry.lecturer}
                        </p>
                      )}

                      {/* TIME */}
                      <div className="mt-auto min-w-0 pt-1">
                        <p className="truncate text-[7px] font-medium text-foreground/60 sm:text-[8px]">
                          {formatTime(
                            entry.start_time
                          )}{" "}
                          –{" "}
                          {formatTime(
                            entry.end_time
                          )}
                        </p>
                      </div>
                    </div>

                    {/* HOVER LABEL */}
                    <div
                      className="pointer-events-none absolute bottom-1 right-1 rounded px-1 py-0.5 text-[7px] font-semibold opacity-0 shadow-sm backdrop-blur-md transition-opacity group-hover:opacity-100"
                      style={{
                        color,
                        backgroundColor:
                          hexToRgba(color, 0.12),
                      }}
                    >
                      Details
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* COURSE DETAILS POPUP */}
{selectedEntry && (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    onMouseDown={closeDetails}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-details-title"
      className="w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl"
      style={{
        borderColor: hexToRgba(
          getCourseColor(selectedEntry),
          0.3
        ),
      }}
      onMouseDown={(event) =>
        event.stopPropagation()
      }
    >
      {/* COURSE COLOR ACCENT */}
      <div
        className="h-1 w-full"
        style={{
          backgroundColor:
            getCourseColor(selectedEntry),
        }}
      />

      <div className="p-5">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    getCourseColor(selectedEntry),
                }}
              />

              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{
                  color:
                    getCourseColor(selectedEntry),
                }}
              >
                {getCourseCode(selectedEntry)}
              </span>
            </div>

            <h3
              id="course-details-title"
              className="mt-2 text-lg font-bold leading-tight"
            >
              {getCourseName(selectedEntry)}
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              {selectedEntry.class_type || "Class"}
            </p>
          </div>

          <button
            type="button"
            onClick={closeDetails}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            ×
          </button>
        </div>

        {/* DETAILS */}
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              Day
            </span>

            <span className="text-xs font-semibold">
              {DAYS[selectedEntry.day_of_week] ??
                "Unknown"}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              Time
            </span>

            <span className="text-xs font-semibold">
              {formatTime(
                selectedEntry.start_time
              )}{" "}
              –{" "}
              {formatTime(
                selectedEntry.end_time
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              Venue
            </span>

            <span className="truncate text-right text-xs font-semibold">
              {selectedEntry.venue ||
                "Not specified"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              Lecturer
            </span>

            <span className="truncate text-right text-xs font-semibold">
              {selectedEntry.lecturer ||
                "Not specified"}
            </span>
          </div>
        </div>

        {/* COURSE COLOR FOOTER */}
        <div className="mt-4 flex items-center justify-between">
          <span
            className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold"
            style={{
              color:
                getCourseColor(selectedEntry),
              backgroundColor:
                hexToRgba(
                  getCourseColor(selectedEntry),
                  0.1
                ),
            }}
          >
            {getCourseCode(selectedEntry)}
          </span>

          <button
            type="button"
            onClick={closeDetails}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </>
  );
}