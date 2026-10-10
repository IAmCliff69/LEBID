import { useEffect, useMemo, useState } from "react";

import type { TimetableEntry } from "@/api/timetable";
import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";
import { updateTimetableEntry } from "@/api/timetable";
import { TimePicker } from "@/components/ui/time-picker";
import LectureDatesPanel from "./LectureDatesPanel";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

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
  const fallback = `color-mix(in srgb, var(--muted-foreground) ${alpha * 100}%, transparent)`;
  if (hex.startsWith("var(")) {
    return `color-mix(in srgb, ${hex} ${alpha * 100}%, transparent)`;
  }

  if (!hex.startsWith("#")) {
    return fallback;
  }

  const cleanHex = hex.replace("#", "");

  if (cleanHex.length !== 6) {
    return fallback;
  }

  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  entries: TimetableEntry[];
  onEntryClick: (entry: TimetableEntry) => void;
  selectedEntryId: number | null;
  onDeleteEntry: (entry: TimetableEntry) => void;
  onEntryUpdated: (entry: TimetableEntry) => void;
  onClearSelection: () => void;
}

export default function WeeklyTimetableGrid({
  entries,
  onEntryClick,
  selectedEntryId,
  onDeleteEntry,
  onEntryUpdated,
  onClearSelection,
}: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState({
    day: "0",
    start_time: "09:00",
    end_time: "10:00",
    class_type: "Lecture",
    venue: "",
    lecturer: "",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? null;

  function handleEntryClick(entry: TimetableEntry) {
    setFormValues({
      day: String(entry.day_of_week),
      start_time: entry.start_time.slice(0, 5),
      end_time: entry.end_time.slice(0, 5),
      class_type: entry.class_type || "Lecture",
      venue: entry.venue || "",
      lecturer: entry.lecturer || "",
    });
    setIsEditing(false);
    setSubmitError(null);
    onEntryClick(entry);
  }

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

    return "var(--primary)";
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

    return { top, height };
  }

  function getEntriesForDay(day: string): TimetableEntry[] {
    return entries.filter((entry) => entry.day_of_week === DAY_INDEX[day]);
  }

  function closeDetails() {
    onClearSelection();
  }

  async function handleSaveEdit() {
    if (!selectedEntry) return;

    setIsSaving(true);
    setSubmitError(null);

    try {
      const updated = await updateTimetableEntry(selectedEntry.id, {
        day_of_week: Number(formValues.day),
        start_time: `${formValues.start_time}:00`,
        end_time: `${formValues.end_time}:00`,
        class_type: formValues.class_type,
        venue: formValues.venue || null,
        lecturer: formValues.lecturer || null,
      });

      onEntryUpdated(updated);
      setIsEditing(false);
    } catch (error: unknown) {
      const detail =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : undefined;

      setSubmitError(detail || "Failed to update entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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

        <div
          className="grid"
          style={{
            gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(5, minmax(0, 1fr))`,
          }}
        >
          <div className="bg-muted/10">
            {TIME_SLOTS.map((time) => (
              <div
                key={time}
                className="flex items-start justify-end pr-2"
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

          {DAYS.map((day) => (
            <div
              key={day}
              className="relative min-w-0 bg-background"
              style={{
                height: ROW_HEIGHT * TIME_SLOTS.length,
              }}
            >
              {getEntriesForDay(day).map((entry) => {
                const { top, height } = getEntryStyle(entry);
                const color = getCourseColor(entry);
                const courseName = getCourseName(entry);
                const courseCode = getCourseCode(entry);
                const blockHeight = Math.max(height - 10, 62);
                const nameLength = courseName.length;
                const courseNameSize =
                  nameLength > 45
                    ? "text-[8px]"
                    : nameLength > 32
                      ? "text-[9px]"
                      : "text-[10px]";
                const isSelected = selectedEntryId === entry.id;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleEntryClick(entry)}
                    className="group absolute left-1 right-1 z-10 min-w-0 overflow-hidden rounded-xl border text-left transition-all duration-200 hover:z-30 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none"
                    style={{
                      top: top + 5,
                      height: blockHeight,

                      backgroundColor: hexToRgba(color, 0.16),

                      borderColor: isSelected ? color : hexToRgba(color, 0.38),

                      borderLeftWidth: "4px",

                      borderLeftColor: color,

                      boxShadow: isSelected
                        ? `0 0 0 2px ${hexToRgba(color, 0.2)}, 0 8px 24px ${hexToRgba(color, 0.2)}`
                        : undefined,
                    }}
                  >
                    <div className="flex h-full min-h-0 flex-col px-1.5 py-2 sm:px-2">
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

                      <p className="mt-0.5 truncate text-[8px] font-semibold text-foreground sm:text-[9px]">
                        {entry.class_type || "Class"}
                      </p>

                      {entry.venue && (
                        <p className="mt-0.5 truncate text-[7px] text-foreground/60 sm:text-[8px]">
                          📍 {entry.venue}
                        </p>
                      )}

                      {entry.lecturer && (
                        <p className="mt-0.5 truncate text-[7px] text-foreground/60 sm:text-[8px]">
                          👤 {entry.lecturer}
                        </p>
                      )}

                      <div className="mt-auto min-w-0 pt-1">
                        <p className="truncate text-[7px] font-medium text-foreground/60 sm:text-[8px]">
                          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="pointer-events-none absolute bottom-1 right-1 rounded px-1 py-0.5 text-[7px] font-semibold opacity-0 shadow-sm backdrop-blur-md transition-opacity group-hover:opacity-100"
                      style={{
                        color,
                        backgroundColor: hexToRgba(color, 0.12),
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

      {selectedEntry && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onMouseDown={closeDetails}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-details-title"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card shadow-2xl"
            style={{
              borderColor: hexToRgba(getCourseColor(selectedEntry), 0.3),
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div
              className="h-1 w-full"
              style={{
                backgroundColor: getCourseColor(selectedEntry),
              }}
            />

            <div className="p-5">
              {!isEditing ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: getCourseColor(selectedEntry),
                          }}
                        />

                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            color: getCourseColor(selectedEntry),
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

                  <div className="mt-5 space-y-2.5">
                    <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
                      <span className="text-xs text-muted-foreground">Day</span>

                      <span className="text-xs font-semibold">
                        {DAYS[selectedEntry.day_of_week] ?? "Unknown"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
                      <span className="text-xs text-muted-foreground">Time</span>

                      <span className="text-xs font-semibold">
                        {formatTime(selectedEntry.start_time)} – {formatTime(selectedEntry.end_time)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2.5">
                      <span className="text-xs text-muted-foreground">Venue</span>

                      <span className="truncate text-right text-xs font-semibold">
                        {selectedEntry.venue || "Not specified"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2.5">
                      <span className="text-xs text-muted-foreground">Lecturer</span>

                      <span className="truncate text-right text-xs font-semibold">
                        {selectedEntry.lecturer || "Not specified"}
                      </span>
                    </div>
                  </div>
                  
                  <LectureDatesPanel entry={selectedEntry} />

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span
                      className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold"
                      style={{
                        color: getCourseColor(selectedEntry),
                        backgroundColor: hexToRgba(getCourseColor(selectedEntry), 0.1),
                      }}
                    >
                      {getCourseCode(selectedEntry)}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteEntry(selectedEntry)}
                        className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
                      >
                        Delete
                      </button>

                      <button
                        type="button"
                        onClick={closeDetails}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl font-bold text-foreground">Edit class</h3>

                    <button
                      type="button"
                      onClick={closeDetails}
                      aria-label="Close"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Day</label>
                      <select
                        value={formValues.day}
                        onChange={(event) =>
                          setFormValues((prev) => ({ ...prev, day: event.target.value }))
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-0 transition focus:border-primary"
                      >
                        {DAYS.map((day, index) => (
                          <option key={day} value={index}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Start time</label>
                        <TimePicker
                          value={formValues.start_time}
                          onChange={(value) =>
                            setFormValues((prev) => ({
                              ...prev,
                              start_time: value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">End time</label>
                        <TimePicker
                          value={formValues.end_time}
                          onChange={(value) =>
                            setFormValues((prev) => ({
                              ...prev,
                              end_time: value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Class type</label>
                      <select
                        value={formValues.class_type}
                        onChange={(event) =>
                          setFormValues((prev) => ({
                            ...prev,
                            class_type: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
                      >
                        <option value="Lecture">Lecture</option>
                        <option value="Tutorial">Tutorial</option>
                        <option value="Lab">Lab</option>
                        <option value="Practical">Practical</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Venue</label>
                      <input
                        value={formValues.venue}
                        onChange={(event) =>
                          setFormValues((prev) => ({
                            ...prev,
                            venue: event.target.value,
                          }))
                        }
                        placeholder="e.g. Room 204"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Lecturer</label>
                      <input
                        value={formValues.lecturer}
                        onChange={(event) =>
                          setFormValues((prev) => ({
                            ...prev,
                            lecturer: event.target.value,
                          }))
                        }
                        placeholder="e.g. Dr. Mensah"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary"
                      />
                    </div>

                    {submitError && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                        {submitError}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
