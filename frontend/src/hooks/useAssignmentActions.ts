import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deleteAssignment, updateAssignment } from "@/api/assignments";
import type { Assignment, AssignmentStatus } from "@/api/assignments";

// Complete / reopen / delete an assignment, with toasts. Every change refreshes
// the shared ["assignments"] list (the planner, dashboard and More page use it too).
export function useAssignmentActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["assignments"] });

  const setStatus = async (
    assignment: Assignment,
    status: AssignmentStatus,
    withUndo = true
  ) => {
    const previous = assignment.status;
    try {
      await updateAssignment(assignment.id, { status });
      await refresh();
      toast.success(
        status === "completed" ? "Assignment completed" : "Assignment reopened",
        {
          description: assignment.title,
          action: withUndo
            ? { label: "Undo", onClick: () => void setStatus(assignment, previous, false) }
            : undefined,
        }
      );
    } catch {
      toast.error("Couldn't update the assignment", { description: "Please try again." });
    }
  };

  // Completed -> not started, anything else -> completed
  const toggle = (assignment: Assignment) =>
    setStatus(assignment, assignment.status === "completed" ? "not_started" : "completed");

  const remove = async (assignment: Assignment): Promise<boolean> => {
    try {
      await deleteAssignment(assignment.id);
      await refresh();
      toast.success("Assignment deleted", { description: assignment.title });
      return true;
    } catch {
      toast.error("Couldn't delete the assignment", { description: "Please try again." });
      return false;
    }
  };

  return { toggle, remove };
}