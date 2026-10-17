import { CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";

import BottomSheet from "@/components/mobile/BottomSheet";
import type { Task } from "@/api/tasks";
import { formatDue, formatDuration, isTaskOverdue, PRIORITY_STYLES } from "@/lib/taskFormat";
import { cn } from "@/lib/utils";

interface TaskSheetProps {
  task: Task | null;
  onClose: () => void;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onAskDelete: (task: Task) => void;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  overdue: "Overdue",
};

// The details of one task, with Mark complete, Edit and Delete.
export default function TaskSheet({
  task,
  onClose,
  onToggle,
  onEdit,
  onAskDelete,
}: TaskSheetProps) {
  const done = task?.status === "completed";
  const overdue = task ? isTaskOverdue(task) : false;

  return (
    <BottomSheet
      open={task !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Task details"
    >
      {task && (
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                  PRIORITY_STYLES[task.priority]
                )}
              >
                {task.priority}
              </span>
              {task.course_code && (
                <span
                  className="rounded px-1.5 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: (task.course_color ?? "#64748b") + "22",
                    color: task.course_color ?? "#64748b",
                  }}
                >
                  {task.course_code}
                </span>
              )}
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {overdue ? "Overdue" : (STATUS_LABELS[task.status] ?? task.status)}
              </span>
            </div>
            <h2 className={cn("mt-2 text-xl leading-snug font-bold", done && "line-through")}>
              {task.title}
            </h2>
          </div>

          <dl className="space-y-2 text-sm">
            {task.deadline && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Due</dt>
                <dd className={cn("text-right font-medium", overdue && "text-destructive")}>
                  {formatDue(task.deadline)}
                </dd>
              </div>
            )}
            {task.estimated_duration_minutes && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Estimated time</dt>
                <dd className="text-right font-medium">
                  {formatDuration(task.estimated_duration_minutes)}
                </dd>
              </div>
            )}
          </dl>

          {task.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Description</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
          {task.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{task.notes}</p>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onToggle(task);
                onClose();
              }}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {done ? (
                <RotateCcw className="size-4" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {done ? "Reopen task" : "Mark complete"}
            </button>
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onAskDelete(task)}
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