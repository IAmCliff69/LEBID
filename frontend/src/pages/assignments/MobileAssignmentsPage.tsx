import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, BookOpen, CalendarClock, ChevronDown, Plus } from "lucide-react";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import AssignmentFormSheet from "@/components/assignments/mobile/AssignmentFormSheet";
import AssignmentSheet from "@/components/assignments/mobile/AssignmentSheet";
import MobileAssignmentCard from "@/components/assignments/mobile/MobileAssignmentCard";
import { getAssignments } from "@/api/assignments";
import type { Assignment } from "@/api/assignments";
import { useAssignmentActions } from "@/hooks/useAssignmentActions";
import { useHighlightItem } from "@/hooks/useHighlightItem";
import { isTaskOverdue, sortByDeadline } from "@/lib/taskFormat";
import { cn } from "@/lib/utils";

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

// The phone version of the Assignments page.
export default function MobileAssignmentsPage() {
  const [params] = useSearchParams();
  const { toggle, remove } = useAssignmentActions();
  const query = useQuery({ queryKey: ["assignments"], queryFn: getAssignments });
  useHighlightItem(!query.isLoading);

  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formAssignment, setFormAssignment] = useState<Assignment | null>(null);
  const [toDelete, setToDelete] = useState<Assignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const assignments = query.data ?? [];
  const openAssignment = assignments.find((a) => a.id === openId) ?? null;

  const open = assignments.filter((a) => a.status !== "completed");
  const overdue = sortByDeadline(open.filter(isTaskOverdue));
  const upcoming = sortByDeadline(open.filter((a) => !isTaskOverdue(a)));
  const completed = sortByDeadline(assignments.filter((a) => a.status === "completed"));

  // A link to a finished assignment opens the Completed section so it can be shown
  const highlightId = params.get("highlight");
  const doneExpanded = showDone || completed.some((a) => a.id === highlightId);

  const openAdd = () => {
    setFormAssignment(null);
    setFormOpen(true);
  };

  const openEdit = (assignment: Assignment) => {
    setOpenId(null);
    setFormAssignment(assignment);
    setFormOpen(true);
  };

  const askDelete = (assignment: Assignment) => {
    setOpenId(null);
    setToDelete(assignment);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    await remove(toDelete);
    setIsDeleting(false);
    setToDelete(null);
  };

  const renderCard = (assignment: Assignment, isOverdue = false) => (
    <MobileAssignmentCard
      key={assignment.id}
      assignment={assignment}
      overdue={isOverdue}
      onOpen={(a) => setOpenId(a.id)}
      onToggle={(a) => void toggle(a)}
      onAskDelete={askDelete}
    />
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight" style={friendlyFont}>
            Assignments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your assignments and submission deadlines.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </button>
      </div>

      {query.isLoading && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {query.isError && (
        <div className="rounded-2xl bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">
            Failed to load assignments. Please refresh the page.
          </p>
        </div>
      )}

      {!query.isLoading && !query.isError && assignments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No assignments yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first assignment to get started.
          </p>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="space-y-2" aria-label="Upcoming assignments">
          <div className="flex items-center gap-2 px-1">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Upcoming
            </p>
            <span className="text-xs text-muted-foreground">({upcoming.length})</span>
          </div>
          {upcoming.map((assignment) => renderCard(assignment))}
        </section>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <section className="space-y-2" aria-label="Overdue assignments">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
            <p className="text-xs font-semibold tracking-wide text-destructive uppercase">
              Overdue
            </p>
            <span className="text-xs text-muted-foreground">({overdue.length})</span>
          </div>
          {overdue.map((assignment) => renderCard(assignment, true))}
        </section>
      )}

      {/* Completed (collapsed) */}
      {completed.length > 0 && (
        <section className="space-y-2" aria-label="Completed assignments">
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
          {doneExpanded && completed.map((assignment) => renderCard(assignment))}
        </section>
      )}

      {/* Sheets and dialogs */}
      <AssignmentSheet
        assignment={openAssignment}
        onClose={() => setOpenId(null)}
        onToggle={(a) => void toggle(a)}
        onEdit={openEdit}
        onAskDelete={askDelete}
      />
      <AssignmentFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        assignment={formAssignment}
      />
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this assignment?"
        description={`"${toDelete?.title ?? ""}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete assignment"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}