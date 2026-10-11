import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { discardImport, saveReviewedEntries } from "@/api/timetableImport";
import type { ExtractedEntry } from "@/api/timetableImport";
import LebidLogo from "@/components/brand/LebidLogo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { useOnboarding } from "@/context/OnboardingContext";
import { formatTimeLabel } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CLASS_TYPES = [
  { value: "lecture", label: "Lecture" },
  { value: "tutorial", label: "Tutorial" },
  { value: "lab", label: "Lab" },
  { value: "practical", label: "Practical" },
  { value: "seminar", label: "Seminar" },
  { value: "other", label: "Other" },
];

const EMPTY_ENTRY: ExtractedEntry = {
  course_name: "",
  course_code: null,
  day_of_week: 0,
  start_time: "",
  end_time: "",
  venue: null,
  lecturer: null,
  class_type: "lecture",
};

const hhmm = (time: string) => time.slice(0, 5);

function getErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

// Which classes overlap another class on the same day (by their position in the list)?
function findOverlaps(entries: ExtractedEntry[]): Set<number> {
  const overlapping = new Set<number>();
  entries.forEach((a, i) => {
    entries.forEach((b, j) => {
      if (j <= i || a.day_of_week !== b.day_of_week) return;
      if (
        hhmm(a.start_time) < hhmm(b.end_time) &&
        hhmm(b.start_time) < hhmm(a.end_time)
      ) {
        overlapping.add(i);
        overlapping.add(j);
      }
    });
  });
  return overlapping;
}

// ---------------------------------------------------------------------------
// The pop-up for adding or changing one class
// ---------------------------------------------------------------------------
function ClassFormDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: ExtractedEntry | null; // null = adding a new class
  onSave: (entry: ExtractedEntry) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ExtractedEntry>(initial ?? EMPTY_ENTRY);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof ExtractedEntry>(
    key: K,
    value: ExtractedEntry[K]
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError(null);
  };

  const handleSave = () => {
    const name = form.course_name.trim();
    if (!name) {
      setError("Please enter the course name.");
      return;
    }
    if (!form.start_time || !form.end_time) {
      setError("Please choose a start time and an end time.");
      return;
    }
    if (hhmm(form.start_time) >= hhmm(form.end_time)) {
      setError("The class must end after it starts.");
      return;
    }

    onSave({
      ...form,
      course_name: name,
      course_code: form.course_code?.trim() || null,
      start_time: hhmm(form.start_time),
      end_time: hhmm(form.end_time),
      venue: form.venue?.trim() || null,
      lecturer: form.lecturer?.trim() || null,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit class" : "Add a class"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Fix anything Lebid read wrongly."
              : "Add a class that is missing from your timetable."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rv_name">Course name</Label>
            <Input
              id="rv_name"
              value={form.course_name}
              onChange={(event) => update("course_name", event.target.value)}
              placeholder="e.g. Operating Systems"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rv_code">Course code (optional)</Label>
            <Input
              id="rv_code"
              value={form.course_code ?? ""}
              onChange={(event) => update("course_code", event.target.value)}
              placeholder="e.g. COE 354"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rv_day">Day</Label>
              <select
                id="rv_day"
                value={form.day_of_week}
                onChange={(event) =>
                  update("day_of_week", Number(event.target.value))
                }
                className="h-[2.625rem] w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {DAY_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rv_type">Class type</Label>
              <select
                id="rv_type"
                value={form.class_type}
                onChange={(event) => update("class_type", event.target.value)}
                className="h-[2.625rem] w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {CLASS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rv_start">Starts</Label>
              <TimePicker
                id="rv_start"
                value={form.start_time ? hhmm(form.start_time) : ""}
                onChange={(value) => update("start_time", value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv_end">Ends</Label>
              <TimePicker
                id="rv_end"
                value={form.end_time ? hhmm(form.end_time) : ""}
                onChange={(value) => update("end_time", value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rv_venue">Venue (optional)</Label>
            <Input
              id="rv_venue"
              value={form.venue ?? ""}
              onChange={(event) => update("venue", event.target.value)}
              placeholder="e.g. Lecture Hall 2"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rv_lecturer">Lecturer (optional)</Label>
            <Input
              id="rv_lecturer"
              value={form.lecturer ?? ""}
              onChange={(event) => update("lecturer", event.target.value)}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            {initial ? "Save changes" : "Add class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------
export default function TimetableReviewPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { extraction, setExtraction, setTimetableFile } = useOnboarding();

  const [entries, setEntries] = useState<ExtractedEntry[]>(
    () => extraction?.extracted_entries ?? []
  );
  // null = pop-up closed; { index: null } = adding; { index: 3 } = editing the 4th class
  const [dialog, setDialog] = useState<{ index: number | null } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlaps = useMemo(() => findOverlaps(entries), [entries]);

  // Nothing to review (for example after a page refresh): start again.
  if (!extraction) {
    navigate("/onboarding/timetable", { replace: true });
    return null;
  }

  // The classes of each day, earliest first (keeping each one's place in the list)
  const dayGroups = DAY_NAMES.map((name, day) => ({
    day,
    name,
    items: entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.day_of_week === day)
      .sort((a, b) => hhmm(a.entry.start_time).localeCompare(hhmm(b.entry.start_time))),
  })).filter((group) => group.items.length > 0);

  const handleSaveEntry = (entry: ExtractedEntry) => {
    if (dialog === null) return;
    setEntries((previous) =>
      dialog.index === null
        ? [...previous, entry]
        : previous.map((item, i) => (i === dialog.index ? entry : item))
    );
    setDialog(null);
    setError(null);
  };

  const handleRemove = (index: number) => {
    setEntries((previous) => previous.filter((_, i) => i !== index));
    setError(null);
  };

  const handleChooseAnotherFile = () => {
    discardImport(extraction.import_id).catch(() => {
      // If this fails, it is simply offered again next time.
    });
    setTimetableFile(null);
    setExtraction(null);
    navigate("/onboarding/timetable", { replace: true });
  };

  const handleContinue = async () => {
    if (entries.length === 0) {
      setError(
        "Add at least one class to continue, or choose a different file."
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const updated = await saveReviewedEntries(extraction.import_id, entries);
      setExtraction(updated);
      navigate("/onboarding/study-preferences", { replace: true });
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "We couldn't save your changes. Please check your connection and try again."
        )
      );
    } finally {
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
        className="relative my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <LebidLogo className="w-16 sm:w-20" />
        </div>

        <div className="flex flex-col px-6 pb-8 pt-4 sm:px-8 sm:pb-10">
          <h1
            className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            style={friendlyFont}
          >
            Check your timetable
          </h1>
          <p className="mb-1 text-sm text-muted-foreground">
            This is what Lebid read from your file. Fix anything that looks
            wrong before we plan your study time around it.
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            <strong className="text-foreground">{entries.length}</strong>{" "}
            {entries.length === 1 ? "class" : "classes"} found.
          </p>

          {extraction.extraction_notes && (
            <p className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
              {extraction.extraction_notes}
            </p>
          )}

          {overlaps.size > 0 && (
            <p className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {overlaps.size} classes overlap each other. Check the ones marked
              below.
            </p>
          )}

          {/* The classes, day by day */}
          <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-border bg-background p-3">
            {dayGroups.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No classes yet. Add the ones you have.
              </p>
            )}

            {dayGroups.map((group) => (
              <section key={group.day} className="mb-4 last:mb-0">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.name}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map(({ entry, index }) => (
                    <li
                      key={`${index}-${entry.course_name}-${entry.start_time}`}
                      className={cn(
                        "flex gap-3 rounded-lg border-l-4 bg-card px-3 py-2",
                        overlaps.has(index) ? "border-warning" : "border-primary"
                      )}
                    >
                      <span className="w-28 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {formatTimeLabel(entry.start_time)} –{" "}
                        {formatTimeLabel(entry.end_time)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {entry.course_code ? `${entry.course_code} · ` : ""}
                          {entry.course_name}
                        </p>
                        <p className="truncate text-xs capitalize text-muted-foreground">
                          {entry.class_type}
                          {entry.venue ? ` · ${entry.venue}` : ""}
                          {entry.lecturer ? ` · ${entry.lecturer}` : ""}
                        </p>
                        {overlaps.has(index) && (
                          <p className="mt-0.5 text-[11px] font-medium text-warning">
                            Overlaps another class
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-start gap-1">
                        <button
                          type="button"
                          onClick={() => setDialog({ index })}
                          aria-label={`Edit ${entry.course_name} on ${group.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(index)}
                          aria-label={`Remove ${entry.course_name} on ${group.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setDialog({ index: null })}
            className="mt-3 flex items-center gap-1.5 self-start text-sm font-semibold text-primary transition hover:underline"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a class
          </button>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleContinue}
              disabled={isSaving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  SAVING...
                </>
              ) : (
                <>
                  LOOKS GOOD, CONTINUE
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleChooseAnotherFile}
              className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Choose a different file
            </button>
          </div>
        </div>
      </motion.div>

      <ThemeToggle />

      {dialog && (
        <ClassFormDialog
          initial={dialog.index === null ? null : entries[dialog.index]}
          onSave={handleSaveEntry}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}