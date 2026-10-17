import { Check, CheckCircle2, Circle, Trash2 } from "lucide-react";

import SwipeRow from "@/components/mobile/SwipeRow";
import type { Task } from "@/api/tasks";
import { formatDue, formatDuration, PRIORITY_STYLES } from "@/lib/taskFormat";
import { cn } from "@/lib/utils";

interface MobileTaskCardProps {
  task: Task;
  overdue?: boolean;
  onOpen: (task: Task) => void;
  onToggle: (task: Task) => void;
  onAskDelete: (task: Task) => void;
}

// One task. Swipe right = complete / reopen, swipe left = delete (asks first).
export default function MobileTaskCard({
  task,
  overdue = false,
  onOpen,
  onToggle,
  onAskDelete,
}: MobileTaskCardProps) {
  const done = task.status === "completed";

  return (
    <SwipeRow
      right={{
        label: done ? "Reopen" : "Complete",
        icon: <Check className="size-4" />,
        className: "bg-success text-white",
        onTrigger: () => onToggle(task),
      }}
      left={{
        label: "Delete",
        icon: <Trash2 className="size-4" />,
        className: "bg-destructive text-white",
        onTrigger: () => onAskDelete(task),
      }}
    >
      <div
        data-item-id={task.id}
        className={cn(
          "flex items-start gap-1 rounded-2xl border border-border bg-card py-2 pr-3 pl-1",
          done && "opacity-60",
          overdue && !done && "border-destructive/30 bg-destructive/[0.04]"
        )}
      >
        {/* Complete toggle (a big tap target) */}
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-label={done ? "Reopen task" : "Mark task complete"}
          className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"
        >
          {done ? (
            <CheckCircle2 className="size-6 text-success" />
          ) : (
            <Circle className="size-6" />
          )}
        </button>

        {/* Task info: tap to open the details sheet */}
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="min-w-0 flex-1 py-1.5 text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm leading-snug font-semibold",
                done && "text-muted-foreground line-through"
              )}
            >
              {task.title}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                PRIORITY_STYLES[task.priority]
              )}
            >
              {task.priority}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {task.course_code && (
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: (task.course_color ?? "#64748b") + "22",
                  color: task.course_color ?? "#64748b",
                }}
              >
                {task.course_code}
              </span>
            )}
            {task.deadline && (
              <span
                className={cn(
                  "text-xs",
                  overdue && !done
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {overdue && !done ? "Overdue · " : "Due "}
                {formatDue(task.deadline)}
              </span>
            )}
            {task.estimated_duration_minutes && (
              <span className="text-xs text-muted-foreground">
                ~{formatDuration(task.estimated_duration_minutes)}
              </span>
            )}
          </div>

          {task.description && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{task.description}</p>
          )}
        </button>
      </div>
    </SwipeRow>
  );
}