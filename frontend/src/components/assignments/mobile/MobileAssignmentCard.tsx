import { Check, CheckCircle2, Circle, Trash2 } from "lucide-react";

import SwipeRow from "@/components/mobile/SwipeRow";
import type { Assignment } from "@/api/assignments";
import { formatDue, PRIORITY_STYLES } from "@/lib/taskFormat";
import { cn } from "@/lib/utils";

interface MobileAssignmentCardProps {
  assignment: Assignment;
  overdue?: boolean;
  onOpen: (assignment: Assignment) => void;
  onToggle: (assignment: Assignment) => void;
  onAskDelete: (assignment: Assignment) => void;
}

// One assignment. Swipe right = complete / reopen, swipe left = delete (asks first).
export default function MobileAssignmentCard({
  assignment,
  overdue = false,
  onOpen,
  onToggle,
  onAskDelete,
}: MobileAssignmentCardProps) {
  const done = assignment.status === "completed";

  return (
    <SwipeRow
      right={{
        label: done ? "Reopen" : "Complete",
        icon: <Check className="size-4" />,
        className: "bg-success text-white",
        onTrigger: () => onToggle(assignment),
      }}
      left={{
        label: "Delete",
        icon: <Trash2 className="size-4" />,
        className: "bg-destructive text-white",
        onTrigger: () => onAskDelete(assignment),
      }}
    >
      <div
        data-item-id={assignment.id}
        className={cn(
          "flex items-start gap-1 rounded-2xl border border-border bg-card py-2 pr-3 pl-1",
          done && "opacity-60",
          overdue && !done && "border-destructive/30 bg-destructive/[0.04]"
        )}
      >
        <button
          type="button"
          onClick={() => onToggle(assignment)}
          aria-label={done ? "Reopen assignment" : "Mark assignment complete"}
          className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"
        >
          {done ? (
            <CheckCircle2 className="size-6 text-success" />
          ) : (
            <Circle className="size-6" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpen(assignment)}
          className="min-w-0 flex-1 py-1.5 text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm leading-snug font-semibold",
                done && "text-muted-foreground line-through"
              )}
            >
              {assignment.title}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                PRIORITY_STYLES[assignment.priority]
              )}
            >
              {assignment.priority}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {assignment.course_code && (
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: (assignment.course_color ?? "#64748b") + "22",
                  color: assignment.course_color ?? "#64748b",
                }}
              >
                {assignment.course_code}
              </span>
            )}
            {assignment.deadline && (
              <span
                className={cn(
                  "text-xs",
                  overdue && !done
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {overdue && !done ? "Overdue · " : "Due "}
                {formatDue(assignment.deadline)}
              </span>
            )}
            {assignment.estimated_hours && (
              <span className="text-xs text-muted-foreground">
                ~{assignment.estimated_hours}h
              </span>
            )}
          </div>

          {assignment.description && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {assignment.description}
            </p>
          )}
        </button>
      </div>
    </SwipeRow>
  );
}