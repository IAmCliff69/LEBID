import { useEffect, useState } from "react";

import { CalendarDays, Clock3 } from "lucide-react";

import WeeklyTimetableGrid from "@/components/timetable/WeeklyTimetableGrid";
import AddTimetableEntryDialog from "@/components/timetable/AddTimetableEntryDialog";
<<<<<<< HEAD
import { getTimetable, deleteTimetableEntry } from "@/api/timetable";
=======

import { getTimetable } from "@/api/timetable";
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
import type { TimetableEntry } from "@/api/timetable";

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
<<<<<<< HEAD
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e

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
  };

<<<<<<< HEAD
  const handleEntryUpdated = (updated: TimetableEntry) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === updated.id ? updated : entry))
    );
    setSelectedEntryId(null);
  };

  const handleDelete = async (entry: TimetableEntry) => {
    if (
      !confirm(
        `Delete this ${entry.class_type} for ${entry.course_code}? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteTimetableEntry(entry.id);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setSelectedEntryId(null);
    } catch {
      alert("Failed to delete entry. Please try again.");
    }
  };

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-8">
=======
  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-8">
        {/* Header */}
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
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

          <AddTimetableEntryDialog onEntryAdded={handleEntryAdded} />
        </section>

<<<<<<< HEAD
=======
        {/* Small summary */}
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
        {!isLoading && !error && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />

              <span>
<<<<<<< HEAD
                {entries.length} scheduled {entries.length === 1 ? "class" : "classes"}
=======
                {entries.length} scheduled{" "}
                {entries.length === 1 ? "class" : "classes"}
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />

              <span>Weekly schedule</span>
            </div>
          </div>
        )}

<<<<<<< HEAD
=======
        {/* Loading */}
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
        {isLoading && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-7 gap-px bg-border p-px">
              {Array.from({ length: 7 }).map((_, index) => (
<<<<<<< HEAD
                <div key={index} className="h-16 animate-pulse bg-card" />
=======
                <div
                  key={index}
                  className="h-16 animate-pulse bg-card"
                />
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
              ))}
            </div>

            <div className="space-y-px bg-border">
              {Array.from({ length: 5 }).map((_, index) => (
<<<<<<< HEAD
                <div key={index} className="h-20 animate-pulse bg-card" />
=======
                <div
                  key={index}
                  className="h-20 animate-pulse bg-card"
                />
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
              ))}
            </div>
          </div>
        )}

<<<<<<< HEAD
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4">
            <p className="text-sm font-medium text-destructive">{error}</p>
=======
        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4">
            <p className="text-sm font-medium text-destructive">
              {error}
            </p>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e

            <p className="mt-1 text-xs text-destructive/80">
              Check your connection and try refreshing the page.
            </p>
          </div>
        )}

<<<<<<< HEAD
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
=======
        {/* Timetable */}
        {!isLoading && !error && (
          <section className="min-w-0">
            <WeeklyTimetableGrid entries={entries} />
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
          </section>
        )}
      </div>
    </>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
