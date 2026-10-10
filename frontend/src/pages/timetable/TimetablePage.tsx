import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3 } from "lucide-react";
import { toast } from "sonner";

import WeeklyTimetableGrid from "@/components/timetable/WeeklyTimetableGrid";
import AddTimetableEntryDialog from "@/components/timetable/AddTimetableEntryDialog";
import { getTimetable, deleteTimetableEntry } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<TimetableEntry | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        const data = await getTimetable();
        setEntries(data);
      } catch {
        setError("Failed to load timetable. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimetable();
  }, []);

    const handleEntryAdded = (entry: TimetableEntry) => {
    setEntries((prev) => [...prev, entry]);
    toast.success("Class added", {
      description: `${entry.course_code} ${entry.class_type}`,
    });
  };

  const handleEntryUpdated = (updated: TimetableEntry) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === updated.id ? updated : entry))
    );
    setSelectedEntryId(null);
    toast.success("Class updated", {
      description: `${updated.course_code} ${updated.class_type}`,
    });
  };

    // Step 1: the delete button only opens the confirmation dialog.
  const handleDelete = (entry: TimetableEntry) => {
    setEntryToDelete(entry);
  };

  // Step 2: runs when the student confirms in the dialog.
  const confirmDelete = async () => {
    if (!entryToDelete) return;
    const entry = entryToDelete;

    setIsDeletingEntry(true);
    try {
      await deleteTimetableEntry(entry.id);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setSelectedEntryId(null);
      toast.success("Class deleted", {
        description: `${entry.course_code} ${entry.class_type}`,
      });
    } catch {
      toast.error("Couldn't delete the class", {
        description: "Please try again.",
      });
    } finally {
      setIsDeletingEntry(false);
      setEntryToDelete(null);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={entryToDelete !== null}
        title="Delete this class?"
        description={`This ${entryToDelete?.class_type ?? "class"} for ${entryToDelete?.course_code ?? "this course"} will be removed from your timetable. This cannot be undone.`}
        confirmLabel="Delete class"
        isLoading={isDeletingEntry}
        onConfirm={confirmDelete}
        onCancel={() => setEntryToDelete(null)}
      />
      <div className="mx-auto max-w-350 space-y-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Timetable
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Keep track of your weekly classes and know where you need to be.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/missed-lectures"
              className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Missed lectures
            </Link>
            <Link
              to="/cancelled-lectures"
              className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancelled lectures
            </Link>
            <AddTimetableEntryDialog onEntryAdded={handleEntryAdded} />
          </div>
        </section>

        {!isLoading && !error && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />

              <span>
                {entries.length} scheduled {entries.length === 1 ? "class" : "classes"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />

              <span>Weekly schedule</span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-7 gap-px bg-border p-px">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse bg-card" />
              ))}
            </div>

            <div className="space-y-px bg-border">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse bg-card" />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4">
            <p className="text-sm font-medium text-destructive">{error}</p>

            <p className="mt-1 text-xs text-destructive/80">
              Check your connection and try refreshing the page.
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <section className="min-w-0">
            <WeeklyTimetableGrid
              entries={entries}
              onEntryClick={(entry) => setSelectedEntryId(entry.id)}
              selectedEntryId={selectedEntryId}
              onDeleteEntry={handleDelete}
              onEntryUpdated={handleEntryUpdated}
              onClearSelection={() => setSelectedEntryId(null)}
            />
          </section>
        )}
      </div>
    </>
  );
}
