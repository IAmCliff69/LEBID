import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import SwipeRow from "@/components/mobile/SwipeRow";
import PlannerEntryCard from "@/components/planner/mobile/PlannerEntryCard";
import { sessionHasStarted, useStudySessionActions } from "@/hooks/useStudySessionActions";
import type { PlannerEntry } from "@/hooks/usePlannerDay";
import { formatTimeLabel, toTimeString } from "@/lib/dateTime";

interface PlannerTimelineProps {
  entries: PlannerEntry[];
  isToday: boolean;
  now: Date;
  highlightId: string | null;
  onOpen: (entry: PlannerEntry) => void;
}

// The list for one day: start time, a dashed line and end time on the left, a
// card on the right. Study session cards can be swiped.
export default function PlannerTimeline({
  entries,
  isToday,
  now,
  highlightId,
  onOpen,
}: PlannerTimelineProps) {
  const { setStatus } = useStudySessionActions();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowLabel = formatTimeLabel(toTimeString(now.getHours(), now.getMinutes()));

  // Scroll to a card that was opened from a link (and flash it)
  const highlightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightId) {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, entries.length]);

  // Where the "now" line goes: before the first card that has not started yet
  const nowIndex = isToday
    ? entries.findIndex((e) => !e.allDay && e.startMin > nowMin)
    : -1;

  const nowLine = (
    <div key="now" className="flex items-center gap-2 py-1" aria-label={`Now, ${nowLabel}`}>
      <span className="w-14 shrink-0 text-right text-[11px] font-semibold text-primary">
        {nowLabel}
      </span>
      <span className="size-2 shrink-0 rounded-full bg-primary" />
      <span className="h-px flex-1 bg-primary/50" />
    </div>
  );

  const swipeComplete = async (entry: PlannerEntry) => {
    const s = entry.session;
    if (!s) return;
    if (s.status === "completed" || s.status === "skipped") {
      await setStatus(s, "planned"); // a swipe on a finished session = undo
      return;
    }
    if (!sessionHasStarted(s, now)) {
      toast.info("Available once the session starts");
      return;
    }
    await setStatus(s, "completed");
  };

  const swipeSkip = async (entry: PlannerEntry) => {
    const s = entry.session;
    if (!s) return;
    if (s.status === "completed" || s.status === "skipped") {
      await setStatus(s, "planned");
      return;
    }
    await setStatus(s, "skipped");
  };

  const rows = entries.map((entry, index) => {
    const card = (
      <PlannerEntryCard
        entry={entry}
        now={now}
        highlighted={highlightId === entry.rawId}
        onOpen={() => onOpen(entry)}
      />
    );
    const finished =
      entry.session?.status === "completed" || entry.session?.status === "skipped";

    return (
      <div key={entry.key}>
        {isToday && nowIndex === index && nowLine}
        <div
          ref={highlightId === entry.rawId ? highlightRef : undefined}
          className="flex items-stretch gap-2 py-1.5"
        >
          {/* start time, dashed line, end time */}
          <div className="flex w-14 shrink-0 flex-col items-end text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">{entry.startLabel}</span>
            {entry.endLabel && (
              <>
                <span
                  aria-hidden="true"
                  className="my-1 w-px flex-1 border-l border-dashed border-muted-foreground/40"
                  style={{ marginRight: "0.4rem" }}
                />
                <span>{entry.endLabel}</span>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {entry.session ? (
              <SwipeRow
                right={{
                  label: finished ? "Undo" : "Complete",
                  icon: <Check className="size-4" />,
                  className: "bg-success text-white",
                  onTrigger: () => void swipeComplete(entry),
                }}
                left={{
                  label: finished ? "Undo" : "Skip",
                  icon: <X className="size-4" />,
                  className: "bg-muted-foreground text-white",
                  onTrigger: () => void swipeSkip(entry),
                }}
              >
                {card}
              </SwipeRow>
            ) : (
              card
            )}
          </div>
        </div>
      </div>
    );
  });

  return (
    <div>
      {rows}
      {/* If every card is earlier than now, the line goes at the end */}
      {isToday && entries.length > 0 && nowIndex === -1 && nowLine}
    </div>
  );
}