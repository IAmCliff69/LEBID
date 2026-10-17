import { CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";

import BottomSheet from "@/components/mobile/BottomSheet";
import type { Assignment } from "@/api/assignments";
import { formatDue, isTaskOverdue, PRIORITY_STYLES } from "@/lib/taskFormat";
import { cn } from "@/lib/utils";

interface AssignmentSheetProps {
  assignment: Assignment | null;
  onClose: () => void;
  onToggle: (assignment: Assignment) => void;
  onEdit: (assignment: Assignment) => void;
  onAskDelete: (assignment: Assignment) => void;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  overdue: "Overdue",
};

// The details of one assignment, with Mark complete, Edit and Delete.
export default function AssignmentSheet({
  assignment,
  onClose,
  onToggle,
  onEdit,
  onAskDelete,
}: AssignmentSheetProps) {
  const done = assignment?.status === "completed";
  const overdue = assignment ? isTaskOverdue(assignment) : false;

  return (
    <BottomSheet
      open={assignment !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Assignment details"
    >
      {assignment && (
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                  PRIORITY_STYLES[assignment.priority]
                )}
              >
                {assignment.priority}
              </span>
              {assignment.course_code && (
                <span
                  className="rounded px-1.5 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: (assignment.course_color ?? "#64748b") + "22",
                    color: assignment.course_color ?? "#64748b",
                  }}
                >
                  {assignment.course_code}
                </span>
              )}
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {overdue ? "Overdue" : (STATUS_LABELS[assignment.status] ?? assignment.status)}
              </span>
            </div>
            <h2 className={cn("mt-2 text-xl leading-snug font-bold", done && "line-through")}>
              {assignment.title}
            </h2>
          </div>

          <dl className="space-y-2 text-sm">
            {assignment.date_assigned && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Date assigned</dt>
                <dd className="text-right font-medium">{formatDue(assignment.date_assigned)}</dd>
              </div>
            )}
            {assignment.deadline && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Deadline</dt>
                <dd className={cn("text-right font-medium", overdue && "text-destructive")}>
                  {formatDue(assignment.deadline)}
                </dd>
              </div>
            )}
            {assignment.estimated_hours && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Estimated work</dt>
                <dd className="text-right font-medium">{assignment.estimated_hours} h</dd>
              </div>
            )}
          </dl>

          {assignment.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Description</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{assignment.description}</p>
            </div>
          )}
          {assignment.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{assignment.notes}</p>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onToggle(assignment);
                onClose();
              }}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {done ? (
                <RotateCcw className="size-4" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {done ? "Reopen assignment" : "Mark complete"}
            </button>
            <button
              type="button"
              onClick={() => onEdit(assignment)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onAskDelete(assignment)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}