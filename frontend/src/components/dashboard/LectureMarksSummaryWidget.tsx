import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarX2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getLectureOccurrences } from "@/api/lectureOccurrences";
import { parseDateString } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

type ListedStatus = "missed" | "cancelled";

const CONFIG: Record<
  ListedStatus,
  { title: string; to: string; icon: LucideIcon; empty: string; accent: string }
> = {
  missed: {
    title: "Missed lectures",
    to: "/missed-lectures",
    icon: AlertCircle,
    empty: "No missed lectures",
    accent: "bg-destructive/10 text-destructive",
  },
  cancelled: {
    title: "Cancelled lectures",
    to: "/cancelled-lectures",
    icon: CalendarX2,
    empty: "No cancelled lectures",
    accent: "bg-muted text-muted-foreground",
  },
};

interface Props {
  status: ListedStatus;
  className?: string;
}

// A compact card: how many lectures were missed (or cancelled) and the most
// recent one. Tap it to see the full list.
export default function LectureMarksSummaryWidget({ status, className }: Props) {
  const config = CONFIG[status];
  const Icon = config.icon;

  // Same query key as the full list page, so the data is shared
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["lecture-occurrences", "list", status],
    queryFn: () => getLectureOccurrences({ status }),
  });

  const latest = data[0]; // the list comes newest first
  const latestDate = latest ? parseDateString(latest.occurrence_date) : null;

  return (
    <Link
      to={config.to}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          config.accent
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{config.title}</p>
        {latest ? (
          <p className="truncate text-xs text-muted-foreground">
            Latest:{" "}
            <span className="font-medium text-foreground">
              {latest.course_code ? `${latest.course_code} · ` : ""}
              {latest.course_name}
            </span>
            {" · "}
            {latestDate
              ? latestDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : latest.occurrence_date}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Loading..." : isError ? "Couldn't load" : config.empty}
          </p>
        )}
      </div>

      <p className="text-3xl font-bold tracking-tight">
        {isLoading ? "..." : isError ? "—" : data.length}
      </p>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}