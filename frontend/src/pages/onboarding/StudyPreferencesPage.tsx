import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";

import { useOnboarding } from "@/context/OnboardingContext";
import type {
  BreakPreference,
  StudyTime,
} from "@/context/OnboardingContext";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import { saveStudyPreferences } from "@/api/users";

const STUDY_TIMES: { value: StudyTime; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

// value 0 = Monday ... 6 = Sunday (same numbering as the timetable)
const DAYS = [
  { value: 0, short: "Mon", full: "Monday" },
  { value: 1, short: "Tue", full: "Tuesday" },
  { value: 2, short: "Wed", full: "Wednesday" },
  { value: 3, short: "Thu", full: "Thursday" },
  { value: 4, short: "Fri", full: "Friday" },
  { value: 5, short: "Sat", full: "Saturday" },
  { value: 6, short: "Sun", full: "Sunday" },
];

// The longest a single study session may be (up to 4 hours).
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

interface FieldErrors {
  studyTime?: string;
  studyDays?: string;
  breakPreference?: string;
}

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

// A rounded "pill" that is really a hidden radio button or checkbox,
// so it works with the keyboard and screen readers.
interface ChoicePillProps {
  type: "radio" | "checkbox";
  name: string;
  label: string;
  ariaLabel?: string;
  checked: boolean;
  onChange: () => void;
}

function ChoicePill({
  type,
  name,
  label,
  ariaLabel,
  checked,
  onChange,
}: ChoicePillProps) {
  return (
    <label className="relative cursor-pointer">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex h-10 min-w-18 items-center justify-center rounded-full border border-input bg-background px-4 text-sm font-medium text-foreground transition",
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
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export default function StudyPreferencesPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { extraction, studyPreferences, setStudyPreferences, setStudyPlan } =
    useOnboarding();

  // The uploaded-timetable path has an extraction; the skipped path does not.
  const isUploadPath = extraction !== null;

  // Start from earlier answers if the student comes back to this page.
  const [studyTimes, setStudyTimes] = useState<StudyTime[]>(
    studyPreferences?.studyTimes ?? []
  );
  const [studyDays, setStudyDays] = useState<number[]>(
    studyPreferences?.studyDays ?? []
  );
  const [sessionLength, setSessionLength] = useState<number>(
    studyPreferences?.sessionLength ?? 60
  );
  const [breakPreference, setBreakPreference] = useState<BreakPreference | "">(
    studyPreferences?.breakPreference ?? ""
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const toggleTime = (time: StudyTime) => {
    setErrors((current) => ({ ...current, studyTime: undefined }));
    setStudyTimes((current) =>
      current.includes(time)
        ? current.filter((t) => t !== time)
        : [...current, time]
    );
  };

  const toggleDay = (day: number) => {
    setErrors((current) => ({ ...current, studyDays: undefined }));
    setStudyDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setServerError(null);

    // Check the required choices.
    const nextErrors: FieldErrors = {};
    if (studyTimes.length === 0) {
      nextErrors.studyTime = "Please choose at least one time of day";
    }
    if (studyDays.length === 0) {
      nextErrors.studyDays = "Please choose at least one study day";
    }
    if (!breakPreference) {
      nextErrors.breakPreference = "Please choose a break preference";
    }

    if (Object.keys(nextErrors).length > 0 || !breakPreference) {
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Save on the server so the AI can use these preferences.
      await saveStudyPreferences({
        study_times: studyTimes,
        study_days: studyDays,
        session_length_minutes: sessionLength,
        break_preference: breakPreference,
      });

      setStudyPreferences({
        studyTimes,
        studyDays,
        sessionLength,
        breakPreference,
      });

      // The preferences may have changed, so any earlier plan is out of date.
      setStudyPlan(null);

      // Upload path -> plan building (Phase 11).
      // Skip path   -> Finish Setup (Phase 14, not built yet).
      navigate(
        isUploadPath ? "/onboarding/plan-building" : "/onboarding/finish",
        { replace: true }
      );
    } catch (error: unknown) {
      setServerError(
        getErrorMessage(
          error,
          "We couldn't save your preferences. Please try again."
        )
      );
      setIsSaving(false);
    }
  };

  return (
    <main
      className="relative flex min-h-dvh items-center justify-center p-4 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(color-mix(in srgb, var(--primary) 40%, transparent), color-mix(in srgb, var(--primary) 40%, transparent)), url('/graduation-background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Small logo top-left */}
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <LebidLogo className="w-16 sm:w-20" />
        </div>

        <div className="flex flex-col px-6 pb-8 pt-4 sm:px-8 sm:pb-10">
          <h1
            className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            style={friendlyFont}
          >
            How do you like to study? 🧠
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Tell me a little about your study habits so I can build a
            schedule around you.
          </p>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6"
            noValidate
          >
            {/* Preferred study time */}
                        {/* Preferred study times (choose one or more) */}
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium text-foreground">
                Preferred study times{" "}
                <span className="font-normal text-muted-foreground">
                  (choose one or more)
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {STUDY_TIMES.map((option) => (
                  <ChoicePill
                    key={option.value}
                    type="checkbox"
                    name="study-times"
                    label={option.label}
                    checked={studyTimes.includes(option.value)}
                    onChange={() => toggleTime(option.value)}
                  />
                ))}
              </div>
              {errors.studyTime && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {errors.studyTime}
                </p>
              )}
            </fieldset>

            {/* Preferred study days */}
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium text-foreground">
                Preferred study days
              </legend>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <ChoicePill
                    key={day.value}
                    type="checkbox"
                    name="study-days"
                    label={day.short}
                    ariaLabel={day.full}
                    checked={studyDays.includes(day.value)}
                    onChange={() => toggleDay(day.value)}
                  />
                ))}
              </div>
              {errors.studyDays && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {errors.studyDays}
                </p>
              )}
            </fieldset>

                        {/* Longest study session */}
            <div>
              <label
                htmlFor="session-length"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Longest study session
              </label>
              <p className="mb-2 text-xs text-muted-foreground">
                Lebid will plan sessions of different lengths, up to this long.
              </p>
              <div className="relative">
                <select
                  id="session-length"
                  value={sessionLength}
                  onChange={(e) => setSessionLength(Number(e.target.value))}
                  className="w-full appearance-none rounded-lg border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
                >
                  {SESSION_LENGTHS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatMinutes(minutes)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Break preference */}
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium text-foreground">
                Break preference
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
                      setBreakPreference(option.value);
                      setErrors((current) => ({
                        ...current,
                        breakPreference: undefined,
                      }));
                    }}
                  />
                ))}
              </div>
              {errors.breakPreference && (
                <p className="mt-1.5 text-xs text-destructive" role="alert">
                  {errors.breakPreference}
                </p>
              )}
            </fieldset>

                        {serverError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  SAVING...
                </>
              ) : (
                <>
                  {isUploadPath ? "BUILD MY PLAN" : "FINISH SETUP"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      <ThemeToggle />
    </main>
  );
}