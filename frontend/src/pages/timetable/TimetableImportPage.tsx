import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Pencil, Trash2, CheckCircle, AlertTriangle, ChevronDown } from "lucide-react";

import {
  uploadTimetable,
  confirmImport,
  getPendingImport,
  discardImport,
  previewReplace,
} from "@/api/timetableImport";
import type {
  ExtractedEntry,
  ConfirmEntryRequest,
  ExtractionResponse,
  PendingImport,
  ReplacePreview,
} from "@/api/timetableImport";
import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import ReplaceTimetableDialog from "@/components/timetable/ReplaceTimetableDialog";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const CLASS_TYPES = ["lecture", "tutorial", "lab", "practical", "other"];

// ─── Types ────────────────────────────────────────────────────────────────────

// A draft row in the review table — includes the extracted data plus the
// student's edits and their chosen course_id.
interface DraftEntry extends ExtractedEntry {
  _id: number;           // local row id for React keys
  course_id: string;     // filled by the student during review
  notes: string;
  _editing: boolean;
}

type Stage = "upload" | "review" | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
}

function normalise(text: string | null | undefined): string {
  return (text ?? "").trim().toLowerCase();
}

// Same rule as the server: match by course code, or by name when there is no code.
function findMatchingCourse(
  courses: Course[],
  name: string,
  code: string | null
): Course | undefined {
  const codeKey = normalise(code);
  if (codeKey) return courses.find((c) => normalise(c.code) === codeKey);

  const nameKey = normalise(name);
  if (!nameKey) return undefined;
  return courses.find((c) => normalise(c.name) === nameKey);
}

// The courses that confirming will create (rows with no match among your courses).
function getNewCourseLabels(
  drafts: { course_id: string; course_name: string; course_code: string | null }[],
  courses: Course[]
): string[] {
  const labels = new Map<string, string>();

  for (const d of drafts) {
    const name = d.course_name.trim();
    if (d.course_id || !name) continue;
    if (findMatchingCourse(courses, name, d.course_code)) continue;

    const key = `${normalise(d.course_code)}|${normalise(name)}`;
    if (!labels.has(key)) {
      labels.set(key, d.course_code?.trim() ? `${d.course_code.trim()} ${name}` : name);
    }
  }

  return Array.from(labels.values());
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TimetableImportPage() {
  const [stage, setStage] = useState<Stage>("upload");

  // Upload stage
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review stage
  const [importId, setImportId] = useState<string>("");
  const [extractionNotes, setExtractionNotes] = useState<string | null>(null);
  const [extractionMessage, setExtractionMessage] = useState<string>("");
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Done stage
  const [savedCount, setSavedCount] = useState(0);

  const [coursesCreated, setCoursesCreated] = useState(0);
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);
    // A summary of what replacing the old timetable removed (shown when done)
  const [replaceSummary, setReplaceSummary] = useState("");
  // The "replace your timetable?" pop-up
  const [replacePreview, setReplacePreview] = useState<ReplacePreview | null>(null);
  const [pendingEntries, setPendingEntries] = useState<ConfirmEntryRequest[]>([]);
  const queryClient = useQueryClient();

  // An earlier upload that was never confirmed (so it can be resumed)
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPendingImport()
      .then((result) => {
        if (!cancelled) setPending(result);
      })
      .catch(() => {
        // Not important enough to bother the student with.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Upload handlers ────────────────────────────────────────────────────────

    // Shows the review screen for an extraction (a fresh upload or a resumed one).
  const startReview = (result: ExtractionResponse, courseList: Course[]) => {
    setImportId(result.import_id);
    setExtractionNotes(result.extraction_notes);
    setExtractionMessage(result.message);
    setCourses(courseList);
    setPending(null);

    // Build draft rows from extracted entries
    setDrafts(
      result.extracted_entries.map((entry, i) => ({
        ...entry,
        _id: i,
        course_id: "",
        notes: "",
        _editing: false,
      }))
    );

    setStage("review");
  };

  const handleResume = async () => {
    if (!pending) return;
    setResuming(true);
    setUploadError(null);
    try {
      const courseList = await getCourses();
      startReview(pending, courseList);
    } catch {
      setUploadError("We couldn't load your earlier upload. Please try again.");
    } finally {
      setResuming(false);
    }
  };

  const handleDiscard = async () => {
    if (!pending) return;
    try {
      await discardImport(pending.import_id);
    } catch {
      // If this fails the banner simply shows again next time.
    }
    setPending(null);
  };

    // "Upload a different file": also throw the current upload away on the
  // server, so it is not offered again later as an "unfinished upload".
  const handleUploadDifferent = async () => {
    const abandonedId = importId;

    setStage("upload");
    setDrafts([]);
    setImportId("");
    setUploadError(null);
    setConfirmError(null);

    if (!abandonedId) return;
    try {
      await discardImport(abandonedId);
    } catch {
      // If this fails, the upload is simply offered again next time.
    }
  };

  const processFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setUploadError("Unsupported file type. Please upload a JPEG, PNG, WebP, or PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 10MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const [result, courseList] = await Promise.all([
        uploadTimetable(file),
        getCourses(),
      ]);

      startReview(result, courseList);
    } catch (error: unknown) {
      let status: unknown;
      let detail: unknown;

      if (typeof error === "object" && error !== null && "response" in error) {
        const response = (
          error as {
            response?: {
              status?: unknown;
              data?: { detail?: unknown };
            };
          }
        ).response;
        status = response?.status;
        detail = response?.data?.detail;
      }

      const fallback =
        status === 429
          ? "The AI service is busy. Please wait a moment and try again."
          : "Failed to process the timetable. Please try a clearer image.";
      setUploadError(typeof detail === "string" ? detail : fallback);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Draft row helpers ──────────────────────────────────────────────────────

  const updateDraft = (id: number, patch: Partial<DraftEntry>) => {
    setDrafts((prev) =>
      prev.map((d) => (d._id === id ? { ...d, ...patch } : d))
    );
  };

  const removeDraft = (id: number) => {
    setDrafts((prev) => prev.filter((d) => d._id !== id));
  };

  const addBlankRow = () => {
    const newId = Math.max(0, ...drafts.map((d) => d._id)) + 1;
    setDrafts((prev) => [
      ...prev,
      {
        _id: newId,
        course_name: "",
        course_code: null,
        day_of_week: 0,
        start_time: "08:00",
        end_time: "09:00",
        venue: "",
        lecturer: "",
        class_type: "lecture",
        course_id: "",
        notes: "",
        _editing: true,
      },
    ]);
  };

  // ── Confirm handler ────────────────────────────────────────────────────────

      const getErrorText = (err: unknown): string => {
    const error = err as { response?: { data?: { detail?: string } } };
    return (
      error.response?.data?.detail ??
      "Failed to save entries. Please check your data and try again."
    );
  };

  // Saves the entries and moves to the "done" screen
  const saveTimetable = async (
    entries: ConfirmEntryRequest[],
    options: { replace_existing?: boolean; delete_course_ids?: string[] } = {}
  ) => {
    const result = await confirmImport(importId, entries, options);
    setSavedCount(result.saved_count);
    setCoursesCreated(result.courses_created);
    setDuplicatesSkipped(result.duplicates_skipped);

    // What the replacement removed, in plain words
    const parts: string[] = [];
    if (result.classes_removed > 0) {
      parts.push(
        `${result.classes_removed} old class${result.classes_removed === 1 ? " was" : "es were"} replaced`
      );
    }
    if (result.sessions_removed > 0) {
      parts.push(
        `${result.sessions_removed} upcoming study session${result.sessions_removed === 1 ? "" : "s"} planned around the old timetable ${result.sessions_removed === 1 ? "was" : "were"} removed. You can ask the AI Assistant to plan new ones`
      );
    }
    if (result.courses_removed > 0) {
      parts.push(
        `${result.courses_removed} course${result.courses_removed === 1 ? "" : "s"} no longer in your timetable ${result.courses_removed === 1 ? "was" : "were"} removed`
      );
    }
    if (result.courses_kept > 0) {
      parts.push(
        `${result.courses_kept} course${result.courses_kept === 1 ? "" : "s"} not in the new timetable ${result.courses_kept === 1 ? "was" : "were"} kept because ${result.courses_kept === 1 ? "it still has" : "they still have"} work linked`
      );
    }
    setReplaceSummary(parts.length > 0 ? `${parts.join(". ")}.` : "");

    setPending(null);

    // Make the rest of the app (dashboard, planner, courses, ...) show the new data
    await queryClient.invalidateQueries();

    setStage("done");
  };

  const handleConfirm = async () => {
    setConfirmError(null);

    if (drafts.length === 0) {
      setConfirmError("There are no entries to save. Add at least one entry.");
      return;
    }

    // Every row needs a course: one you picked, or a course name Lebid can
    // match to your courses or create.
    const missing = drafts.filter((d) => !d.course_id && !d.course_name.trim());
    if (missing.length > 0) {
      setConfirmError(
        `${missing.length} row${missing.length === 1 ? " needs" : "s need"} a course name. Open Edit on ${missing.length === 1 ? "that row" : "those rows"} and enter the course name, or delete entries you don't need.`
      );
      return;
    }

    setConfirming(true);
    try {
      const entries: ConfirmEntryRequest[] = drafts.map((d) => ({
        course_id: d.course_id || null,
        course_name: d.course_id ? null : d.course_name.trim(),
        course_code: d.course_id ? null : d.course_code?.trim() || null,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        venue: d.venue || null,
        lecturer: d.lecturer || null,
        class_type: d.class_type,
        notes: d.notes || null,
      }));

      // Already have a timetable? Then ask before replacing it.
      const preview = await previewReplace(importId, entries);
      if (preview.existing_class_count > 0) {
        setPendingEntries(entries);
        setReplacePreview(preview);
        return; // the pop-up takes it from here
      }

      await saveTimetable(entries);
    } catch (err: unknown) {
      setConfirmError(getErrorText(err));
    } finally {
      setConfirming(false);
    }
  };

  // The student agreed in the pop-up: replace the old timetable
  const handleReplaceConfirmed = async (deleteCourseIds: string[]) => {
    setConfirming(true);
    try {
      await saveTimetable(pendingEntries, {
        replace_existing: true,
        delete_course_ids: deleteCourseIds,
      });
      setReplacePreview(null);
    } catch (err: unknown) {
      setReplacePreview(null);
      setConfirmError(getErrorText(err));
    } finally {
      setConfirming(false);
    }
  };

  // Courses that confirming will create automatically
  const newCourseLabels = getNewCourseLabels(drafts, courses);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Import Timetable</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Upload your timetable image or PDF and Lebid will extract your
          classes automatically.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["upload", "review", "done"] as Stage[]).map((s, i) => {
          const labels = ["Upload", "Review & edit", "Done"];
          const active = s === stage;
          const past =
            (stage === "review" && s === "upload") ||
            (stage === "done" && s !== "done");
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : past
                      ? "bg-success text-success-foreground"
                      : "bg-border text-muted-foreground"
                }`}
              >
                {past ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {labels[i]}
              </span>
              {i < 2 && (
                <div className="mx-1 h-px w-8 bg-border" />
              )}
            </div>
          );
        })}
      </div>

      {/* ── STAGE: UPLOAD ──────────────────────────────────────────────────── */}

      {stage === "upload" && (
        <div className="space-y-4">
                    {/* An earlier upload that was not confirmed */}
          {pending && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
              <p className="text-sm font-semibold text-foreground">
                You have an unfinished upload
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pending.original_filename} ·{" "}
                {pending.extracted_entries.length} class
                {pending.extracted_entries.length === 1 ? "" : "es"} found ·
                uploaded {new Date(pending.created_at).toLocaleDateString()}.
                Continue where you left off, with no need to upload it again.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button onClick={handleResume} disabled={resuming || uploading}>
                  {resuming ? "Loading..." : "Continue reviewing"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={resuming}
                >
                  Discard it
                </Button>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition ${
              dragOver
                ? "border-primary bg-background"
                : "border-border bg-muted hover:border-primary/40 hover:bg-background/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleFileInput}
            />

            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-2 border-border"
                  style={{ borderTopColor: "var(--primary)" }}
                />
                <p className="text-sm font-medium text-secondary-foreground">
                  Extracting your timetable...
                </p>
                <p className="text-xs text-muted-foreground">
                  This may take a few seconds.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}
                >
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Drop your timetable here
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    or click to browse — JPEG, PNG, WebP or PDF, up to 10MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-secondary bg-background px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-primary">
              For best results
            </p>
            <ul className="text-xs text-secondary-foreground space-y-0.5 list-disc list-inside">
              <li>Use a clear, well-lit photo if photographing a physical timetable.</li>
              <li>Make sure all text is readable and not cut off.</li>
              <li>A direct PDF download from your institution works best.</li>
              <li>You will be able to edit and correct anything after extraction.</li>
            </ul>
          </div>

          {/* Upload error */}
          {uploadError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{uploadError}</p>
            </div>
          )}
        </div>
      )}

      {/* ── STAGE: REVIEW ──────────────────────────────────────────────────── */}

      {stage === "review" && (
        <div className="space-y-5">

          {/* Extraction summary */}
          <div className="rounded-xl border border-secondary bg-background px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-primary">
              Extraction complete
            </p>
            <p className="text-xs text-secondary-foreground">{extractionMessage}</p>
            {extractionNotes && (
              <p className="text-xs text-warning mt-1">
                ⚠ {extractionNotes}
              </p>
            )}
          </div>

          {/* Important instructions */}
          <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3">
            <p className="text-xs font-semibold text-warning">
              Review carefully before confirming
            </p>
              <p className="text-xs text-warning mt-1 leading-relaxed">
              AI extraction can make mistakes, especially with unclear images.
              Check every entry and correct any errors, including the course
              names. Delete any entries that are wrong and can't be fixed.
            </p>
          </div>

          {/* Courses that will be created automatically */}
          {newCourseLabels.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-xs font-semibold text-primary">
                {newCourseLabels.length} new course
                {newCourseLabels.length === 1 ? "" : "s"} will be created
              </p>
              <p className="mt-1 text-xs leading-relaxed text-secondary-foreground">
                When you confirm, Lebid adds: {newCourseLabels.join(", ")}.
                Courses you already have are reused automatically.
              </p>
            </div>
          )}

          {/* Entry table */}
          {drafts.length > 0 && (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <EntryRow
                  key={draft._id}
                  draft={draft}
                  courses={courses}
                  onChange={(patch) => updateDraft(draft._id, patch)}
                  onRemove={() => removeDraft(draft._id)}
                />
              ))}
            </div>
          )}

          {drafts.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No entries. Add one manually below.
              </p>
            </div>
          )}

          {/* Add row button */}
          <Button variant="outline" onClick={addBlankRow} className="gap-2">
            <Upload className="h-4 w-4" />
            Add entry manually
          </Button>

          {/* Confirm error */}
          {confirmError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{confirmError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <Button variant="outline" onClick={handleUploadDifferent}>
              Upload a different file
            </Button>

            <Button
              onClick={handleConfirm}
              disabled={confirming || drafts.length === 0}
              className="gap-2"
            >
              {confirming ? "Saving..." : `Confirm ${drafts.length} entr${drafts.length === 1 ? "y" : "ies"}`}
            </Button>
          </div>
        </div>
      )}

      {/* ── STAGE: DONE ────────────────────────────────────────────────────── */}

      {stage === "done" && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}
          >
            <CheckCircle className="h-8 w-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground">
              Timetable imported successfully
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {savedCount} class entr{savedCount === 1 ? "y has" : "ies have"} been
              added to your timetable and will now appear in your planner.
              {coursesCreated > 0 &&
                ` ${coursesCreated} new course${coursesCreated === 1 ? " was" : "s were"} created for you.`}
              {duplicatesSkipped > 0 &&
                ` ${duplicatesSkipped} class${duplicatesSkipped === 1 ? " was" : "es were"} already in your timetable and ${duplicatesSkipped === 1 ? "was" : "were"} skipped.`}
              {replaceSummary && ` ${replaceSummary}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStage("upload");
                setDrafts([]);
                setReplaceSummary("");
                setImportId("");
                setUploadError(null);
                setConfirmError(null);
              }}
            >
              Import another timetable
            </Button>

            <Button
              onClick={() => window.location.assign("/timetable")}
            >
              View my timetable
            </Button>
          </div>
        </div>
      )}

      {replacePreview && (
        <ReplaceTimetableDialog
          preview={replacePreview}
          isSaving={confirming}
          onCancel={() => setReplacePreview(null)}
          onConfirm={handleReplaceConfirmed}
        />
      )}
    </div>
  );
}

// ─── EntryRow ─────────────────────────────────────────────────────────────────

interface EntryRowProps {
  draft: DraftEntry;
  courses: Course[];
  onChange: (patch: Partial<DraftEntry>) => void;
  onRemove: () => void;
}

function EntryRow({ draft, courses, onChange, onRemove }: EntryRowProps) {
  const [expanded, setExpanded] = useState(draft._editing);
  const matchedCourse = findMatchingCourse(
    courses,
    draft.course_name,
    draft.course_code
  );
  const needsName = !draft.course_id && !draft.course_name.trim();

  return (
    <div
      className={`rounded-xl border bg-card transition ${
                needsName ? "border-warning/20" : "border-border"
      }`}
    >
      {/* Row summary — always visible */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Day + time */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {DAYS[draft.day_of_week]}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(draft.start_time)} – {formatTime(draft.end_time)}
            </span>
            {draft.venue && (
              <span className="text-xs text-muted-foreground">· {draft.venue}</span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-secondary-foreground">
              {draft.course_name || "Unnamed course"}
            </span>

            {draft.course_id ? (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                {courses.find((c) => String(c.id) === draft.course_id)?.code ??
                  "Course assigned"}
              </span>
            ) : needsName ? (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                Needs a course name
              </span>
            ) : matchedCourse ? (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                Matches {matchedCourse.code || matchedCourse.name}
              </span>
            ) : (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                New course
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-destructive transition hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">

          {/* Course: matched or created automatically, unless you pick one */}
          <div className="space-y-1.5">
            <Label>Course</Label>
            <select
              value={draft.course_id}
              onChange={(e) => onChange({ course_id: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Automatic (match or create from the name below)</option>
              {courses.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {!draft.course_id && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`course-name-${draft._id}`}>
                  Course name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`course-name-${draft._id}`}
                  placeholder="e.g. Data Structures"
                  value={draft.course_name}
                  onChange={(e) => onChange({ course_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`course-code-${draft._id}`}>
                  Course code{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id={`course-code-${draft._id}`}
                  placeholder="e.g. COE 353"
                  value={draft.course_code ?? ""}
                  onChange={(e) =>
                    onChange({ course_code: e.target.value || null })
                  }
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Day */}
            <div className="space-y-1.5">
              <Label>Day</Label>
              <select
                value={draft.day_of_week}
                onChange={(e) =>
                  onChange({ day_of_week: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </div>

            {/* Class type */}
            <div className="space-y-1.5">
              <Label>Class type</Label>
              <select
                value={draft.class_type}
                onChange={(e) => onChange({ class_type: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CLASS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Start time */}
            <div className="space-y-1.5">
              <Label htmlFor={`start-${draft._id}`}>Start time</Label>
              <TimePicker
                id={`start-${draft._id}`}
                value={draft.start_time}
                onChange={(value) => onChange({ start_time: value })}
              />
            </div>

            {/* End time */}
            <div className="space-y-1.5">
              <Label htmlFor={`end-${draft._id}`}>End time</Label>
              <TimePicker
                id={`end-${draft._id}`}
                value={draft.end_time}
                onChange={(value) => onChange({ end_time: value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Venue */}
            <div className="space-y-1.5">
              <Label htmlFor={`venue-${draft._id}`}>
                Venue{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id={`venue-${draft._id}`}
                placeholder="e.g. LT1"
                value={draft.venue ?? ""}
                onChange={(e) => onChange({ venue: e.target.value })}
              />
            </div>

            {/* Lecturer */}
            <div className="space-y-1.5">
              <Label htmlFor={`lecturer-${draft._id}`}>
                Lecturer{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id={`lecturer-${draft._id}`}
                placeholder="e.g. Dr. Mensah"
                value={draft.lecturer ?? ""}
                onChange={(e) => onChange({ lecturer: e.target.value })}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor={`notes-${draft._id}`}>
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id={`notes-${draft._id}`}
              placeholder="Any notes about this class..."
              value={draft.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </div>

          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-medium text-primary transition hover:underline"
          >
            Done editing
          </button>
        </div>
      )}
    </div>
  );
}