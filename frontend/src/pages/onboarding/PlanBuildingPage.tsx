import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Loader2, RotateCcw } from "lucide-react";

import { generateStudyPlan } from "@/api/studyPlan";
import { discardImport } from "@/api/timetableImport";
import { useOnboarding } from "@/context/OnboardingContext";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

// generating -> the AI is building the plan (the real request is running)
// done       -> the plan arrived from the server
// error      -> something failed (the student can retry)
type Phase = "generating" | "done" | "error";

const CHECKLIST = [
  "Academic profile",
  "Lecture timetable",
  "Study preferences",
  "Creating personal timetable",
];

// A little week of schedule blocks (5 days x 3 rows).
// 1 = a filled block, 0 = an empty block.
const BLOCK_GRID = [
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 0],
  [0, 1, 0],
  [1, 0, 1],
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

// Decorative blocks that fade in one after another while the AI works,
// then settle once the plan is ready.
function ScheduleBlocks({
  working,
  motionEnabled,
}: {
  working: boolean;
  motionEnabled: boolean;
}) {
  return (
    <div className="mb-5 flex gap-2" aria-hidden="true">
      {BLOCK_GRID.map((column, columnIndex) => (
        <div key={columnIndex} className="flex w-10 flex-col gap-2 sm:w-12">
          {column.map((filled, rowIndex) => (
            <motion.div
              key={rowIndex}
              className={cn(
                "h-6 rounded-md sm:h-7",
                filled ? "bg-primary/80" : "bg-border/60"
              )}
              initial={
                motionEnabled ? { opacity: 0.15, scale: 0.85 } : false
              }
              animate={
                working && motionEnabled
                  ? { opacity: [0.15, 1, 1, 0.15], scale: [0.85, 1, 1, 0.85] }
                  : { opacity: 1, scale: 1 }
              }
              transition={
                working && motionEnabled
                  ? {
                      duration: 2.4,
                      repeat: Infinity,
                      delay: columnIndex * 0.18 + rowIndex * 0.12,
                      ease: "easeInOut",
                    }
                  : { duration: 0.4 }
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function PlanBuildingPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const {
    extraction,
    studyPlan,
    setStudyPlan,
    setTimetableFile,
    setExtraction,
  } = useOnboarding();

  // If a plan already exists (for example the student pressed Back),
  // show the finished state instead of asking the AI again.
  const [phase, setPhase] = useState<Phase>(studyPlan ? "done" : "generating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startedRef = useRef(false);

  // Asks the backend to build the plan and follows what really happens.
  const performGeneration = useCallback(
    async (importId: string) => {
      try {
        const plan = await generateStudyPlan(importId);
        setStudyPlan(plan);
        setPhase("done");
      } catch (error: unknown) {
        setErrorMessage(
          getErrorMessage(
            error,
            "We couldn't reach Lebid to build your plan. Please check your connection and try again."
          )
        );
        setPhase("error");
      }
    },
    [setStudyPlan]
  );

  // Start once when the page opens.
  useEffect(() => {
    if (studyPlan) return;

    if (!extraction) {
      // No processed timetable (for example after a page refresh).
      navigate("/onboarding/timetable", { replace: true });
      return;
    }

    // This guard makes sure the plan is requested only ONCE, even in
    // development mode where React runs effects twice.
    if (startedRef.current) return;
    startedRef.current = true;

    void performGeneration(extraction.import_id);
  }, [studyPlan, extraction, navigate, performGeneration]);

  const handleRetry = () => {
    if (!extraction) return;
    setErrorMessage(null);
    setPhase("generating");
    void performGeneration(extraction.import_id);
  };

  const handleChangePreferences = () => {
    navigate("/onboarding/study-preferences", { replace: true });
  };

  const handleUploadDifferent = () => {
    // Throw the abandoned upload away on the server too (if there was one).
    if (extraction) {
      discardImport(extraction.import_id).catch(() => {
        // If this fails, it is simply offered again next time.
      });
    }
    setTimetableFile(null);
    setExtraction(null);
    setStudyPlan(null);
    navigate("/onboarding/timetable", { replace: true });
  };

  const handleContinue = () => {
    // The plan review page (Phase 12) is built next. Until it exists,
    // this route falls back to the Dashboard.
    navigate("/onboarding/plan-review", { replace: true });
  };

  const sessionCount = studyPlan?.sessions.length ?? 0;
  const warnings = studyPlan?.warnings ?? [];
  const isWorking = phase === "generating";

  let heading = "Building your plan...";
  let description =
    "I am is finding the best study windows around your academic schedule and preferences.";

  if (phase === "done") {
    heading = "Your plan is ready! ✓";
    description = `We placed ${sessionCount} study ${
      sessionCount === 1 ? "session" : "sessions"
    } around your classes and preferences.`;
  } else if (phase === "error") {
    heading = "Couldn't build your plan";
    description = errorMessage ?? "Something went wrong. Please try again.";
  }

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

        <div className="flex flex-col items-center px-6 pb-8 pt-2 text-center sm:px-8 sm:pb-10">
          {phase !== "error" && (
            <ScheduleBlocks
              working={isWorking}
              motionEnabled={!prefersReducedMotion}
            />
          )}

          <div aria-live="polite">
            <h1
              className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              style={friendlyFont}
            >
              {heading}
            </h1>
            <p
              role={phase === "error" ? "alert" : undefined}
              className={cn(
                "text-sm",
                phase === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {description}
            </p>
          </div>

          {/* Checklist (hidden if something failed) */}
          {phase !== "error" && (
            <ul className="mt-6 flex w-full max-w-xs flex-col gap-3 text-left">
              {CHECKLIST.map((label, index) => {
                // The first three are already finished. The last one
                // finishes only when the server has sent the plan.
                const isLast = index === CHECKLIST.length - 1;
                const isDone = !isLast || phase === "done";

                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border",
                        isDone
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {isDone ? (
                        <Check className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="text-foreground">{label}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Notes from the planner (for example a day with no free time) */}
          {phase === "done" && warnings.length > 0 && (
            <ul className="mt-5 w-full max-w-xs list-disc space-y-1 pl-4 text-left text-xs text-muted-foreground">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {/* Buttons */}
          {phase === "error" && (
            <div className="mt-6 flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                TRY AGAIN
              </button>
              <button
                type="button"
                onClick={handleChangePreferences}
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Change my study preferences
              </button>
              <button
                type="button"
                onClick={handleUploadDifferent}
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Upload a different timetable
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="mt-6 flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={handleContinue}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2"
              >
                CONTINUE
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <ThemeToggle />
    </main>
  );
}