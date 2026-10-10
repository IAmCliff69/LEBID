import { useState, useEffect } from "react";
import { toast } from "sonner";
import AddAssignmentDialog from "@/components/assignments/AddAssignmentDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useHighlightItem } from "@/hooks/useHighlightItem";
import {
  getAssignments,
  updateAssignment,
  deleteAssignment,
} from "@/api/assignments";

import type { Assignment } from "@/api/assignments";

import {
  BookOpen,
  Circle,
  CheckCircle2,
  Trash2,
  CalendarClock,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-secondary-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// An assignment is upcoming when:
// - it is not completed
// - it has a deadline
// - its deadline has not passed
function isUpcoming(assignment: Assignment): boolean {
  if (
    assignment.status === "completed" ||
    !assignment.deadline
  ) {
    return false;
  }

  return new Date(assignment.deadline).getTime() >= Date.now();
}

// An assignment is overdue when:
// - it is not completed
// - it has a deadline
// - its deadline has already passed
function isOverdue(assignment: Assignment): boolean {
  if (
    assignment.status === "completed" ||
    !assignment.deadline
  ) {
    return false;
  }

  return new Date(assignment.deadline).getTime() < Date.now();
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useHighlightItem(!isLoading);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] =
    useState<Assignment | null>(null);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const data = await getAssignments();
        setAssignments(data);
      } catch {
        setError(
          "Failed to load assignments. Please refresh the page."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignments();
  }, []);

    const handleAssignmentAdded = (assignment: Assignment) => {
    setAssignments((prev) => [assignment, ...prev]);
    toast.success("Assignment added", { description: assignment.title });
  };

  const handleToggleComplete = async (
    assignment: Assignment
  ) => {
    const newStatus =
      assignment.status === "completed"
        ? "not_started"
        : "completed";

    try {
      const updated = await updateAssignment(assignment.id, {
        status: newStatus,
      });

      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignment.id ? updated : a
        )
      );
      toast.success(
        newStatus === "completed"
          ? "Assignment completed"
          : "Assignment reopened",
        { description: assignment.title }
      );
    } catch {
      toast.error("Couldn't update the assignment", {
        description: "Please try again.",
      });
    }
  };

    // Step 1: the trash button only opens the confirmation dialog.
  const handleDelete = (assignment: Assignment) => {
    setAssignmentToDelete(assignment);
  };

  // Step 2: runs when the student confirms in the dialog.
  const confirmDelete = async () => {
    if (!assignmentToDelete) return;
    const assignment = assignmentToDelete;

    setDeletingId(assignment.id);

    try {
      await deleteAssignment(assignment.id);

      setAssignments((prev) =>
        prev.filter((a) => a.id !== assignment.id)
      );
      toast.success("Assignment deleted", {
        description: assignment.title,
      });
    } catch {
      toast.error("Couldn't delete the assignment", {
        description: "Please try again.",
      });
    } finally {
      setDeletingId(null);
      setAssignmentToDelete(null);
    }
  };

  // Upcoming assignments
  const upcomingAssignments = assignments.filter(
    isUpcoming
  );

  // Overdue assignments
  const overdueAssignments = assignments.filter(
    isOverdue
  );

  // Completed assignments
  const completedAssignments = assignments.filter(
    (assignment) => assignment.status === "completed"
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Assignments
          </h2>

          <p className="text-muted-foreground text-sm mt-1">
            Track your assignments and submission deadlines.
          </p>
        </div>
        <ConfirmDialog
          open={assignmentToDelete !== null}
          title="Delete this assignment?"
          description={`"${assignmentToDelete?.title ?? ""}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete assignment"
          isLoading={deletingId !== null}
          onConfirm={confirmDelete}
          onCancel={() => setAssignmentToDelete(null)}
        />
        <AddAssignmentDialog
          onAssignmentAdded={handleAssignmentAdded}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-muted-foreground text-sm">
          Loading assignments...
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <p className="text-destructive text-sm">
            {error}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading &&
        !error &&
        assignments.length === 0 && (
          <div className="border border-dashed border-border rounded-2xl p-12 text-center">
            <BookOpen className="size-8 text-muted-foreground mx-auto mb-3" />

            <p className="text-sm font-medium">
              No assignments yet
            </p>

            <p className="text-muted-foreground text-xs mt-1">
              Add your first assignment to get started.
            </p>
          </div>
        )}

      {/* Upcoming assignments */}
      {!isLoading && upcomingAssignments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <CalendarClock className="size-4 text-primary" />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Upcoming
            </p>

            <span className="text-xs text-muted-foreground">
              ({upcomingAssignments.length})
            </span>
          </div>

          {upcomingAssignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onToggle={handleToggleComplete}
              onDelete={handleDelete}
              isDeleting={
                deletingId === assignment.id
              }
            />
          ))}
        </div>
      )}

      {/* Overdue assignments */}
      {!isLoading && overdueAssignments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="size-4 text-destructive" />

            <p className="text-xs font-medium text-destructive uppercase tracking-wide">
              Overdue
            </p>

            <span className="text-xs text-muted-foreground">
              ({overdueAssignments.length})
            </span>
          </div>

          {overdueAssignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onToggle={handleToggleComplete}
              onDelete={handleDelete}
              isDeleting={
                deletingId === assignment.id
              }
              isOverdue
            />
          ))}
        </div>
      )}

      {/* Completed assignments */}
      {!isLoading &&
        completedAssignments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              Completed
            </p>

            {completedAssignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onToggle={handleToggleComplete}
                onDelete={handleDelete}
                isDeleting={
                  deletingId === assignment.id
                }
              />
            ))}
          </div>
        )}

      {/* No active assignments */}
      {!isLoading &&
        !error &&
        assignments.length > 0 &&
        upcomingAssignments.length === 0 &&
        overdueAssignments.length === 0 &&
        completedAssignments.length > 0 && (
          <div className="border border-dashed border-border rounded-2xl p-10 text-center">
            <CheckCircle2 className="size-7 text-muted-foreground mx-auto mb-3" />

            <p className="text-sm font-medium">
              All assignments completed
            </p>

            <p className="text-muted-foreground text-xs mt-1">
              Nice work. You have no pending assignments.
            </p>
          </div>
        )}
    </div>
  );
}

function AssignmentCard({
  assignment,
  onToggle,
  onDelete,
  isDeleting,
  isOverdue: overdue = false,
}: {
  assignment: Assignment;
  onToggle: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
  isDeleting: boolean;
  isOverdue?: boolean;
}) {
  const isCompleted = assignment.status === "completed";

  return (
      <div
      data-item-id={assignment.id}
      className={cn(
        "bg-card border border-border rounded-xl px-4 py-3 flex items-start gap-3 transition-opacity",
        isCompleted && "opacity-50",
        overdue &&
          !isCompleted &&
          "border-destructive/30 bg-destructive/[0.03]"
      )}
    >
      {/* Complete toggle */}
      <button
        onClick={() => onToggle(assignment)}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {isCompleted ? (
          <CheckCircle2 className="size-5 text-success" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>

      {/* Assignment info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm font-medium",
              isCompleted &&
                "line-through text-muted-foreground"
            )}
          >
            {assignment.title}
          </p>

          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
              PRIORITY_STYLES[assignment.priority]
            )}
          >
            {assignment.priority}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1">
          {assignment.course_code && (
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor:
                  (assignment.course_color ??
                    "#64748b") + "22",
                color:
                  assignment.course_color ??
                  "#64748b",
              }}
            >
              {assignment.course_code}
            </span>
          )}

          {assignment.deadline && (
            <span
              className={cn(
                "text-xs",
                overdue && !isCompleted
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {overdue && !isCompleted
                ? "Overdue · "
                : "Due "}
              {formatDeadline(assignment.deadline)}
            </span>
          )}

          {assignment.estimated_hours && (
            <span className="text-xs text-muted-foreground">
              ~{assignment.estimated_hours}h estimated
            </span>
          )}
        </div>

        {assignment.description && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {assignment.description}
          </p>
        )}
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(assignment)}
        disabled={isDeleting}
        className="shrink-0 text-muted-foreground hover:text-destructive px-2"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
