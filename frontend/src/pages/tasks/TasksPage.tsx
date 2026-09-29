import { useState, useEffect } from "react";

import AddTaskDialog from "@/components/tasks/AddTaskDialog";

import { getTasks, updateTask } from "@/api/tasks";

import type { Task } from "@/api/tasks";

import { ClipboardList, Circle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

// Priority badge colours
const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-50 text-blue-600",
  high: "bg-orange-50 text-orange-600",
  urgent: "bg-red-50 text-red-600",
};

// Format a deadline string into a readable date
function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await getTasks();
        setTasks(data);
      } catch {
        setError("Failed to load tasks. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const handleTaskAdded = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
  };

  // Toggle a task between completed and not_started
  const handleToggleComplete = async (task: Task) => {
    const newStatus =
      task.status === "completed" ? "not_started" : "completed";

    try {
      const updated = await updateTask(task.id, {
        status: newStatus,
      });

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? updated : t))
      );
    } catch {
      console.error("Failed to update task status");
    }
  };

  const incompleteTasks = tasks.filter(
    (t) => t.status !== "completed"
  );

  const completedTasks = tasks.filter(
    (t) => t.status === "completed"
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tasks</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Your academic and personal tasks.
          </p>
        </div>

        <AddTaskDialog onTaskAdded={handleTaskAdded} />
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-muted-foreground text-sm">
          Loading tasks...
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && tasks.length === 0 && (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <ClipboardList className="size-8 text-muted-foreground mx-auto mb-3" />

          <p className="text-sm font-medium">No tasks yet</p>

          <p className="text-muted-foreground text-xs mt-1">
            Add your first task to get started.
          </p>
        </div>
      )}

      {/* Incomplete tasks */}
      {!isLoading && incompleteTasks.length > 0 && (
        <div className="space-y-2">
          {incompleteTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={handleToggleComplete}
            />
          ))}
        </div>
      )}

      {/* Completed tasks */}
      {!isLoading && completedTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Completed
          </p>

          {completedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={handleToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual task card component
function TaskCard({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (task: Task) => void;
}) {
  const isCompleted = task.status === "completed";

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl px-4 py-3 flex items-start gap-3 transition-opacity",
        isCompleted && "opacity-50"
      )}
    >
      {/* Complete toggle */}
      <button
        onClick={() => onToggle(task)}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {isCompleted ? (
          <CheckCircle2 className="size-5 text-green-500" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm font-medium",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </p>

          {/* Priority badge */}
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
              PRIORITY_STYLES[task.priority]
            )}
          >
            {task.priority}
          </span>
        </div>

        {/* Course and deadline */}
        <div className="flex items-center gap-3 mt-1">
          {task.course_code && (
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor:
                  (task.course_color ?? "#64748b") + "22",
                color: task.course_color ?? "#64748b",
              }}
            >
              {task.course_code}
            </span>
          )}

          {task.deadline && (
            <span className="text-xs text-muted-foreground">
              Due {formatDeadline(task.deadline)}
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {task.description}
          </p>
        )}
      </div>
    </div>
  );
}
