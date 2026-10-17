import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin } from "lucide-react";

import BottomSheet from "@/components/mobile/BottomSheet";
import LectureDateMarker from "@/components/timetable/LectureDateMarker";
import type { PlannerEntry } from "@/hooks/usePlannerDay";
import { KIND_LABELS } from "@/lib/plannerColors";

interface PlannerEntrySheetProps {
  entry: PlannerEntry | null;
  dateKey: string;
  onClose: () => void;
}

// Details for everything on the planner that is not a study session:
// classes (with Missed / Cancelled marking), events, exams, assignments, tasks.
export default function PlannerEntrySheet({ entry, dateKey, onClose }: PlannerEntrySheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const openPage = () => {
    if (!entry) return;
    onClose();
    if (entry.marker) navigate(entry.marker.to);
    else if (entry.event) navigate("/events");
  };

  return (
    <BottomSheet
      open={entry !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Planner item"
    >
      {entry && (
        <div className="space-y-4">
          <div>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ backgroundColor: entry.color }}
            >
              {KIND_LABELS[entry.kind]}
            </span>
            <h2 className="mt-2 text-lg leading-snug font-bold">{entry.title}</h2>
            {entry.subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground">{entry.subtitle}</p>
            )}
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2.5">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              {entry.allDay
                ? "All day"
                : entry.endLabel
                  ? `${entry.startLabel} – ${entry.endLabel}`
                  : entry.startLabel}
            </li>
            {entry.place && (
              <li className="flex items-center gap-2.5">
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                {entry.place}
              </li>
            )}
            {entry.lecture?.entry.lecturer && (
              <li className="text-muted-foreground">
                Lecturer: {entry.lecture.entry.lecturer}
              </li>
            )}
          </ul>

          {/* A class can be marked Missed or Cancelled for this date */}
          {entry.lecture && (
            <LectureDateMarker
              entry={entry.lecture.entry}
              dateKey={dateKey}
              mark={entry.lecture.mark}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: ["lecture-occurrences"] });
              }}
            />
          )}

          {(entry.marker || entry.event) && (
            <button
              type="button"
              onClick={openPage}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              Open
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}