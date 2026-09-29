import { useEffect, useState } from "react";

import { CalendarDays, Clock3 } from "lucide-react";

import WeeklyTimetableGrid from "@/components/timetable/WeeklyTimetableGrid";
import AddTimetableEntryDialog from "@/components/timetable/AddTimetableEntryDialog";

import { getTimetable } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-8">
        {/* Header */}
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

        {/* Small summary */}
        {!isLoading && !error && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />

              <span>
                {entries.length} scheduled{" "}
                {entries.length === 1 ? "class" : "classes"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />

              <span>Weekly schedule</span>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-7 gap-px bg-border p-px">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse bg-card"
                />
              ))}
            </div>

            <div className="space-y-px bg-border">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse bg-card"
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4">
            <p className="text-sm font-medium text-destructive">
              {error}
            </p>

            <p className="mt-1 text-xs text-destructive/80">
              Check your connection and try refreshing the page.
            </p>
          </div>
        )}

        {/* Timetable */}
        {!isLoading && !error && (
          <section className="min-w-0">
            <WeeklyTimetableGrid entries={entries} />
          </section>
        )}
      </div>
    </>
  );
}