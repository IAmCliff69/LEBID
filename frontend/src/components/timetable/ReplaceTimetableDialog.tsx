import { useState } from "react";

import type { CourseUsage, ReplacePreview } from "@/api/timetableImport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReplaceTimetableDialogProps {
  preview: ReplacePreview;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (deleteCourseIds: string[]) => void;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

// "3 tasks, 1 exam, 5 study sessions"
function describeWork(course: CourseUsage): string {
  const parts: string[] = [];
  if (course.tasks) parts.push(plural(course.tasks, "task"));
  if (course.assignments) parts.push(plural(course.assignments, "assignment"));
  if (course.exams) parts.push(plural(course.exams, "exam"));
  if (course.study_sessions) parts.push(plural(course.study_sessions, "study session"));
  return parts.join(", ");
}

const courseLabel = (course: CourseUsage) =>
  course.code ? `${course.code} · ${course.name}` : course.name;

// Shown before a new timetable replaces the current one: it lists exactly what
// will change, and lets the student choose about courses that have work linked.
// (Render it only while a preview exists, so its ticks start fresh each time.)
export default function ReplaceTimetableDialog({
  preview,
  isSaving,
  onCancel,
  onConfirm,
}: ReplaceTimetableDialogProps) {
  // Courses with work that the student chose to delete (none by default)
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  const toggle = (id: string) =>
    setDeleteIds((previous) =>
      previous.includes(id)
        ? previous.filter((courseId) => courseId !== id)
        : [...previous, id]
    );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace your current timetable?</DialogTitle>
          <DialogDescription>
            Your new timetable will replace the one you have now. This can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            Your <strong>{plural(preview.existing_class_count, "class")}</strong>{" "}
            will be replaced by the{" "}
            <strong>{plural(preview.new_class_count, "class")}</strong> you just
            reviewed.
          </p>

          {preview.upcoming_ai_sessions_count > 0 && (
            <p>
              <strong>
                {plural(preview.upcoming_ai_sessions_count, "upcoming study session")}
              </strong>{" "}
              that Lebid planned around the old timetable will be removed.
              Sessions you completed, or added yourself, stay.
            </p>
          )}

          {preview.courses_to_remove.length > 0 && (
            <div>
              <p>
                These courses are not in the new timetable and have nothing
                linked to them, so they will be removed:
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {preview.courses_to_remove.map((course) => (
                  <li key={course.id}>{courseLabel(course)}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.courses_with_work.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
              <p className="font-medium text-warning">
                These courses are not in the new timetable, but have work linked
                to them. They will be kept unless you tick them:
              </p>
              <ul className="mt-2 space-y-2">
                {preview.courses_with_work.map((course) => (
                  <li key={course.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 text-foreground">
                      <input
                        type="checkbox"
                        checked={deleteIds.includes(course.id)}
                        onChange={() => toggle(course.id)}
                        className="mt-0.5 size-4 accent-[var(--destructive)]"
                      />
                      <span>
                        <span className="block font-medium">
                          {courseLabel(course)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {describeWork(course)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Ticking a course deletes it together with all of that work.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm(deleteIds)}
            disabled={isSaving}
          >
            {isSaving ? "Replacing..." : "Replace timetable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}