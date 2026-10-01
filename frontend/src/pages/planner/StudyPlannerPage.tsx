import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  
} from "react";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  X,
  BookOpen,
  GraduationCap,
  UserRound,
  Pencil,
  Trash2,
  CalendarClock,
} from "lucide-react";

import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";

import {
  getStudySessions,
  getTodayStudySessions,
  getWeekStudySessions,
  getMissedStudySessions,
  deleteStudySession,
} from "@/api/studySessions";
import type { StudySession } from "@/api/studySessions";
import AddStudySessionDialog from "@/components/study-sessions/AddStudySessionDialog";
import EditStudySessionDialog from "@/components/study-sessions/EditStudySessionDialog";
import RescheduleStudySessionDialog from "@/components/study-sessions/RescheduleStudySessionDialog";

import { getEvents } from "@/api/events";
import type { PlannerEvent } from "@/api/events";

import { getTimetable } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIME_SLOTS = Array.from(
  { length: 14 },
  (_, index) => index + 7
);

const ROW_HEIGHT = 56;
const TIME_COLUMN_WIDTH = 56;
const PRIMARY_COLOR = "var(--primary)";
const EVENT_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

type CalendarView = "month" | "week" | "day";
type PopupPosition = { top: number; left: number; width: number };

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateToKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonday(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);
  result.setHours(0, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDayNumber(date: Date): string {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
  });
}

function hexToRgba(
  hex: string | undefined | null,
  alpha: number
): string {
  const fallback = `color-mix(in srgb, var(--muted-foreground) ${alpha * 100}%, transparent)`;
  if (!hex) {
    return fallback;
  }

  if (hex.startsWith("var(")) {
    return `color-mix(in srgb, ${hex} ${alpha * 100}%, transparent)`;
  }

  const cleanHex = hex.replace("#", "");

  if (cleanHex.length !== 6) {
    return fallback;
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getPriorityLabel(
  priority: StudySession["priority"]
): string {
  return (
    priority.charAt(0).toUpperCase() +
    priority.slice(1)
  );
}

function getStatusLabel(
  status: StudySession["status"]
): string {
  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function getFlexibilityLabel(
  flexibility: PlannerEvent["flexibility"]
): string {
  return (
    flexibility.charAt(0).toUpperCase() +
    flexibility.slice(1)
  );
}

function getEventColor(id: string | number): string {
  const hash = String(id).split("").reduce(
    (value, character) => value + character.charCodeAt(0),
    0
  );

  return EVENT_PALETTE[hash % EVENT_PALETTE.length];
}

export default function StudyPlannerPage() {
  const [currentWeek, setCurrentWeek] = useState(
    getMonday(new Date())
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("week");

  const [courses, setCourses] = useState<Course[]>([]);
  const [studySessions, setStudySessions] = useState<
    StudySession[]
  >([]);
  const [weeklySummarySessions, setWeeklySummarySessions] = useState<
    StudySession[]
  >([]);
  const [todaySessions, setTodaySessions] = useState<StudySession[]>([]);
  const [weekSessions, setWeekSessions] = useState<StudySession[]>([]);
  const [missedSessions, setMissedSessions] = useState<StudySession[]>([]);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [timetableEntries, setTimetableEntries] =
    useState<TimetableEntry[]>([]);

  const [selectedLecture, setSelectedLecture] =
    useState<TimetableEntry | null>(null);

  const [selectedStudySession, setSelectedStudySession] =
    useState<StudySession | null>(null);

  const [selectedEvent, setSelectedEvent] =
    useState<PlannerEvent | null>(null);

  const [popupPosition, setPopupPosition] = useState<PopupPosition>({
    top: 24,
    left: 24,
    width: 280,
  });

  const popupRef = useRef<HTMLDivElement | null>(null);
  const popupDragRef = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    left: number;
    top: number;
  } | null>(null);

  const [showLectures, setShowLectures] = useState(true);
  const [showStudySessions, setShowStudySessions] =
    useState(true);
  const [showPersonalEvents, setShowPersonalEvents] =
    useState(true);

  // The study session currently open in the Edit dialog (null = closed)
  const [editingSession, setEditingSession] =
    useState<StudySession | null>(null);

  const [reschedulingSession, setReschedulingSession] =
    useState<StudySession | null>(null);  

  // Controls the inline delete-confirmation step inside the popup
const [confirmingDelete, setConfirmingDelete] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
const [deleteError, setDeleteError] = useState<string | null>(null);  

  // Bumped after a session is created so the planner reloads its data
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const calendarRange = useMemo(() => {
    if (calendarView === "month") {
      const monthStart = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        1
      );
      const mondayOffset = (monthStart.getDay() + 6) % 7;
      const gridStart = addDays(monthStart, -mondayOffset);

      return {
        start: gridStart,
        end: addDays(gridStart, 41),
      };
    }

    if (calendarView === "day") {
      return { start: selectedDate, end: selectedDate };
    }

    return { start: currentWeek, end: addDays(currentWeek, 6) };
  }, [calendarView, currentWeek, selectedDate]);

  useEffect(() => {
    const loadPlannerData = async () => {
      try {
        // Only the first load shows the full-page spinner, so the
        // planner (and open dialogs) do not flash away on refresh.
        setError("");

      const [
        courseData,
        sessionData,
        weeklySessionData,
        eventData,
        timetableData,
        todayData,
        weekData,
        missedData,
      ] = await Promise.all([
        getCourses(),
        getStudySessions({
          date_from: dateToKey(calendarRange.start),
          date_to: dateToKey(calendarRange.end),
        }),
        getStudySessions({
          date_from: dateToKey(currentWeek),
          date_to: dateToKey(addDays(currentWeek, 6)),
        }),
        getEvents({ upcoming_only: false }),
        getTimetable(),
        getTodayStudySessions(),
        getWeekStudySessions(),
        getMissedStudySessions(),
      ]);

      setCourses(courseData);
      setStudySessions(sessionData);
      setWeeklySummarySessions(weeklySessionData);
      setEvents(eventData);
      setTimetableEntries(timetableData);
      setTodaySessions(todayData);
      setWeekSessions(weekData);
      setMissedSessions(missedData);
      } catch (err) {
        console.error("Failed to load planner:", err);

        setError(
          "Something went wrong while loading your planner."
        );
      } finally {
        setLoading(false);
      }
    };

    loadPlannerData();
  }, [calendarRange, currentWeek, refreshKey]);

  const weekDays = useMemo(() => {
    return DAYS.map((dayName, index) => {
      const date = addDays(currentWeek, index);

      return {
        name: dayName,
        date,
        key: dateToKey(date),
        dayNumber: index,
      };
    });
  }, [currentWeek]);

  const calendarDays = useMemo(() => {
    if (calendarView !== "day") {
      return weekDays;
    }

    return [{
      name: selectedDate.toLocaleDateString("en-US", { weekday: "long" }),
      date: selectedDate,
      key: dateToKey(selectedDate),
      dayNumber: (selectedDate.getDay() + 6) % 7,
    }];
  }, [calendarView, selectedDate, weekDays]);

  const miniCalendarDays = useMemo(() => {
    const monthStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1
    );
    const mondayOffset = (monthStart.getDay() + 6) % 7;
    const gridStart = addDays(monthStart, -mondayOffset);

    return Array.from({ length: 42 }, (_, index) =>
      addDays(gridStart, index)
    );
  }, [selectedDate]);

  const getCourse = (
    courseId: string | number
  ) => {
    return courses.find(
      (course) =>
        String(course.id) === String(courseId)
    );
  };

  const getPosition = (
    startTime: string,
    endTime: string
  ) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const calendarStartMinutes = 7 * 60;

    const top =
      ((startMinutes - calendarStartMinutes) / 60) *
      ROW_HEIGHT;

    const height =
      ((endMinutes - startMinutes) / 60) *
      ROW_HEIGHT;

    return {
      top,
      height: Math.max(height, 40),
    };
  };

  /*
   * ============================================================
   * POPUP CONTROLS
   * ============================================================
   */

  const closePopup = () => {
  setSelectedLecture(null);
  setSelectedStudySession(null);
  setSelectedEvent(null);
  setConfirmingDelete(false);   // ← add
  setDeleteError(null);          // ← add
};

  const openPopup = (
    event: ReactMouseEvent<HTMLElement>,
    type: "lecture" | "study" | "event",
    item:
      | TimetableEntry
      | StudySession
      | PlannerEvent
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(
      Math.max(rect.width + 80, 260),
      320,
      window.innerWidth - 24
    );
    const estimatedHeight = 280;
    const left = Math.min(
      Math.max(rect.left + (rect.width - width) / 2, 12),
      window.innerWidth - width - 12
    );
    const top = Math.min(
      Math.max(rect.top + (rect.height - estimatedHeight) / 2, 12),
      window.innerHeight - estimatedHeight - 12
    );

    setPopupPosition({ top, left, width });

    if (type === "lecture") {
      setSelectedLecture(item as TimetableEntry);
      setSelectedStudySession(null);
      setSelectedEvent(null);
    }

    if (type === "study") {
      setSelectedLecture(null);
      setSelectedStudySession(item as StudySession);
      setSelectedEvent(null);
    }

    if (type === "event") {
      setSelectedLecture(null);
      setSelectedStudySession(null);
      setSelectedEvent(item as PlannerEvent);
    }
  };

  const startPopupDrag = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if ((event.target as HTMLElement).closest("button")) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    popupDragRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: popupPosition.left,
      top: popupPosition.top,
    };
  };

  const movePopup = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const drag = popupDragRef.current;
    const popup = popupRef.current;
    if (!drag || !popup || drag.pointerId !== event.pointerId) return;

    const { width, height } = popup.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(8, window.innerHeight - height - 8);

    setPopupPosition((current) => ({
      ...current,
      left: Math.max(
        8,
        Math.min(maxLeft, drag.left + event.clientX - drag.pointerX)
      ),
      top: Math.max(
        8,
        Math.min(maxTop, drag.top + event.clientY - drag.pointerY)
      ),
    }));
  };

  const stopPopupDrag = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (popupDragRef.current?.pointerId === event.pointerId) {
      popupDragRef.current = null;
    }
  };

  /*
   * ============================================================
   * OUTSIDE CLICK + ESCAPE
   * ============================================================
   */

  useEffect(() => {
    const handlePointerDown = (
      event: PointerEvent
    ) => {
      if (!popupRef.current) {
        return;
      }

      if (
        event.target instanceof Node &&
        popupRef.current.contains(event.target)
      ) {
        return;
      }

      closePopup();
    };

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        closePopup();
      }
    };

    const popupIsOpen =
      selectedLecture ||
      selectedStudySession ||
      selectedEvent;

    if (!popupIsOpen) {
      return;
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [
    selectedLecture,
    selectedStudySession,
    selectedEvent,
  ]);

  const handleDeleteSession = async () => {
  if (!selectedStudySession) return;
  setIsDeleting(true);
  setDeleteError(null);
  try {
    await deleteStudySession(selectedStudySession.id);
    closePopup();
    setRefreshKey((k) => k + 1);
  } catch {
    setDeleteError("Failed to delete session. Please try again.");
  } finally {
    setIsDeleting(false);
  }
};

  const navigateCalendar = (direction: -1 | 1) => {
    closePopup();

    let nextDate: Date;

    if (calendarView === "month") {
      nextDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth() + direction,
        1
      );
    } else if (calendarView === "day") {
      nextDate = addDays(selectedDate, direction);
    } else {
      nextDate = addDays(currentWeek, direction * 7);
    }

    setSelectedDate(nextDate);
    setCurrentWeek(
      calendarView === "week" ? nextDate : getMonday(nextDate)
    );
  };

  const previousWeek = () => navigateCalendar(-1);

  const nextWeek = () => {
    navigateCalendar(1);
  };

  const goToToday = () => {
    closePopup();
    const today = new Date();
    setSelectedDate(today);
    setCurrentWeek(getMonday(today));
  };

  const getEventsForDay = (dateKey: string) => {
    return events.filter(
      (event) => event.event_date === dateKey
    );
  };

  const getSessionsForDay = (dateKey: string) => {
    return studySessions.filter(
      (session) => session.session_date === dateKey
    );
  };

  /*
   * Timetable day convention:
   *
   * 0 = Monday
   * 1 = Tuesday
   * 2 = Wednesday
   * 3 = Thursday
   * 4 = Friday
   * 5 = Saturday
   * 6 = Sunday
   */
  const getLecturesForDay = (
    dayNumber: number
  ) => {
    return timetableEntries.filter(
      (entry) =>
        entry.day_of_week === dayNumber
    );
  };

  const todayKey = dateToKey(new Date());
  const selectedDateKey = dateToKey(selectedDate);

  const weeklyEvents = events.filter(
    (event) =>
      event.event_date >= dateToKey(currentWeek) &&
      event.event_date <= dateToKey(addDays(currentWeek, 6))
  );

  const weeklyLectureCount =
    timetableEntries.filter((entry) =>
      weekDays.some(
        (day) =>
          day.dayNumber === entry.day_of_week
      )
    ).length;

  const totalWeeklyItems =
    weeklySummarySessions.length +
    weeklyEvents.length +
    weeklyLectureCount;

  if (loading) {
    return (
      <div className="flex min-h-150 items-center justify-center">
        <div className="flex flex-col items-center">
          <div
            className="mb-3 h-7 w-7 animate-spin rounded-full border-2 border-border"
            style={{
              borderTopColor: PRIMARY_COLOR,
            }}
          />

          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            Loading your planner...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-5 min-h-full space-y-6 bg-background p-5 pb-8 sm:-m-6 sm:p-6 sm:pb-8 lg:-m-8 lg:p-8 lg:pb-8">
      {/* =====================================================
          PLANNER HEADER
      ====================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
                color: PRIMARY_COLOR,
              }}
            >
              <CalendarDays className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Study Planner
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Plan, view and manage everything happening
                in your academic week.
              </p>
            </div>
          </div>
        </div>

        <AddStudySessionDialog
          courses={courses}
          defaultDate={dateToKey(selectedDate)}
          onSessionAdded={() => setRefreshKey((k) => k + 1)}
        />
      </div>

      {/* ERROR */}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* =====================================================
          PLANNER WORKSPACE
      ====================================================== */}

      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        {/* =================================================
            LEFT PLANNER PANEL
        ================================================== */}

        <aside className="space-y-5">
          {/* MINI CALENDAR */}

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {formatMonthYear(currentWeek)}
                </h2>

                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Week overview
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={previousWeek}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={nextWeek}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {["M", "T", "W", "T", "F", "S", "S"].map(
                (day, index) => (
                  <div
                    key={`${day}-${index}`}
                    className="pb-2 text-center text-[10px] font-semibold uppercase text-muted-foreground"
                  >
                    {day}
                  </div>
                )
              )}

              {miniCalendarDays.map((date) => {
                const dayKey = dateToKey(date);
                const isToday = dayKey === todayKey;
                const isCurrentMonth =
                  date.getMonth() === currentWeek.getMonth();
                const isSelectedWeek =
                  date >= currentWeek &&
                  date < addDays(currentWeek, 7);

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => {
                      closePopup();
                      setSelectedDate(date);
                      setCurrentWeek(getMonday(date));
                    }}
                    aria-label={formatDate(date)}
                    className={`flex aspect-square items-center justify-center rounded-lg text-[11px] font-medium transition ${
                      isToday
                        ? "text-primary-foreground shadow-sm"
                        : isCurrentMonth
                          ? "text-secondary-foreground hover:bg-muted"
                          : "text-muted-foreground hover:bg-muted"
                    }`}
                    style={
                      isToday
                        ? {
                            backgroundColor: PRIMARY_COLOR,
                          }
                        : isSelectedWeek
                          ? { backgroundColor: "var(--secondary)" }
                          : undefined
                    }
                  >
                    {formatDayNumber(date)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* WEEK SUMMARY */}

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                This Week
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                {formatShortDate(currentWeek)} –{" "}
                {formatShortDate(addDays(currentWeek, 6))}
              </p>
            </div>

            <div className="space-y-2">
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: "var(--secondary)" }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ color: PRIMARY_COLOR }}
                >
                  {totalWeeklyItems}
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  scheduled items
                </p>
              </div>

              {/* Weekly study session count — now from the dedicated endpoint */}
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-semibold text-secondary-foreground">
                  Study sessions
                </p>

                <p className="mt-1 text-[11px] text-muted-foreground">
                  {weekSessions.length === 0
                    ? "No study sessions this week."
                    : `${weekSessions.length} session${weekSessions.length === 1 ? "" : "s"} planned this week.`}
                </p>

                {weekSessions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {weekSessions.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-[10px]"
                      >
                        <span className="truncate font-medium text-secondary-foreground">
                          {getCourse(s.course_id)?.code ?? "Study"}
                        </span>

                        <span className="shrink-0 text-muted-foreground">
                          {new Date(
                            `${s.session_date}T00:00:00`
                          ).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    ))}

                    {weekSessions.length > 3 && (
                      <p className="pt-0.5 text-center text-[10px] text-muted-foreground">
                        +{weekSessions.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* TODAY'S STUDY SESSIONS */}

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Today
                </h2>

                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Study sessions scheduled for today
                </p>
              </div>

              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>

            {todaySessions.length === 0 ? (
              <p className="rounded-lg bg-muted px-3 py-3 text-[11px] text-muted-foreground">
                No study sessions planned for today.
              </p>
            ) : (
              <div className="space-y-2">
                {todaySessions.map((s) => {
                  const course = getCourse(s.course_id);

                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-border bg-background px-3 py-2.5"
                    >
                      <p className="truncate text-xs font-semibold text-foreground">
                        {course?.name ?? s.topic ?? "Study Session"}
                      </p>

                      {s.topic && s.topic !== course?.name && (
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {s.topic}
                        </p>
                      )}

                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </span>

                        {s.venue && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {s.venue}
                          </span>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="mt-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                            s.status === "completed"
                              ? "bg-success/10 text-success"
                              : s.status === "in_progress"
                                ? "bg-primary/10 text-primary"
                                : s.status === "skipped"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {getStatusLabel(s.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* MISSED STUDY SESSIONS */}

          {missedSessions.length > 0 && (
            <section className="rounded-2xl border border-destructive/20 bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Missed Sessions
                  </h2>

                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Past sessions not yet completed
                  </p>
                </div>

                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {missedSessions.length}
                </span>
              </div>

              <div className="space-y-2">
                {missedSessions.slice(0, 4).map((s) => {
                  const course = getCourse(s.course_id);

                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5"
                    >
                      <p className="truncate text-xs font-semibold text-foreground">
                        {course?.name ?? s.topic ?? "Study Session"}
                      </p>

                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(
                          `${s.session_date}T00:00:00`
                        ).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {" · "}
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </p>

                      {s.venue && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {s.venue}
                        </p>
                      )}
                    </div>
                  );
                })}

                {missedSessions.length > 4 && (
                  <p className="text-center text-[10px] text-muted-foreground">
                    +{missedSessions.length - 4} more missed sessions
                  </p>
                )}

                <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Click a session on the calendar to reschedule or mark it as skipped.
                </p>
              </div>
            </section>
          )}

          {/* OTHER CALENDARS */}

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Other Calendars
              </h2>

              <p className="mt-1 text-[11px] text-muted-foreground">
                Choose what appears on your calendar.
              </p>
            </div>

            <div className="space-y-3">
              {/* PERSONAL EVENTS */}

              <button
                type="button"
                onClick={() =>
                  setShowPersonalEvents((previous) => !previous)
                }
                className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-muted"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    showPersonalEvents
                      ? "border-primary"
                      : "border-border"
                  }`}
                  style={
                    showPersonalEvents
                      ? { backgroundColor: PRIMARY_COLOR }
                      : undefined
                  }
                >
                  {showPersonalEvents && (
                    <span className="h-1.5 w-1.5 rounded-full bg-card" />
                  )}
                </span>

                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PRIMARY_COLOR }}
                />

                <span className="text-xs text-secondary-foreground">
                  Personal Events
                </span>
              </button>

              {/* LECTURES */}

              <button
                type="button"
                onClick={() =>
                  setShowLectures((previous) => !previous)
                }
                className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-muted"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    showLectures ? "border-primary" : "border-border"
                  }`}
                  style={
                    showLectures
                      ? { backgroundColor: PRIMARY_COLOR }
                      : undefined
                  }
                >
                  {showLectures && (
                    <span className="h-1.5 w-1.5 rounded-full bg-card" />
                  )}
                </span>

                <span className="h-2.5 w-2.5 rounded-full bg-primary" />

                <span className="text-xs text-secondary-foreground">Lectures</span>
              </button>

              {/* STUDY SESSIONS */}

              <button
                type="button"
                onClick={() =>
                  setShowStudySessions((previous) => !previous)
                }
                className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-muted"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    showStudySessions
                      ? "border-ring"
                      : "border-border"
                  }`}
                  style={
                    showStudySessions
                      ? { backgroundColor: "var(--primary)" }
                      : undefined
                  }
                >
                  {showStudySessions && (
                    <span className="h-1.5 w-1.5 rounded-full bg-card" />
                  )}
                </span>

                <span className="h-2.5 w-2.5 rounded-full bg-primary" />

                <span className="text-xs text-secondary-foreground">
                  Study Sessions
                </span>
              </button>
            </div>
          </section>
        </aside>

        {/* =================================================
            MAIN CALENDAR
        ================================================== */}

        <section className="min-w-0">
          {/* CALENDAR TOOLBAR */}

          <div
            className="overflow-hidden rounded-2xl border border-border shadow-sm"
            style={{
              background:
                "linear-gradient(115deg, var(--secondary) 0%, var(--background) 55%, var(--accent) 100%)",
            }}
          >
            <div className="px-4 py-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {calendarView === "day"
                        ? formatDate(selectedDate)
                        : formatMonthYear(
                            calendarView === "month" ? selectedDate : currentWeek
                          )}
                    </h2>

                    <button
                      type="button"
                      onClick={goToToday}
                      className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-primary transition hover:bg-secondary"
                    >
                      Today
                    </button>

                    <button
                      type="button"
                      onClick={previousWeek}
                      className="rounded-full p-1 text-muted-foreground transition hover:bg-muted"
                      aria-label="Previous week"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={nextWeek}
                      className="rounded-full p-1 text-muted-foreground transition hover:bg-muted"
                      aria-label="Next week"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    role="group"
                    aria-label="Calendar view"
                    className="flex items-center rounded-full border border-border bg-muted p-1"
                  >
                    <button
                      type="button"
                      aria-pressed={calendarView === "month"}
                      onClick={() => setCalendarView("month")}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${calendarView === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Month
                    </button>

                    <button
                      type="button"
                      aria-pressed={calendarView === "week"}
                      onClick={() => setCalendarView("week")}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${calendarView === "week" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Week
                    </button>

                    <button
                      type="button"
                      aria-pressed={calendarView === "day"}
                      onClick={() => setCalendarView("day")}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${calendarView === "day" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Day
                    </button>
                  </div>
                </div>
              </div>
            </div>

          {/* =================================================
              REFINED WEEKLY CALENDAR
          ================================================== */}

          {/* =================================================
                    DAY HEADERS
                ================================================== */}

                <div
                  className="grid gap-x-1 bg-transparent px-2 pb-3 pt-2"
                  style={{
                    gridTemplateColumns:
                      calendarView === "month"
                        ? "repeat(7, minmax(0, 1fr))"
                        : `${TIME_COLUMN_WIDTH}px repeat(${calendarDays.length}, minmax(0, 1fr))`,
                  }}
                >
                  {/* TIME HEADER */}

                  {calendarView !== "month" && (
                    <div className="flex items-end justify-center px-1 py-3">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        GMT
                      </span>
                    </div>
                  )}

                  {/* DAY HEADERS */}

                  {calendarView === "month" ? (
                    DAYS.map((day) => (
                      <div
                        key={day}
                        className="py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground"
                      >
                        {day.slice(0, 3)}
                      </div>
                    ))
                  ) : calendarDays.map((day) => {
                    const isSelected =
                      day.key ===
                      (calendarView === "day"
                        ? selectedDateKey
                        : todayKey);

                    return (
                      <div
                        key={day.key}
                        className={`flex min-h-20 items-center justify-center gap-2 rounded-xl px-2 py-2.5 transition ${
                          isSelected
                            ? "bg-secondary text-primary shadow-sm"
                            : "bg-card/65 text-secondary-foreground"
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            isSelected ? "text-secondary-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {day.name.slice(0, 3)}
                        </span>
                        <span className="text-2xl font-bold tabular-nums">
                          {formatDayNumber(day.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {calendarView === "month" ? (
                <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm">
                  {miniCalendarDays.map((date) => {
                    const dateKey = dateToKey(date);
                    const dayNumber = (date.getDay() + 6) % 7;
                    const isCurrentMonth =
                      date.getMonth() === selectedDate.getMonth();
                    const isToday = dateKey === todayKey;
                    const isSelected = dateKey === selectedDateKey;
                    const daySessions = getSessionsForDay(dateKey);
                    const dayEvents = getEventsForDay(dateKey);
                    const dayLectures = getLecturesForDay(dayNumber);

                    return (
                      <div
                        key={dateKey}
                        className={`min-h-24 bg-card p-1.5 sm:min-h-28 sm:p-2 ${
                          isCurrentMonth ? "" : "opacity-45"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(date);
                            setCurrentWeek(getMonday(date));
                          }}
                          aria-pressed={isSelected}
                          className={`mb-1 flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                            isToday
                              ? "bg-secondary text-secondary-foreground ring-1 ring-ring"
                              : isSelected
                                ? "text-primary ring-1 ring-primary/25"
                                : "text-secondary-foreground hover:bg-muted"
                          }`}
                        >
                          {date.getDate()}
                        </button>

                        <div className="space-y-1">
                          {showLectures && dayLectures.slice(0, 2).map((lecture) => (
                            <button
                              key={`month-lecture-${dateKey}-${lecture.id}`}
                              type="button"
                              onClick={(event) => openPopup(event, "lecture", lecture)}
                              title={lecture.course_name}
                              className="block w-full truncate rounded px-1 py-0.5 text-left text-[8px] font-semibold text-primary sm:text-[9px]"
                              style={{ backgroundColor: hexToRgba(lecture.course_color, 0.16) }}
                            >
                              {lecture.course_code || lecture.course_name}
                            </button>
                          ))}
                          {showStudySessions && daySessions.slice(0, 2).map((session) => (
                            <button
                              key={`month-session-${session.id}`}
                              type="button"
                              onClick={(event) => openPopup(event, "study", session)}
                              title={getCourse(session.course_id)?.name || session.topic || "Study Session"}
                              className="block w-full truncate rounded bg-secondary px-1 py-0.5 text-left text-[8px] font-semibold text-secondary-foreground sm:text-[9px]"
                            >
                              {getCourse(session.course_id)?.name || session.topic || "Study"}
                            </button>
                          ))}
                          {showPersonalEvents && dayEvents.slice(0, 1).map((item) => (
                            <button
                              key={`month-event-${item.id}`}
                              type="button"
                              onClick={(event) => openPopup(event, "event", item)}
                              title={item.title}
                              className="block w-full truncate rounded bg-warning/10 px-1 py-0.5 text-left text-[8px] font-semibold text-warning sm:text-[9px]"
                            >
                              {item.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {/* =================================================
                    CALENDAR BODY
                ================================================== */}

                <div
                  className="relative grid gap-x-1 px-2"
                  style={{
                    gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${calendarDays.length}, minmax(0, 1fr))`,
                    minHeight:
                      TIME_SLOTS.length *
                      ROW_HEIGHT,
                  }}
                >
                  {/* =================================================
                      TIME COLUMN
                  ================================================== */}

                  <div className="relative bg-card">
                    {TIME_SLOTS.map((hour) => (
                      <div
                        key={hour}
                        className="relative px-1 pt-2 text-right"
                        style={{
                          height: ROW_HEIGHT,
                        }}
                      >
                        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {formatTime(
                            `${String(hour).padStart(
                              2,
                              "0"
                            )}:00`
                          )}
                        </span>

                      </div>
                    ))}
                  </div>

                  {/* =================================================
                      DAY COLUMNS
                  ================================================== */}

                  {calendarDays.map((day) => {
                    const daySessions =
                      getSessionsForDay(day.key);

                    const dayEvents =
                      getEventsForDay(day.key);

                    const dayLectures =
                      getLecturesForDay(
                        day.dayNumber
                      );

                    const isToday =
                      day.key === todayKey;

                    return (
                      <div
                        key={day.key}
                        className={`relative ${
                          isToday
                            ? "bg-accent/10"
                            : "bg-card"
                        }`}
                        style={{
                          height:
                            TIME_SLOTS.length *
                            ROW_HEIGHT,
                        }}
                      >
                        {/* =================================================
                            TODAY COLUMN ACCENT
                        ================================================== */}

                        {isToday && (
                          <div
                            className="pointer-events-none absolute inset-y-0 left-0 w-px opacity-30"
                            style={{
                              backgroundColor:
                                PRIMARY_COLOR,
                            }}
                          />
                        )}

                        {/* =================================================
                            CURRENT TIME LINE
                        ================================================== */}

                        {isToday &&
                          (() => {
                            const now = new Date();
                            const minutes =
                              now.getHours() * 60 +
                              now.getMinutes();

                            const calendarStart =
                              7 * 60;

                            const calendarEnd =
                              21 * 60;

                            if (
                              minutes < calendarStart ||
                              minutes > calendarEnd
                            ) {
                              return null;
                            }

                            const top =
                              ((minutes -
                                calendarStart) /
                                60) *
                              ROW_HEIGHT;

                            return (
                              <div
                                className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                                style={{
                                  top,
                                }}
                              >
                                <div
                                  className="absolute -left-1 h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor:
                                      PRIMARY_COLOR,
                                  }}
                                />

                                <div
                                  className="h-px flex-1 opacity-45"
                                  style={{
                                    backgroundColor:
                                      PRIMARY_COLOR,
                                  }}
                                />
                              </div>
                            );
                          })()}

                        {/* =================================================
                            LECTURES
                        ================================================== */}

                        {showLectures &&
                          dayLectures.map(
                            (lecture) => {
                              const {
                                top,
                                height,
                              } = getPosition(
                                lecture.start_time,
                                lecture.end_time
                              );

                              const lectureColor =
                                lecture.course_color ||
                                "var(--primary)";

                              const isSelected =
                                selectedLecture?.id ===
                                lecture.id;

                              return (
                                <button
                                  key={`lecture-${lecture.id}`}
                                  type="button"
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  onClick={(event) =>
                                    openPopup(
                                      event,
                                      "lecture",
                                      lecture
                                    )
                                  }
                                  className={`group absolute left-1.5 right-1.5 z-20 overflow-hidden rounded-xl border text-left transition-all duration-200 ${
                                    isSelected
                                      ? "z-50 ring-2 ring-primary/40 ring-offset-1 shadow-lg"
                                      : "shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                                  }`}
                                  style={{
                                    top: top + 2,
                                    height:
                                      Math.max(
                                        height - 4,
                                        40
                                      ),
                                    backgroundColor:
                                      hexToRgba(
                                        lectureColor,
                                        0.18
                                      ),
                                    borderColor:
                                      hexToRgba(
                                        lectureColor,
                                        0.32
                                      ),
                                  }}
                                >
                                  <div
                                    className="h-full border-l-[3px] px-2.5 py-2"
                                    style={{
                                      borderLeftColor:
                                        lectureColor,
                                    }}
                                  >
                                    {/* COURSE CODE */}

                                    <div
                                      className="truncate text-[9px] font-extrabold uppercase tracking-[0.12em]"
                                      style={{
                                        color:
                                          lectureColor,
                                      }}
                                    >
                                      {
                                        lecture.course_code
                                      }
                                    </div>

                                    {/* COURSE NAME */}

                                      <div
                                        className="mt-1 line-clamp-2 text-[9px] font-bold leading-tight text-foreground"
                                        title={lecture.course_name}
                                      >
                                      {
                                        lecture.course_name
                                      }
                                    </div>

                                    {/* TIME */}

                                    <div className="mt-1.5 flex items-center gap-1 text-[9px] font-medium tabular-nums text-muted-foreground">
                                      <Clock className="h-2.5 w-2.5 shrink-0" />

                                      <span className="truncate">
                                        {formatTime(
                                          lecture.start_time
                                        )}{" "}
                                        –{" "}
                                        {formatTime(
                                          lecture.end_time
                                        )}
                                      </span>
                                    </div>

                                    {/* VENUE */}

                                    {lecture.venue && (
                                      <div className="mt-1 flex items-center gap-1 truncate text-[9px] text-muted-foreground">
                                        <MapPin className="h-2.5 w-2.5 shrink-0" />

                                        <span className="truncate">
                                          {
                                            lecture.venue
                                          }
                                        </span>
                                      </div>
                                    )}

                                    {/* CLASS TYPE */}

                                    {height >= 105 && (
                                      <div className="mt-1.5">
                                        <span
                                          className="inline-flex rounded-md px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide"
                                          style={{
                                            backgroundColor:
                                              hexToRgba(
                                                lectureColor,
                                                0.1
                                              ),
                                            color:
                                              lectureColor,
                                          }}
                                        >
                                          {
                                            lecture.class_type
                                          }
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            }
                          )}

                        {/* =================================================
                            STUDY SESSIONS
                        ================================================== */}

                        {showStudySessions &&
                          daySessions.map(
                            (session) => {
                              const {
                                top,
                                height,
                              } = getPosition(
                                session.start_time,
                                session.end_time
                              );

                              const course =
                                getCourse(
                                  session.course_id
                                );

                              const courseColor =
                                course?.color ||
                                PRIMARY_COLOR;

                              const isSelected =
                                selectedStudySession?.id ===
                                session.id;

                              return (
                                <button
                                  key={`session-${session.id}`}
                                  type="button"
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  onClick={(event) =>
                                    openPopup(
                                      event,
                                      "study",
                                      session
                                    )
                                  }
                                  className={`group absolute left-1.5 right-1.5 z-30 overflow-hidden rounded-xl border border-dashed text-left transition-all duration-200 ${
                                    isSelected
                                      ? "z-50 ring-2 ring-primary/40 ring-offset-1 shadow-lg"
                                      : "shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                                  }`}
                                  style={{
                                    top: top + 2,
                                    height:
                                      Math.max(
                                        height - 4,
                                        40
                                      ),
                                    backgroundColor:
                                      hexToRgba(
                                        courseColor,
                                        0.15
                                      ),
                                    borderColor:
                                      hexToRgba(
                                        courseColor,
                                        0.48
                                      ),
                                  }}
                                >
                                  <div
                                    className="h-full border-l-2 border-dashed px-2.5 py-2"
                                    style={{
                                      borderLeftColor:
                                        courseColor,
                                    }}
                                  >
                                    {/* LABEL */}

                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className="truncate text-[8px] font-extrabold uppercase tracking-[0.12em]"
                                        style={{
                                          color:
                                            courseColor,
                                        }}
                                      >
                                        Study
                                      </span>

                                      {height >= 85 && (
                                        <span
                                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-semibold"
                                          style={{
                                            backgroundColor:
                                              hexToRgba(
                                                courseColor,
                                                0.1
                                              ),
                                            color:
                                              courseColor,
                                          }}
                                        >
                                          {getPriorityLabel(
                                            session.priority
                                          )}
                                        </span>
                                      )}
                                    </div>

                                    {/* TOPIC */}

                                    <div
                                      className="mt-1 line-clamp-2 text-[9px] font-bold leading-tight text-foreground"
                                      title={course?.name || session.topic || "Study Session"}
                                    >
                                      {course?.name || session.topic || "Study Session"}
                                    </div>

                                    {/* SESSION TOPIC */}

                                    {session.topic &&
                                      session.topic !== course?.name &&
                                      height >= 70 && (
                                        <div className="mt-0.5 truncate text-[9px] font-medium text-muted-foreground">
                                          {session.topic}
                                        </div>
                                      )}

                                    {/* TIME */}

                                    <div className="mt-1.5 flex items-center gap-1 text-[9px] font-medium tabular-nums text-secondary-foreground">
                                      <Clock className="h-2.5 w-2.5 shrink-0" />

                                      <span className="truncate">
                                        {formatTime(
                                          session.start_time
                                        )}{" "}
                                        –{" "}
                                        {formatTime(
                                          session.end_time
                                        )}
                                      </span>
                                    </div>

                                    {/* VENUE */}

                                    {session.venue &&
                                      height >= 95 && (
                                        <div className="mt-1 flex items-center gap-1 truncate text-[9px] text-muted-foreground">
                                          <MapPin className="h-2.5 w-2.5 shrink-0" />

                                          <span className="truncate">
                                            {
                                              session.venue
                                            }
                                          </span>
                                        </div>
                                      )}

                                    {/* STATUS */}

                                    {height >= 115 && (
                                      <div className="mt-1.5">
                                        <span className="inline-flex rounded-md bg-card/70 px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground">
                                          {getStatusLabel(
                                            session.status
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            }
                          )}

                        {/* =================================================
                            PERSONAL EVENTS
                        ================================================== */}

                        {showPersonalEvents &&
                          dayEvents.map((event) => {
                            if (
                              !event.start_time ||
                              !event.end_time
                            ) {
                              return null;
                            }

                            const {
                              top,
                              height,
                            } = getPosition(
                              event.start_time,
                              event.end_time
                            );

                            const eventColor = getEventColor(event.id);
                            const isSelected =
                              selectedEvent?.id ===
                              event.id;

                            return (
                              <button
                                key={`event-${event.id}`}
                                type="button"
                                onPointerDown={(mouseEvent) =>
                                  mouseEvent.stopPropagation()
                                }
                                onClick={(mouseEvent) =>
                                  openPopup(
                                    mouseEvent,
                                    "event",
                                    event
                                  )
                                }
                                className={`group absolute left-1.5 right-1.5 z-40 overflow-hidden rounded-lg border text-left transition-all duration-200 ${
                                  isSelected
                                    ? "z-50 ring-2 ring-primary/40 ring-offset-1 shadow-lg"
                                    : "hover:-translate-y-0.5 hover:bg-primary/8 hover:shadow-sm"
                                }`}
                                style={{
                                  top: top + 2,
                                  height:
                                    Math.max(
                                      height - 4,
                                      40
                                    ),
                                  backgroundColor: hexToRgba(eventColor, 0.2),
                                  borderColor: hexToRgba(eventColor, 0.38),
                                }}
                              >
                                <div className="h-full border-l-2 px-2.5 py-2" style={{ borderLeftColor: eventColor }}>
                                  {/* LABEL */}

                                  <div className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: eventColor }} />

                                    <span className="truncate text-[8px] font-extrabold uppercase tracking-[0.12em]" style={{ color: eventColor }}>
                                      Personal
                                    </span>
                                  </div>

                                  {/* TITLE */}

                                  <div className="mt-1 truncate text-[11px] font-bold leading-tight text-foreground">
                                    {event.title}
                                  </div>

                                  {/* TIME */}

                                  <div className="mt-1.5 flex items-center gap-1 text-[9px] font-medium tabular-nums text-secondary-foreground">
                                    <Clock className="h-2.5 w-2.5 shrink-0" style={{ color: eventColor }} />

                                    <span className="truncate">
                                      {formatTime(
                                        event.start_time
                                      )}{" "}
                                      –{" "}
                                      {formatTime(
                                        event.end_time
                                      )}
                                    </span>
                                  </div>

                                  {/* LOCATION */}

                                  {event.location &&
                                    height >= 80 && (
                                      <div className="mt-1 flex items-center gap-1 truncate text-[9px] text-muted-foreground">
                                        <MapPin className="h-2.5 w-2.5 shrink-0" style={{ color: eventColor }} />

                                        <span className="truncate">
                                          {
                                            event.location
                                          }
                                        </span>
                                      </div>
                                    )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
          </div>
          )}
        </section>
      </div>

      {/* =====================================================
          FLOATING EVENT POPUP
      ====================================================== */}

      {(selectedLecture ||
        selectedStudySession ||
        selectedEvent) && (
        <div
          ref={popupRef}
          className="fixed z-70 max-h-[calc(100vh-24px)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl ring-1 ring-border/50"
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
            width: popupPosition.width,
            maxHeight: "calc(100vh - 24px)",
          }}
          onPointerDown={(event) =>
            event.stopPropagation()
          }
        >
          {/* COURSE-COLOR ACCENT */}

          <div
            className="h-1 w-full"
            style={{
              backgroundColor:
                selectedLecture?.course_color ||
                PRIMARY_COLOR,
            }}
          />

          {/* =================================================
              LECTURE POPUP
          ================================================== */}

          {selectedLecture && (
            <>
              <div
                className="cursor-move touch-none select-none border-b border-border px-4 py-3"
                onPointerDown={startPopupDrag}
                onPointerMove={movePopup}
                onPointerUp={stopPopupDrag}
                onPointerCancel={stopPopupDrag}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor:
                            hexToRgba(
                              selectedLecture.course_color ||
                                PRIMARY_COLOR,
                              0.1
                            ),
                          color:
                            selectedLecture.course_color ||
                            PRIMARY_COLOR,
                        }}
                      >
                        <GraduationCap className="h-4 w-4" />
                      </span>

                      <p
                        className="truncate text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{
                          color:
                            selectedLecture.course_color ||
                            PRIMARY_COLOR,
                        }}
                      >
                        {selectedLecture.class_type}
                      </p>
                    </div>

                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                      {selectedLecture.course_name}
                    </h3>

                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {selectedLecture.course_code}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closePopup}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-secondary-foreground"
                    aria-label="Close lecture details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-3 py-3">
                <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Day
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                      {
                        DAYS[
                          selectedLecture.day_of_week
                        ]
                      }
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Time
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                      {formatTime(
                        selectedLecture.start_time
                      )}{" "}
                      –{" "}
                      {formatTime(
                        selectedLecture.end_time
                      )}
                    </p>
                  </div>
                </div>

                {selectedLecture.venue && (
                  <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Venue
                      </p>

                      <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                        {selectedLecture.venue}
                      </p>
                    </div>
                  </div>
                )}

                {selectedLecture.lecturer && (
                  <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                    <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Lecturer
                      </p>

                      <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                        {selectedLecture.lecturer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* =================================================
              STUDY SESSION POPUP
          ================================================== */}

          {selectedStudySession && (
            <>
              <div
                className="cursor-move touch-none select-none border-b border-border px-4 py-3"
                onPointerDown={startPopupDrag}
                onPointerMove={movePopup}
                onPointerUp={stopPopupDrag}
                onPointerCancel={stopPopupDrag}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor:
                            hexToRgba(
                              PRIMARY_COLOR,
                              0.1
                            ),
                          color: PRIMARY_COLOR,
                        }}
                      >
                        <BookOpen className="h-4 w-4" />
                      </span>

                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                        Study Session
                      </p>
                    </div>

                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                      {selectedStudySession.topic ||
                        getCourse(
                          selectedStudySession.course_id
                        )?.name ||
                        "Study Session"}
                    </h3>

                    {getCourse(
                      selectedStudySession.course_id
                    )?.code && (
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {
                          getCourse(
                            selectedStudySession.course_id
                          )?.code
                        }
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={closePopup}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-secondary-foreground"
                    aria-label="Close study session details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-3 py-3">
                <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Date
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                      {formatDate(
                        new Date(
                          `${selectedStudySession.session_date}T00:00:00`
                        )
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Time
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                      {formatTime(
                        selectedStudySession.start_time
                      )}{" "}
                      –{" "}
                      {formatTime(
                        selectedStudySession.end_time
                      )}
                    </p>
                  </div>
                </div>

                {selectedStudySession.venue && (
                  <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Venue
                      </p>

                      <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                        {selectedStudySession.venue}
                      </p>
                    </div>
                  </div>
                )}

                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Priority
                    </p>

                    <p className="mt-0.5 text-xs font-medium text-foreground">
                      {getPriorityLabel(
                        selectedStudySession.priority
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>

                    <p className="mt-0.5 text-xs font-medium text-foreground">
                      {getStatusLabel(
                        selectedStudySession.status
                      )}
                    </p>
                  </div>
                </div>

                {selectedStudySession.notes && (
                  <div className="col-span-2 rounded-lg bg-muted p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Notes
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-secondary-foreground">
                      {selectedStudySession.notes}
                    </p>
                  </div>
                )}
              </div>

          {/* DELETE ERROR */}

          {deleteError && (
            <div className="mx-3 mt-1 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
              <p className="text-destructive text-xs">{deleteError}</p>
            </div>
          )}

          {/* ACTIONS */}

          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            {/* DELETE — shows confirm step on first click */}
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(true);
                  setDeleteError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">
                  Are you sure?
                </span>

                <button
                  type="button"
                  onClick={handleDeleteSession}
                  disabled={isDeleting}
                  className="rounded-lg bg-destructive px-2.5 py-1 text-[11px] font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-60"
                >
                  {isDeleting ? "Deleting…" : "Yes, delete"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteError(null);
                  }}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* RESCHEDULE */}
            <button
              type="button"
              onClick={() => {
                setReschedulingSession(selectedStudySession);
                closePopup();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition hover:bg-muted"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Reschedule
            </button>

            {/* EDIT */}
            <button
              type="button"
              onClick={() => {
                setEditingSession(selectedStudySession);
                closePopup();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>

            </>
          )}

          {/* =================================================
              PERSONAL EVENT POPUP
          ================================================== */}

          {selectedEvent && (
            <>
              <div
                className="cursor-move touch-none select-none border-b border-border px-4 py-3"
                onPointerDown={startPopupDrag}
                onPointerMove={movePopup}
                onPointerUp={stopPopupDrag}
                onPointerCancel={stopPopupDrag}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor:
                            hexToRgba(
                              PRIMARY_COLOR,
                              0.1
                            ),
                          color: PRIMARY_COLOR,
                        }}
                      >
                        <UserRound className="h-4 w-4" />
                      </span>

                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                        Personal Event
                      </p>
                    </div>

                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                      {selectedEvent.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={closePopup}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-secondary-foreground"
                    aria-label="Close event details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-3 py-3">
                <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Date
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                      {formatDate(
                        new Date(
                          `${selectedEvent.event_date}T00:00:00`
                        )
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Time
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                      {selectedEvent.start_time &&
                      selectedEvent.end_time
                        ? `${formatTime(
                            selectedEvent.start_time
                          )} – ${formatTime(
                            selectedEvent.end_time
                          )}`
                        : "All day"}
                    </p>
                  </div>
                </div>

                {selectedEvent.location && (
                  <div className="flex min-w-0 items-start gap-2 rounded-lg bg-background p-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />

                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Location
                      </p>

                      <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-tight text-foreground">
                        {selectedEvent.location}
                      </p>
                    </div>
                  </div>
                )}

                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Flexibility
                    </p>

                    <p className="mt-0.5 text-xs font-medium text-foreground">
                      {getFlexibilityLabel(
                        selectedEvent.flexibility
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Recurring
                    </p>

                    <p className="mt-0.5 text-xs font-medium text-foreground">
                      {selectedEvent.is_recurring
                        ? "Yes"
                        : "No"}
                    </p>
                  </div>
                </div>

                {selectedEvent.description && (
                  <div className="col-span-2 rounded-lg bg-muted p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Description
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-secondary-foreground">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                {selectedEvent.notes && (
                  <div className="col-span-2 rounded-lg bg-muted p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Notes
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-secondary-foreground">
                      {selectedEvent.notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      )}

      {/* EDIT STUDY SESSION DIALOG */}

      <EditStudySessionDialog
        session={editingSession}
        courses={courses}
        onClose={() => setEditingSession(null)}
        onSessionUpdated={() => setRefreshKey((k) => k + 1)}
      />

      {/* RESCHEDULE STUDY SESSION DIALOG */}

      <RescheduleStudySessionDialog
        session={reschedulingSession}
        courses={courses}
        onClose={() => setReschedulingSession(null)}
        onSessionRescheduled={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
