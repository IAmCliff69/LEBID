import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deleteTask, updateTask } from "@/api/tasks";
import type { Task, TaskStatus } from "@/api/tasks";

// Complete / reopen / delete a task, with toasts. Every change refreshes the
// shared ["tasks"] list, so the planner and dashboard stay in step.
export function useTaskActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  const setStatus = async (task: Task, status: TaskStatus, withUndo = true) => {
    const previous = task.status;
    try {
      await updateTask(task.id, { status });
      await refresh();
      toast.success(status === "completed" ? "Task completed" : "Task reopened", {
        description: task.title,
        action: withUndo
          ? { label: "Undo", onClick: () => void setStatus(task, previous, false) }
          : undefined,
      });
    } catch {
      toast.error("Couldn't update the task", { description: "Please try again." });
    }
  };

  // Completed -> not started, anything else -> completed
  const toggle = (task: Task) =>
    setStatus(task, task.status === "completed" ? "not_started" : "completed");

  const remove = async (task: Task): Promise<boolean> => {
    try {
      await deleteTask(task.id);
      await refresh();
      toast.success("Task deleted", { description: task.title });
      return true;
    } catch {
      toast.error("Couldn't delete the task", { description: "Please try again." });
      return false;
    }
  };

  return { toggle, remove };
}