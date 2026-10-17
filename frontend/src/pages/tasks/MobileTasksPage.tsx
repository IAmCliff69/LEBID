import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, ChevronDown, ClipboardList, Plus } from "lucide-react";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import MobileTaskCard from "@/components/tasks/mobile/MobileTaskCard";
import TaskFormSheet from "@/components/tasks/mobile/TaskFormSheet";
import TaskSheet from "@/components/tasks/mobile/TaskSheet";
import { getTasks } from "@/api/tasks";
import type { Task } from "@/api/tasks";
import { useHighlightItem } from "@/hooks/useHighlightItem";
import { useTaskActions } from "@/hooks/useTaskActions";
import { isTaskOverdue, sortByDeadline } from "@/lib/taskFormat";
import { cn } from "@/lib/utils";

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

// The phone version of the Tasks page.
export default function MobileTasksPage() {
  const [params] = useSearchParams();
  const { toggle, remove } = useTaskActions();
  const query = useQuery({ queryKey: ["tasks"], queryFn: getTasks });
  useHighlightItem(!query.isLoading);

  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formTask, setFormTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const tasks = query.data ?? [];
  const openTask = tasks.find((t) => t.id === openId) ?? null;

  const incomplete = tasks.filter((t) => t.status !== "completed");
  const overdue = sortByDeadline(incomplete.filter(isTaskOverdue));
  const others = sortByDeadline(incomplete.filter((t) => !isTaskOverdue(t)));
  const completed = sortByDeadline(tasks.filter((t) => t.status === "completed"));

  // A link to a finished task opens the Completed section so it can be shown
  const highlightId = params.get("highlight");
  const doneExpanded = showDone || completed.some((t) => t.id === highlightId);

  const openAdd = () => {
    setFormTask(null);
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setOpenId(null);
    setFormTask(task);
    setFormOpen(true);
  };

  const askDelete = (task: Task) => {
    setOpenId(null);
    setTaskToDelete(task);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    await remove(taskToDelete);
    setIsDeleting(false);
    setTaskToDelete(null);
  };

  const renderCard = (task: Task, isOverdue = false) => (
    <MobileTaskCard
      key={task.id}
      task={task}
      overdue={isOverdue}
      onOpen={(t) => setOpenId(t.id)}
      onToggle={(t) => void toggle(t)}
      onAskDelete={askDelete}
    />
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight" style={friendlyFont}>
            Tasks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your academic and personal tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Task
        </button>
      </div>

      {/* Loading */}
      {query.isLoading && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {/* Error */}
      {query.isError && (
        <div className="rounded-2xl bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">
            Failed to load tasks. Please refresh the page.
          </p>
        </div>
      )}

      {/* Empty */}
      {!query.isLoading && !query.isError && tasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <ClipboardList className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No tasks yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first task to get started.
          </p>
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <section className="space-y-2" aria-label="Overdue tasks">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
            <p className="text-xs font-semibold tracking-wide text-destructive uppercase">
              Overdue
            </p>
            <span className="text-xs text-muted-foreground">({overdue.length})</span>
          </div>
          {overdue.map((task) => renderCard(task, true))}
        </section>
      )}

      {/* Other tasks (the label only shows when there are overdue ones) */}
      {others.length > 0 && (
        <section className="space-y-2" aria-label="Tasks">
          {overdue.length > 0 && (
            <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Other Tasks
            </p>
          )}
          {others.map((task) => renderCard(task))}
        </section>
      )}

      {/* Completed (collapsed) */}
      {completed.length > 0 && (
        <section className="space-y-2" aria-label="Completed tasks">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={doneExpanded}
            className="flex min-h-11 w-full items-center justify-between px-1"
          >
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Completed ({completed.length})
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                doneExpanded && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
          {doneExpanded && completed.map((task) => renderCard(task))}
        </section>
      )}

      {/* Sheets and dialogs */}
      <TaskSheet
        task={openTask}
        onClose={() => setOpenId(null)}
        onToggle={(t) => void toggle(t)}
        onEdit={openEdit}
        onAskDelete={askDelete}
      />
      <TaskFormSheet open={formOpen} onOpenChange={setFormOpen} task={formTask} />
      <ConfirmDialog
        open={taskToDelete !== null}
        title="Delete this task?"
        description={`"${taskToDelete?.title ?? ""}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete task"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setTaskToDelete(null)}
      />
    </div>
  );
}