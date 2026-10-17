import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarClock, CalendarX2, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getLectureOccurrences } from "@/api/lectureOccurrences";
import { getMissedStudySessions } from "@/api/studySessions";
import { getTasks } from "@/api/tasks";
import { useNow } from "@/hooks/useNow";

interface OverviewCardProps {
  icon: LucideIcon;
  label: string;
  count: number | null; // null while loading
  to: string;
}

function OverviewCard({ icon: Icon, label, count, to }: OverviewCardProps) {
  return (
    <Link
      to={to}
      data-card
      className="block w-[140px] shrink-0 snap-start rounded-2xl border border-primary/15 bg-primary/10 p-3.5 transition active:scale-[0.98] dark:border-transparent"
    >
      <Icon className="size-[22px] text-primary" aria-hidden="true" />
      <p className="mt-2 text-[12.5px] leading-tight font-semibold">{label}</p>
      <p className="mt-1 text-2xl leading-none font-bold text-primary">{count ?? "–"}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        View details <ArrowRight className="size-3" aria-hidden="true" />
      </p>
    </Link>
  );
}

// "Activity Overview": a row of count cards that scrolls sideways.
export default function MobileActivityOverview() {
  const now = useNow();
  const rowRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const missedLectures = useQuery({
    queryKey: ["lecture-occurrences", "list", "missed"],
    queryFn: () => getLectureOccurrences({ status: "missed" }),
  });
  const cancelledLectures = useQuery({
    queryKey: ["lecture-occurrences", "list", "cancelled"],
    queryFn: () => getLectureOccurrences({ status: "cancelled" }),
  });
  const missedSessions = useQuery({
    queryKey: ["study-sessions", "missed"],
    queryFn: getMissedStudySessions,
  });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: getTasks });

  const overdueTasks = (tasks.data ?? []).filter(
    (t) => t.status !== "completed" && t.deadline && new Date(t.deadline) < now
  ).length;
  const missedSessionCount = (missedSessions.data ?? []).filter(
    (s) => s.status === "planned"
  ).length;

  const cards: OverviewCardProps[] = [
    {
      icon: AlertCircle,
      label: "Missed Lectures",
      count: missedLectures.data ? missedLectures.data.length : null,
      to: "/missed-lectures",
    },
    {
      icon: CalendarClock,
      label: "Missed Study Sessions",
      count: missedSessions.data ? missedSessionCount : null,
      to: "/planner",
    },
    {
      icon: CalendarX2,
      label: "Cancelled Lectures",
      count: cancelledLectures.data ? cancelledLectures.data.length : null,
      to: "/cancelled-lectures",
    },
    {
      icon: ClipboardList,
      label: "Overdue Tasks",
      count: tasks.data ? overdueTasks : null,
      to: "/tasks",
    },
  ];

  // Which dot is lit follows how far the row has been scrolled
  const handleScroll = () => {
    const row = rowRef.current;
    const first = row?.querySelector<HTMLElement>("[data-card]");
    if (!row || !first) return;
    const step = first.offsetWidth + 12; // card width + gap
    setActive(Math.min(cards.length - 1, Math.max(0, Math.round(row.scrollLeft / step))));
  };

  return (
    <section aria-label="Activity overview">
      <h2 className="text-base font-bold tracking-tight">Activity Overview</h2>

      <div
        ref={rowRef}
        onScroll={handleScroll}
        className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <OverviewCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
        {cards.map((card, index) => (
          <span
            key={card.label}
            className={
              index === active
                ? "h-1.5 w-5 rounded-full bg-primary transition-all"
                : "h-1.5 w-1.5 rounded-full bg-muted-foreground/30 transition-all"
            }
          />
        ))}
      </div>
    </section>
  );
}