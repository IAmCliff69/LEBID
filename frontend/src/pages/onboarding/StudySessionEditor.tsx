import { useId, useState } from "react";
import type { FormEvent } from "react";

import type {
  GeneratedStudyPlan,
  PlannedStudySession,
} from "@/api/studyPlan";
import { TimePicker } from "@/components/ui/time-picker";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Rules for a study session the student edits by hand.
const MIN_MINUTES = 30;
const MAX_MINUTES = 240; // 4 hours

// "08:30" -> 510. Returns null if the text is not a valid time.
function toMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

interface CourseOption {
  name: string;
  code: string | null;
}

// The courses the student can pick: every course that has a class in the plan.
function getCourseOptions(
  plan: GeneratedStudyPlan,
  session: PlannedStudySession
): CourseOption[] {
  const seen = new Set<string>();
  const options: CourseOption[] = [];

  const addOption = (name: string, code: string | null) => {
    const key = `${code ?? ""}|${name}`;
    if (!seen.has(key)) {
      seen.add(key);
      options.push({ name, code });
    }
  };

  plan.classes.forEach((c) => addOption(c.course_name, c.course_code));
  // Make sure the session's current course is always in the list.
  addOption(session.course_name, session.course_code);

  return options;
}

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25";
const labelClass = "mb-1 block text-xs font-medium text-foreground";

interface StudySessionEditorProps {
  plan: GeneratedStudyPlan;
  sessionIndex: number;
  onSave: (updated: PlannedStudySession) => void;
  onCancel: () => void;
}

export default function StudySessionEditor({
  plan,
  sessionIndex,
  onSave,
  onCancel,
}: StudySessionEditorProps) {
  const session = plan.sessions[sessionIndex];
  const id = useId();
  const options = getCourseOptions(plan, session);

  // The form starts with the session's current values.
  const [courseIndex, setCourseIndex] = useState(() =>
    options.findIndex(
      (o) => o.name === session.course_name && o.code === session.course_code
    )
  );
  const [day, setDay] = useState(session.day_of_week);
  const [start, setStart] = useState(session.start_time);
  const [end, setEnd] = useState(session.end_time);
  const [topic, setTopic] = useState(session.topic);
  const [error, setError] = useState<string | null>(null);

  // Checks the edited session and explains the first problem it finds.
  const findProblem = (): { message: string | null; duration: number } => {
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);

    if (startMin === null || endMin === null) {
      return { message: "Please enter a start time and an end time.", duration: 0 };
    }

    const duration = endMin - startMin;

    if (duration <= 0) {
      return { message: "The end time must be after the start time.", duration };
    }
    if (duration < MIN_MINUTES) {
      return {
        message: `A study session must be at least ${MIN_MINUTES} minutes long.`,
        duration,
      };
    }
    if (duration > MAX_MINUTES) {
      return { message: "A study session can be at most 4 hours long.", duration };
    }

    // Must not overlap a class on the same day.
    const clashingClass = plan.classes.find((c) => {
      const classStart = toMinutes(c.start_time);
      const classEnd = toMinutes(c.end_time);
      return (
        c.day_of_week === day &&
        classStart !== null &&
        classEnd !== null &&
        startMin < classEnd &&
        classStart < endMin
      );
    });
    if (clashingClass) {
      return {
        message: `This overlaps your ${clashingClass.course_name} class (${clashingClass.start_time} – ${clashingClass.end_time}).`,
        duration,
      };
    }

    // Must not overlap another study session on the same day.
    const clashingSession = plan.sessions.find((s, i) => {
      if (i === sessionIndex || s.day_of_week !== day) return false;
      const otherStart = toMinutes(s.start_time);
      const otherEnd = toMinutes(s.end_time);
      return (
        otherStart !== null &&
        otherEnd !== null &&
        startMin < otherEnd &&
        otherStart < endMin
      );
    });
    if (clashingSession) {
      return {
        message: `This overlaps another study session (${clashingSession.start_time} – ${clashingSession.end_time}).`,
        duration,
      };
    }

    return { message: null, duration };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { message, duration } = findProblem();
    if (message) {
      setError(message);
      return;
    }

    const course = options[courseIndex];
    onSave({
      day_of_week: day,
      start_time: start,
      end_time: end,
      duration_minutes: duration,
      course_name: course.name,
      course_code: course.code,
      topic: topic.trim() || "Study session",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div>
        <label htmlFor={`${id}-course`} className={labelClass}>
          Course
        </label>
        <select
          id={`${id}-course`}
          value={courseIndex}
          onChange={(e) => {
            setCourseIndex(Number(e.target.value));
            setError(null);
          }}
          className={fieldClass}
        >
          {options.map((option, index) => (
            <option key={`${option.code ?? ""}|${option.name}`} value={index}>
              {option.code ? `${option.code} · ${option.name}` : option.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-day`} className={labelClass}>
            Day
          </label>
          <select
            id={`${id}-day`}
            value={day}
            onChange={(e) => {
              setDay(Number(e.target.value));
              setError(null);
            }}
            className={fieldClass}
          >
            {DAY_NAMES.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-start`} className={labelClass}>
            Start
          </label>
          <TimePicker
            id={`${id}-start`}
            value={start}
            onChange={(value) => {
              setStart(value);
              setError(null);
            }}
          />
        </div>

        <div>
          <label htmlFor={`${id}-end`} className={labelClass}>
            End
          </label>
          <TimePicker
            id={`${id}-end`}
            value={end}
            onChange={(value) => {
              setEnd(value);
              setError(null);
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-topic`} className={labelClass}>
          Topic
        </label>
        <input
          id={`${id}-topic`}
          type="text"
          maxLength={120}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What will you work on?"
          className={fieldClass}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="h-9 flex-1 rounded-lg bg-foreground text-xs font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99]"
        >
          SAVE
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 flex-1 rounded-lg border border-input bg-background text-xs font-semibold text-foreground transition-all hover:border-primary/60 active:scale-[0.99]"
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}