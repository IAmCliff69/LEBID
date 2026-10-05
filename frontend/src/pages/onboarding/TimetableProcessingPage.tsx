import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Loader2, RotateCcw } from "lucide-react";

import { discardImport, uploadTimetable } from "@/api/timetableImport";
import { useOnboarding } from "@/context/OnboardingContext";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

// The real stages of this screen:
// uploading  -> the file is being sent to Lebid
// reading    -> the file arrived and the AI is reading it (the slow part)
// organizing -> the AI finished and the result is being stored
// done       -> everything succeeded
// error      -> something failed (the student can retry)
type Phase = "uploading" | "reading" | "organizing" | "done" | "error";

const CHECKLIST = [
  "Academic profile",
  "Timetable uploaded",
  "Reading lectures",
  "Organizing your schedule",
];

// How many checklist items are finished in each phase.
const COMPLETED_ITEMS: Record<Phase, number> = {
  uploading: 1,
  reading: 2,
  organizing: 3,
  done: 4,
  error: 0,
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

export default function TimetableProcessingPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { timetableFile, setTimetableFile, extraction, setExtraction } =
    useOnboarding();

  // If we already have a result (for example the student pressed Back),
  // show the finished state instead of uploading again.
  const [phase, setPhase] = useState<Phase>(extraction ? "done" : "uploading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startedRef = useRef(false);
  const doneTimerRef = useRef<number | null>(null);

  // Stop the small "organizing" timer if the student leaves this page.
  useEffect(() => {
    return () => {
      if (doneTimerRef.current !== null) {
        window.clearTimeout(doneTimerRef.current);
      }
    };
  }, []);

  // Sends the file to the real backend and follows what actually happens.
  const performUpload = useCallback(
    async (file: File) => {
      try {
        const result = await uploadTimetable(file);

        // Success: keep the result for the next onboarding steps.
        setExtraction(result);
        setPhase("organizing");

        // Short pause so the last checklist item is visible before "done".
        doneTimerRef.current = window.setTimeout(() => setPhase("done"), 700);
      } catch (error: unknown) {
        setErrorMessage(
          getErrorMessage(
            error,
            "We couldn't reach Lebid to process your timetable. Please check your connection and try again."
          )
        );
        setPhase("error");
      }
    },
    [setExtraction]
  );

  // Start the upload once when the page opens.
  useEffect(() => {
    if (extraction) return;

    if (!timetableFile) {
      // Nothing to process (for example after a page refresh).
      navigate("/onboarding/timetable", { replace: true });
      return;
    }

    // This guard makes sure the file is uploaded only ONCE, even in
    // development mode where React runs effects twice.
    if (startedRef.current) return;
    startedRef.current = true;

    void performUpload(timetableFile);
  }, [extraction, timetableFile, navigate, performUpload]);

  const handleRetry = () => {
    if (!timetableFile) return;
    setErrorMessage(null);
    setPhase("uploading");
    void performUpload(timetableFile);
  };

    const handleChooseAnotherFile = () => {
    // Throw the abandoned upload away on the server too (if there was one).
    if (extraction) {
      discardImport(extraction.import_id).catch(() => {
        // If this fails, it is simply offered again next time.
      });
    }
    setTimetableFile(null);
    setExtraction(null);
    navigate("/onboarding/timetable", { replace: true });
  };

  const handleContinue = () => {
    navigate("/onboarding/study-preferences", { replace: true });
  };

  const entryCount = extraction?.extracted_entries.length ?? 0;
  const isWorking =
    phase === "uploading" || phase === "reading" || phase === "organizing";
  const completed = COMPLETED_ITEMS[phase];

  let heading = "Reading your timetable...";
  let description =
    "Understanding your academic schedule and organizing your week.";

  if (phase === "done") {
    if (entryCount > 0) {
      heading = "Your timetable has been mapped! ✓";
      description = `I found ${entryCount} class ${
        entryCount === 1 ? "entry" : "entries"
      } in your timetable.`;
    } else {
      heading = "Your timetable has been read";
      description =
        "We couldn't find any classes in this file. You can try a clearer image or PDF, or continue and add your classes later.";
    }
  } else if (phase === "error") {
    heading = "Couldn't process your timetable";
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
          {/* Large logo that gently pulses while the AI works */}
          <motion.div
            animate={
              isWorking && !prefersReducedMotion
                ? { scale: [1, 1.04, 1] }
                : { scale: 1 }
            }
            transition={
              isWorking
                ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
            }
            className="mb-4"
          >
            <LebidLogo className="w-44 sm:w-52" />
          </motion.div>

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

          {/* Progress checklist (hidden if something failed) */}
          {phase !== "error" && (
            <ul className="mt-6 flex w-full max-w-xs flex-col gap-3 text-left">
              {CHECKLIST.map((label, index) => {
                const isDone = index < completed;
                const isActive = index === completed;

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
                      ) : isActive ? (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        isDone || isActive
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
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
                onClick={handleChooseAnotherFile}
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Choose a different file
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
              {entryCount === 0 && (
                <button
                  type="button"
                  onClick={handleChooseAnotherFile}
                  className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Try a different file
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <ThemeToggle />
    </main>
  );
}