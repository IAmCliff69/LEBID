import { AlertCircle, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import SwipeRow from "@/components/mobile/SwipeRow";
import TimetableClassCard from "@/components/timetable/mobile/TimetableClassCard";
import { classHasStarted, useLectureMarks } from "@/hooks/useLectureMarks";
import type { ClassItem } from "@/hooks/useTimetableWeek";
import { formatTimeLabel } from "@/lib/dateTime";

interface TimetableDayListProps {
  items: ClassItem[];
  todayKey: string;
  now: Date;
  onOpen: (item: ClassItem) => void;
}

// One day's classes: start time, dashed line and end time on the left, a card
// on the right. Swipe left = Missed (once started), swipe right = Cancelled.
// A card that is already marked swipes either way to remove its mark.
export default function TimetableDayList({
  items,
  todayKey,
  now,
  onOpen,
}: TimetableDayListProps) {
  const { mark, unmark } = useLectureMarks();

  const swipeCancelled = async (item: ClassItem) => {
    if (item.mark) {
      await unmark(item.mark, item.entry);
      return;
    }
    await mark(item.entry, item.dateKey, "cancelled");
  };

  const swipeMissed = async (item: ClassItem) => {
    if (item.mark) {
      await unmark(item.mark, item.entry);
      return;
    }
    if (!classHasStarted(item.dateKey, item.entry.start_time, now)) {
      toast.info("Available once the class starts");
      return;
    }
    await mark(item.entry, item.dateKey, "missed");
  };

  return (
    <div>
      {items.map((item) => {
        const marked = item.mark !== undefined;
        return (
          <div key={item.key} className="flex items-stretch gap-2 py-1.5">
            <div className="flex w-14 shrink-0 flex-col items-end text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {formatTimeLabel(item.entry.start_time)}
              </span>
              <span
                aria-hidden="true"
                className="my-1 w-px flex-1 border-l border-dashed border-muted-foreground/40"
                style={{ marginRight: "0.4rem" }}
              />
              <span>{formatTimeLabel(item.entry.end_time)}</span>
            </div>

            <div className="min-w-0 flex-1">
              <SwipeRow
                right={{
                  label: marked ? "Remove mark" : "Cancelled",
                  icon: marked ? <RotateCcw className="size-4" /> : <Ban className="size-4" />,
                  className: "bg-muted-foreground text-white",
                  onTrigger: () => void swipeCancelled(item),
                }}
                left={{
                  label: marked ? "Remove mark" : "Missed",
                  icon: marked ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  ),
                  className: marked
                    ? "bg-muted-foreground text-white"
                    : "bg-destructive text-white",
                  onTrigger: () => void swipeMissed(item),
                }}
              >
                <TimetableClassCard
                  item={item}
                  todayKey={todayKey}
                  now={now}
                  onOpen={() => onOpen(item)}
                />
              </SwipeRow>
            </div>
          </div>
        );
      })}
    </div>
  );
}