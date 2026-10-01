import { useState, useRef } from "react";
import { Upload, FileImage, Pencil, Trash2, CheckCircle, AlertTriangle, ChevronDown } from "lucide-react";

import { uploadTimetable, confirmImport } from "@/api/timetableImport";
import type { ExtractedEntry, ConfirmEntryRequest } from "@/api/timetableImport";
import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  // ── Upload handlers ────────────────────────────────────────────────────────

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

      setImportId(result.import_id);
      setExtractionNotes(result.extraction_notes);
      setExtractionMessage(result.message);
      setCourses(courseList);

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
        } catch (err: unknown) {
      const error = err as {
        response?: { status?: number; data?: { detail?: string } };
      };
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 429) {
        setUploadError(
          detail ?? "The AI service is busy. Please wait a moment and try again."
        );
      } else {
        setUploadError(
          detail ?? "Failed to process the timetable. Please try a clearer image."
        );
      }
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

  const handleConfirm = async () => {
    setConfirmError(null);

    // Validate — every row must have a course assigned
    const missing = drafts.filter((d) => !d.course_id);
    if (missing.length > 0) {
      setConfirmError(
        `${missing.length} row${missing.length === 1 ? " is" : "s are"} missing a course. Please assign a course to every entry, or delete entries you don't need.`
      );
      return;
    }

    if (drafts.length === 0) {
      setConfirmError("There are no entries to save. Add at least one entry.");
      return;
    }

    setConfirming(true);
    try {
      const entries: ConfirmEntryRequest[] = drafts.map((d) => ({
        course_id: d.course_id,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        venue: d.venue || null,
        lecturer: d.lecturer || null,
        class_type: d.class_type,
        notes: d.notes || null,
      }));

      const result = await confirmImport(importId, entries);
      setSavedCount(result.saved_count);
      setStage("done");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setConfirmError(
        error.response?.data?.detail ??
        "Failed to save entries. Please check your data and try again."
      );
    } finally {
      setConfirming(false);
    }
  };

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
              Check every entry, correct any errors, and assign each one to a
              course from your course list. Delete any entries that are wrong
              and can't be fixed.
            </p>
          </div>

          {/* No courses warning */}
          {courses.length === 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">
                You have no courses set up yet. Go to the Courses page and add
                your courses first, then come back to import your timetable.
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
            <Button
              variant="outline"
              onClick={() => {
                setStage("upload");
                setDrafts([]);
                setUploadError(null);
              }}
            >
              Upload a different file
            </Button>

            <Button
              onClick={handleConfirm}
              disabled={confirming || courses.length === 0}
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
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStage("upload");
                setDrafts([]);
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

  return (
    <div
      className={`rounded-xl border bg-card transition ${
        !draft.course_id
          ? "border-warning/20"
          : "border-border"
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

            {!draft.course_id && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                Needs a course
              </span>
            )}

            {draft.course_id && (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                {courses.find((c) => String(c.id) === draft.course_id)?.code ??
                  "Course assigned"}
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

          {/* Course assignment — most important field */}
          <div className="space-y-1.5">
            <Label>
              Assign to course{" "}
              <span className="text-destructive">*</span>
            </Label>
            <select
              value={draft.course_id}
              onChange={(e) => onChange({ course_id: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Select a course —</option>
              {courses.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

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
              <Input
                id={`start-${draft._id}`}
                type="time"
                value={draft.start_time}
                onChange={(e) => onChange({ start_time: e.target.value })}
              />
            </div>

            {/* End time */}
            <div className="space-y-1.5">
              <Label htmlFor={`end-${draft._id}`}>End time</Label>
              <Input
                id={`end-${draft._id}`}
                type="time"
                value={draft.end_time}
                onChange={(e) => onChange({ end_time: e.target.value })}
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