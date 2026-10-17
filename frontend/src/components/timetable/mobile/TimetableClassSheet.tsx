import { CalendarDays, Clock, MapPin, Pencil, Trash2, UserRound } from "lucide-react";

import BottomSheet from "@/components/mobile/BottomSheet";
import MobileLectureDates from "@/components/timetable/mobile/MobileLectureDates";
import { classStatus } from "@/components/timetable/mobile/TimetableClassCard";
import type { TimetableEntry } from "@/api/timetable";
import type { ClassItem } from "@/hooks/useTimetableWeek";
import { formatTimeLabel } from "@/lib/dateTime";
import { DAY_NAMES } from "@/lib/timetableWeek";

interface TimetableClassSheetProps {
  item: ClassItem | null;
  todayKey: string;
  now: Date;
  onClose: () => void;
  onEdit: (entry: TimetableEntry) => void;
  onAskDelete: (entry: TimetableEntry) => void;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// A class: details, the Lecture dates list, Edit and Delete.
export default function TimetableClassSheet({
  item,
  todayKey,
  now,
  onClose,
  onEdit,
  onAskDelete,
}: TimetableClassSheetProps) {
  const entry = item?.entry;
  const status = item ? classStatus(item, todayKey, now) : null;

  return (
    <BottomSheet
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Class details"
    >
      {item && entry && (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: item.color }}
              >
                {entry.course_code}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {capital(entry.class_type)}
              </span>
              {status && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {status.label}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg leading-snug font-bold">{entry.course_name}</h2>
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2.5">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              {DAY_NAMES[entry.day_of_week] ?? "Unknown day"}
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              {formatTimeLabel(entry.start_time)} – {formatTimeLabel(entry.end_time)}
            </li>
            {entry.venue && (
              <li className="flex items-center gap-2.5">
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                {entry.venue}
              </li>
            )}
            {entry.lecturer && (
              <li className="flex items-center gap-2.5">
                <UserRound className="size-4 text-primary" aria-hidden="true" />
                {entry.lecturer}
              </li>
            )}
          </ul>

          <MobileLectureDates entry={entry} todayKey={todayKey} now={now} />

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onAskDelete(entry)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}