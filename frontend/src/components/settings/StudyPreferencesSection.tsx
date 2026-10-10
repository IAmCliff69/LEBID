import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getStudyPreferences, saveStudyPreferences } from "@/api/users";
import type { StudyPreferencesData } from "@/api/users";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StudyTime = StudyPreferencesData["study_times"][number];
type BreakPreference = StudyPreferencesData["break_preference"];

const STUDY_TIMES: { value: StudyTime; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

// 0 = Monday ... 6 = Sunday (same numbering as the timetable)
const DAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

// The longest a single study session may be (up to 4 hours)
const SESSION_LENGTHS = [30, 45, 60, 90, 120, 150, 180, 210, 240];

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${hours} hr ${rest} min`;
}

const BREAKS: { value: BreakPreference; label: string }[] = [
  { value: "short", label: "Short breaks" },
  { value: "long", label: "Longer breaks" },
];

// What a student sees before they have saved any preferences
const DEFAULT_PREFERENCES: StudyPreferencesData = {
  study_times: ["evening"],
  study_days: [0, 1, 2, 3, 4],
  session_length_minutes: 120,
  break_preference: "short",
};

// A rounded "pill" that is really a hidden checkbox or radio button,
// so it works with the keyboard and screen readers.
function ChoicePill({
  type,
  name,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="relative cursor-pointer">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex h-10 min-w-16 items-center justify-center rounded-full border border-input bg-background px-4 text-sm font-medium text-foreground transition",
          "hover:border-primary/60",
          "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40 peer-focus-visible:ring-offset-2"
        )}
      >
        {label}
      </span>
    </label>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

function StudyPreferencesForm({ initial }: { initial: StudyPreferencesData }) {
  const queryClient = useQueryClient();

  const [studyTimes, setStudyTimes] = useState<StudyTime[]>(
    initial.study_times
  );
  const [studyDays, setStudyDays] = useState<number[]>(initial.study_days);
  const [sessionLength, setSessionLength] = useState(
    initial.session_length_minutes
  );
  const [breakPreference, setBreakPreference] = useState<BreakPreference>(
    initial.break_preference
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTime = (time: StudyTime) => {
    setError(null);
    setStudyTimes((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
    );
  };

  const toggleDay = (day: number) => {
    setError(null);
    setStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (studyTimes.length === 0) {
      setError("Choose at least one time of day.");
      return;
    }
    if (studyDays.length === 0) {
      setError("Choose at least one study day.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const saved = await saveStudyPreferences({
        study_times: studyTimes,
        study_days: studyDays,
        session_length_minutes: sessionLength,
        break_preference: breakPreference,
      });
      queryClient.setQueryData(["study-preferences"], saved);
      toast.success("Study preferences saved", {
        description:
          "Lebid will use them the next time it builds or adjusts your plan.",
      });
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "We couldn't save your preferences. Please try again."
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          When do you like to study?
        </legend>
        <div className="flex flex-wrap gap-2">
          {STUDY_TIMES.map((time) => (
            <ChoicePill
              key={time.value}
              type="checkbox"
              name="study-time"
              label={time.label}
              checked={studyTimes.includes(time.value)}
              onChange={() => toggleTime(time.value)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Which days can you study?
        </legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <ChoicePill
              key={day.value}
              type="checkbox"
              name="study-day"
              label={day.label}
              checked={studyDays.includes(day.value)}
              onChange={() => toggleDay(day.value)}
            />
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="settings_session_length" className="text-sm font-medium">
          Longest single study session
        </label>
        <div>
          <select
            id="settings_session_length"
            value={sessionLength}
            onChange={(event) => setSessionLength(Number(event.target.value))}
            className="h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {SESSION_LENGTHS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatMinutes(minutes)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          What kind of breaks do you prefer?
        </legend>
        <div className="flex flex-wrap gap-2">
          {BREAKS.map((option) => (
            <ChoicePill
              key={option.value}
              type="radio"
              name="break-preference"
              label={option.label}
              checked={breakPreference === option.value}
              onChange={() => {
                setError(null);
                setBreakPreference(option.value);
              }}
            />
          ))}
        </div>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save preferences"}
      </Button>
    </div>
  );
}

// Loads the saved preferences, then shows the form.
export default function StudyPreferencesSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["study-preferences"],
    queryFn: getStudyPreferences,
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading your preferences...
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        We couldn&apos;t load your study preferences. Please refresh the page.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!data && (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t saved any preferences yet. These are suggested
          starting choices.
        </p>
      )}
      <StudyPreferencesForm initial={data ?? DEFAULT_PREFERENCES} />
    </div>
  );
}