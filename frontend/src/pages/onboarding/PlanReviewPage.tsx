import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Loader2, Pencil, Send, Sparkles, Trash2 } from "lucide-react";

import { useOnboarding } from "@/context/OnboardingContext";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import StudySessionEditor from "@/pages/onboarding/StudySessionEditor";
import { adjustStudyPlan, type PlannedStudySession } from "@/api/studyPlan";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// One row in the plan: either a class or a study session.
interface DayItem {
  key: string;
  kind: "lecture" | "study";
  badge: string;
  start: string;
  end: string;
  title: string;
  detail: string | null;
  sessionIndex?: number; // only study sessions have this (their place in the plan)
}

interface DayGroup {
  day: number;
  items: DayItem[];
}

// A removed study session and the place it had in the plan (for Undo).
interface RemovedSession {
  session: PlannedStudySession;
  index: number;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

const SUGGESTIONS = [
  "Move my Friday sessions to the evening",
  "Remove my Saturday sessions",
  "Make my Monday lighter",
];

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

export default function PlanReviewPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { extraction, studyPlan, setStudyPlan } = useOnboarding();

  // Which study session is being edited, and the one removed last (for Undo).
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [removedStack, setRemovedStack] = useState<RemovedSession[]>([]);

    // "Tell Lebid what to change" box
  const [instruction, setInstruction] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    message: string;
    changes: string[];
    warnings: string[];
    previousSessions: PlannedStudySession[];
  } | null>(null);

  // Without a plan there is nothing to review (for example after a refresh).
  useEffect(() => {
    if (!studyPlan) {
      navigate(extraction ? "/onboarding/plan-building" : "/onboarding/timetable", {
        replace: true,
      });
    }
  }, [studyPlan, extraction, navigate]);

  // Mix the classes and the study sessions together, grouped by day.
  const dayGroups = useMemo<DayGroup[]>(() => {
    if (!studyPlan) return [];

    const byDay = new Map<number, DayItem[]>();
    const add = (day: number, item: DayItem) => {
      const list = byDay.get(day) ?? [];
      list.push(item);
      byDay.set(day, list);
    };

    studyPlan.classes.forEach((c, index) => {
      add(c.day_of_week, {
        key: `class-${index}`,
        kind: "lecture",
        badge: capitalize(c.class_type),
        start: c.start_time,
        end: c.end_time,
        title: c.course_name,
        detail: c.venue,
      });
    });

    studyPlan.sessions.forEach((s, index) => {
      add(s.day_of_week, {
        key: `study-${index}`,
        kind: "study",
        badge: "Study",
        start: s.start_time,
        end: s.end_time,
        title: s.course_name,
        detail: s.topic,
        sessionIndex: index,
      });
    });

    return Array.from(byDay.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({
        day,
        // "HH:MM" text sorts correctly as plain text
        items: [...items].sort((a, b) => a.start.localeCompare(b.start)),
      }));
  }, [studyPlan]);

  if (!studyPlan) return null;

    const handleSaveSession = (index: number, updated: PlannedStudySession) => {
    setStudyPlan({
      ...studyPlan,
      sessions: studyPlan.sessions.map((s, i) => (i === index ? updated : s)),
    });
    setEditingIndex(null);
    setAiResult(null);
  };

  const handleRemoveSession = (index: number) => {
    setRemovedStack((stack) => [
      ...stack,
      { session: studyPlan.sessions[index], index },
    ]);
    setStudyPlan({
      ...studyPlan,
      sessions: studyPlan.sessions.filter((_, i) => i !== index),
    });
    setEditingIndex(null);
    setAiResult(null);
  };

  // Puts back the most recently removed session (press again for the one before).
  const handleUndoRemove = () => {
    if (removedStack.length === 0) return;
    const last = removedStack[removedStack.length - 1];
    const sessions = [...studyPlan.sessions];
    sessions.splice(Math.min(last.index, sessions.length), 0, last.session);
    setStudyPlan({ ...studyPlan, sessions });
    setRemovedStack(removedStack.slice(0, -1));
  };

  // Puts back every removed session, each in its original place.
  const handleRestoreAll = () => {
    const sessions = [...studyPlan.sessions];
    for (let i = removedStack.length - 1; i >= 0; i--) {
      const item = removedStack[i];
      sessions.splice(Math.min(item.index, sessions.length), 0, item.session);
    }
    setStudyPlan({ ...studyPlan, sessions });
    setRemovedStack([]);
  };

  const lastRemoved =
  removedStack.length > 0 ? removedStack[removedStack.length - 1] : null;

    const handleAskAi = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = instruction.trim();
    if (!text || isAdjusting) return;

    setIsAdjusting(true);
    setAiError(null);
    setEditingIndex(null);
    setRemovedStack([]);

    try {
      const result = await adjustStudyPlan(
        extraction?.import_id ?? null,
        text,
        studyPlan.sessions
      );

      setStudyPlan({ ...studyPlan, sessions: result.sessions });
      setAiResult({
        message: result.message,
        changes: result.changes,
        warnings: result.warnings,
        previousSessions: studyPlan.sessions,
      });
      setInstruction("");
    } catch (error: unknown) {
      setAiError(
        getErrorMessage(
          error,
          "We couldn't reach Lebid to change your plan. Please try again."
        )
      );
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleUndoAi = () => {
    if (!aiResult) return;
    setStudyPlan({ ...studyPlan, sessions: aiResult.previousSessions });
    setAiResult(null);
  };

  const warnings = studyPlan.warnings;

  const handleMakeChanges = () => {
    // Back to the preferences (your answers are still filled in).
    navigate("/onboarding/study-preferences", { replace: true });
  };

  const handleLooksGood = () => {
    // The Study Venues page (Phase 13) is built next. Until it exists,
    // this route falls back to the Dashboard.
    navigate("/onboarding/study-venues", { replace: true });
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
            Your personal study plan ✨
          </h1>
          <p className="mb-1 text-sm text-muted-foreground">
            I&apos;ve created a study schedule around your classes and study
            preferences.
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            Take a look and make sure it works for you.
          </p>

          {/* Why the AI planned it this way */}
          {studyPlan.summary && (
            <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
              {studyPlan.summary}
            </p>
          )}

          {/* The plan, day by day */}
          <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-border bg-background p-3">
            {dayGroups.map((group) => (
              <section key={group.day} className="mb-4 last:mb-0">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {DAY_NAMES[group.day]}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map((item) => {
                    const sessionIndex = item.sessionIndex;

                    // This study session is being edited: show the editor.
                    if (sessionIndex !== undefined && sessionIndex === editingIndex) {
                      return (
                        <li
                          key={item.key}
                          className="rounded-lg border border-primary/40 bg-primary/5 p-3"
                        >
                          <StudySessionEditor
                            plan={studyPlan}
                            sessionIndex={sessionIndex}
                            onSave={(updated) =>
                              handleSaveSession(sessionIndex, updated)
                            }
                            onCancel={() => setEditingIndex(null)}
                          />
                        </li>
                      );
                    }

                    return (
                      <li
                        key={item.key}
                        className={cn(
                          "flex gap-3 rounded-lg border-l-4 px-3 py-2",
                          item.kind === "study"
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card"
                        )}
                      >
                        <span className="w-24 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                          {item.start} – {item.end}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="wrap-break-word text-sm font-medium text-foreground">
                            {item.title}
                          </p>
                          {item.detail && (
                            <p className="wrap-break-word text-xs text-muted-foreground">
                              {item.detail}
                            </p>
                          )}

                          {/* Only study sessions can be changed; classes are fixed */}
                          {sessionIndex !== undefined && (
                            <div className="mt-1.5 flex gap-4">
                              <button
                                type="button"
                                disabled={isAdjusting}
                                onClick={() => setEditingIndex(sessionIndex)}
                                aria-label={`Edit the ${item.title} study session on ${DAY_NAMES[group.day]}`}
                                className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Pencil className="size-3" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={isAdjusting}
                                onClick={() => handleRemoveSession(sessionIndex)}
                                aria-label={`Remove the ${item.title} study session on ${DAY_NAMES[group.day]}`}
                                className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                              >
                                <Trash2 className="size-3" aria-hidden="true" />
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                        <span
                          className={cn(
                            "h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            item.kind === "study"
                              ? "bg-primary text-primary-foreground"
                              : "bg-border/60 text-muted-foreground"
                          )}
                        >
                          {item.badge}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

                    {/* Undo bar after sessions are removed */}
          {lastRemoved && (
            <div
              role="status"
              className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-xs"
            >
              <span className="text-muted-foreground">
                Removed {lastRemoved.session.course_name} (
                {DAY_NAMES[lastRemoved.session.day_of_week]}{" "}
                {lastRemoved.session.start_time})
                {removedStack.length > 1 &&
                  ` and ${removedStack.length - 1} more`}
                .
              </span>
              <span className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={handleUndoRemove}
                  className="font-semibold text-primary hover:underline"
                >
                  Undo
                </button>
                {removedStack.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRestoreAll}
                    className="font-semibold text-primary hover:underline"
                  >
                    Restore all
                  </button>
                )}
              </span>
            </div>
          )}

          {studyPlan.sessions.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              There are no study sessions left in your plan. Undo the removal,
              or change your preferences to build a new plan.
            </p>
          )}

          {/* Notes from the planner */}
          {warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

                    {/* Tell Lebid what to change */}
          <form onSubmit={handleAskAi} className="mt-5">
            <label
              htmlFor="ai-instruction"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Want something different? Tell Lebid
            </label>
            <div className="flex gap-2">
              <input
                id="ai-instruction"
                type="text"
                value={instruction}
                maxLength={500}
                disabled={isAdjusting}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. Move my Friday sessions to the evening"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-70"
              />
              <button
                type="submit"
                disabled={isAdjusting || instruction.trim().length === 0}
                aria-label="Send your request to Lebid"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background transition-all hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAdjusting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isAdjusting}
                  onClick={() => setInstruction(suggestion)}
                  className="rounded-full border border-input bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/60 hover:text-foreground disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {aiError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {aiError}
              </p>
            )}

            {aiResult && (
              <div
                role="status"
                className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground"
              >
                <p>{aiResult.message}</p>

                {aiResult.changes.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {aiResult.changes.map((change, index) => (
                      <li key={`${index}-${change}`}>{change}</li>
                    ))}
                  </ul>
                )}

                {aiResult.warnings.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-destructive">
                    {aiResult.warnings.map((warning, index) => (
                      <li key={`${index}-${warning}`}>{warning}</li>
                    ))}
                  </ul>
                )}

                {aiResult.changes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoAi}
                    className="mt-2 font-semibold text-primary hover:underline"
                  >
                    Undo this change
                  </button>
                )}
              </div>
            )}
          </form>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleMakeChanges}
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-input bg-background text-sm font-semibold text-foreground transition-all hover:border-primary/60 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2"
            >
              CHANGE PREFERENCES
            </button>
            <button
              type="button"
              onClick={handleLooksGood}
              disabled={studyPlan.sessions.length === 0 || isAdjusting}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              LOOKS GOOD
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </motion.div>

      <ThemeToggle />
    </main>
  );
}