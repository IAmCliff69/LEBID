import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { activateStudyPlan } from "@/api/studyPlan";
import { useOnboarding } from "@/context/OnboardingContext";
import LebidLogo from "@/components/brand/LebidLogo";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Quick ideas for the venue boxes. Edit this list any time.
const VENUE_SUGGESTIONS = [
  "Library",
  "Hostel Room",
  "Study Room",
  "Classroom",
  "Computer Lab",
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const status = (error as { response?: { status?: unknown } }).response
      ?.status;
    if (typeof status === "number") return status;
  }
  return null;
}

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-70";

export default function StudyVenuesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const { extraction, studyPlan, setTimetableFile } = useOnboarding();
  const { user, setUser } = useAuth();

  // One venue per study session (same order as the plan's sessions).
  const [venues, setVenues] = useState<string[]>(
    () => studyPlan?.sessions.map(() => "") ?? []
  );
  const [sameVenue, setSameVenue] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Without a plan with sessions there is nothing to add venues to.
  useEffect(() => {
    if (!studyPlan) {
      navigate(
        extraction ? "/onboarding/plan-building" : "/onboarding/timetable",
        { replace: true }
      );
    } else if (studyPlan.sessions.length === 0) {
      navigate("/onboarding/plan-review", { replace: true });
    }
  }, [studyPlan, extraction, navigate]);

  // After the success message shows for a moment, show the "You're all set"
  // page (its button then opens the Dashboard).
  useEffect(() => {
    if (!activated) return;
    const timer = window.setTimeout(() => {
      navigate("/onboarding/finish", {
        replace: true,
        state: { planActivated: true },
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activated, navigate]);

  // The sessions, ordered by day and time. `index` is the session's place in
  // the plan, which is how its venue is found.
  const rows = useMemo(() => {
    if (!studyPlan) return [];
    return studyPlan.sessions
      .map((session, index) => ({ session, index }))
      .sort(
        (a, b) =>
          a.session.day_of_week - b.session.day_of_week ||
          a.session.start_time.localeCompare(b.session.start_time)
      );
  }, [studyPlan]);

  if (!studyPlan) return null;

  const total = venues.length;
  const remaining = venues.filter((venue) => venue.trim().length === 0).length;
  const allDone = total > 0 && remaining === 0;
  const isBusy = isActivating || activated;

  const setVenue = (index: number, value: string) => {
    setError(null);
    setVenues((current) => current.map((v, i) => (i === index ? value : v)));
  };

  // Puts the same venue on every session (any can be changed afterwards).
  const applyToAll = () => {
    const value = sameVenue.trim();
    if (!value) return;
    setError(null);
    setVenues((current) => current.map(() => value));
  };

  // The plan is saved: free the uploaded file, refresh the app's data, and
  // show the success state (the effect above then opens the Dashboard).
    const finish = async () => {
    setTimetableFile(null);
    if (user) setUser({ ...user, onboarding_completed: true });
    await queryClient.invalidateQueries();
    setActivated(true);
  };

  const handleActivate = async () => {
    if (!extraction || !allDone || isBusy) return;

    setIsActivating(true);
    setError(null);

    try {
      await activateStudyPlan(
        extraction.import_id,
        studyPlan.sessions.map((session, index) => ({
          ...session,
          venue: venues[index].trim(),
        }))
      );
      await finish();
    } catch (err: unknown) {
      // 409 = this plan was already activated (for example a double click).
      if (getErrorStatus(err) === 409) {
        await finish();
        return;
      }
      setError(
        getErrorMessage(
          err,
          "We couldn't reach Lebid to activate your plan. Please check your connection and try again."
        )
      );
      setIsActivating(false);
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
            One last thing 📍
          </h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Where will you usually study? Add a venue for each study session.
          </p>

          {/* Same venue for every session */}
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <label
              htmlFor="same-venue"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Same place for every session?
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              Type a venue and apply it to all sessions. You can still change
              any of them afterwards.
            </p>
            <div className="flex gap-2">
              <input
                id="same-venue"
                type="text"
                list="venue-suggestions"
                autoComplete="off"
                maxLength={255}
                value={sameVenue}
                disabled={isBusy}
                onChange={(e) => setSameVenue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyToAll();
                  }
                }}
                placeholder="e.g. Library"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={applyToAll}
                disabled={isBusy || sameVenue.trim().length === 0}
                className="h-10 shrink-0 rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                APPLY TO ALL
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {VENUE_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setSameVenue(suggestion)}
                  className="rounded-full border border-input bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/60 hover:text-foreground disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Suggestions that appear while typing in any venue box */}
          <datalist id="venue-suggestions">
            {VENUE_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>

          {/* One venue per study session */}
          <ul className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-background p-3">
            {rows.map(({ session, index }) => {
              const filled = (venues[index] ?? "").trim().length > 0;

              return (
                <li
                  key={index}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <p
                    id={`session-title-${index}`}
                    className="text-sm font-semibold text-foreground"
                  >
                    {DAY_NAMES[session.day_of_week]} · {session.start_time} –{" "}
                    {session.end_time}
                  </p>
                  <p className="mb-2 wrap-break-word text-xs text-muted-foreground">
                    {session.course_name} · {session.topic}
                  </p>

                  <label
                    htmlFor={`venue-${index}`}
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Venue
                  </label>
                  <div className="relative">
                    <input
                      id={`venue-${index}`}
                      type="text"
                      list="venue-suggestions"
                      autoComplete="off"
                      maxLength={255}
                      value={venues[index] ?? ""}
                      disabled={isBusy}
                      onChange={(e) => setVenue(index, e.target.value)}
                      aria-describedby={`session-title-${index}`}
                      placeholder="e.g. Library"
                      className={cn(fieldClass, "pr-9")}
                    />
                    {filled && (
                      <Check
                        className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <p
            aria-live="polite"
            className="mt-3 text-center text-xs text-muted-foreground"
          >
            {allDone
              ? "All set. Your plan is ready to activate."
              : `${remaining} ${remaining === 1 ? "venue" : "venues"} left to add`}
          </p>

          <button
            type="button"
            onClick={handleActivate}
            disabled={!allDone || isBusy}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activated ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                PLAN ACTIVATED
              </>
            ) : isActivating ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ACTIVATING...
              </>
            ) : (
              <>
                ACTIVATE MY PLAN
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate("/onboarding/plan-review", { replace: true })}
            disabled={isBusy}
            className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to my plan
          </button>
        </div>
      </motion.div>

      <ThemeToggle />
    </main>
  );
}