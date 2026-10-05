import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";

import { getTimetable } from "@/api/timetable";

// Shown on the Dashboard while the student has no timetable yet
// (for example after skipping the upload during onboarding).
// It disappears by itself once classes exist.
export default function TimetablePromptCard() {
  const timetableQuery = useQuery({
    queryKey: ["timetable-prompt"],
    queryFn: async () => (await getTimetable()).length,
    // Always check again when the Dashboard opens, so the card is gone
    // as soon as a timetable has been imported.
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Only show it once we KNOW the timetable is empty (no flashing while loading).
  if (timetableQuery.data !== 0) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-primary/5 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Your timetable is waiting
            </h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              Upload your lecture timetable so Lebid can understand your week
              and build your personalized study plan.
            </p>
          </div>
        </div>

        <Link
          to="/timetable-import"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          UPLOAD TIMETABLE
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}