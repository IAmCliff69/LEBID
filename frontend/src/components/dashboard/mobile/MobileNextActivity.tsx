import { Link } from "react-router-dom";
import { Activity, ArrowRight, CalendarDays, Clock3, MapPin } from "lucide-react";

import { useNow } from "@/hooks/useNow";
import { useUpcomingActivity } from "@/hooks/useUpcomingActivity";
import type { ActivityItem } from "@/hooks/useUpcomingActivity";
import type { ItemType } from "@/lib/itemLinks";

const TYPE_LABELS: Record<ItemType, string> = {
  lecture: "Class",
  study_session: "Study",
  task: "Task",
  assignment: "Assignment",
  exam: "Exam",
  event: "Event",
};

// Types that take place somewhere (so the detail line gets a pin)
const HAS_PLACE: ItemType[] = ["lecture", "study_session", "exam", "event"];

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

function dayHeading(date: Date, now: Date): string {
  const diff = Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const pad = (n: number) => String(n).padStart(2, "0");

// A live countdown: to the start, or (once it has started) to the end.
function Countdown({ item }: { item: ActivityItem }) {
  const now = useNow(1000); // ticks every second
  const inProgress = now >= item.start && now < item.end;
  const target = inProgress ? item.end : item.start;

  const totalSeconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const text =
    days > 0
      ? `${days}d ${hours}h ${pad(minutes)}m`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f4ede4]/10 px-4 py-3 dark:bg-[#241a16]/10">
      <Clock3 className="size-6 shrink-0 text-[#f0a27a] dark:text-[#a84e30]" aria-hidden="true" />
      <div>
        <p
          className="text-2xl leading-none font-bold tabular-nums text-[#f0a27a] dark:text-[#a84e30]"
          aria-label={inProgress ? "Time left" : "Time remaining"}
        >
          {text}
        </p>
        <p className="mt-1 text-[11px] text-[#f4ede4]/65 dark:text-[#241a16]/65">
          {inProgress ? "In progress · time left" : "Time remaining"}
        </p>
      </div>
    </div>
  );
}

// The distinctive "Next activity" card: espresso in light mode, sand in dark mode.
export default function MobileNextActivity() {
  const now = useNow();
  const { items, isLoading, isError } = useUpcomingActivity();
  const next = items[0];

  const shell =
    "block rounded-3xl bg-[#3d3029] p-4 text-[#f4ede4] shadow-md dark:bg-[#e6c9a8] dark:text-[#241a16]";
  const muted = "text-[#f4ede4]/65 dark:text-[#241a16]/65";

  if (isLoading) {
    return <div className="h-36 animate-pulse rounded-3xl bg-muted" aria-hidden="true" />;
  }

  if (!next) {
    return (
      <section className={shell}>
        <p className={`flex items-center gap-1.5 text-[10.5px] font-semibold tracking-widest uppercase ${muted}`}>
          <Activity className="size-3.5" aria-hidden="true" />
          Next activity
        </p>
        <p className="mt-2 text-sm font-semibold">
          {isError
            ? "Some of your activity couldn't be loaded. Please refresh the page."
            : "Nothing coming up in the next 7 days."}
        </p>
      </section>
    );
  }

  return (
    <Link to={next.to} className={`${shell} transition active:scale-[0.99]`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`flex items-center gap-1.5 text-[10.5px] font-semibold tracking-widest uppercase ${muted}`}>
            <Activity className="size-3.5" aria-hidden="true" />
            Next activity · {TYPE_LABELS[next.type]}
          </p>
          <h3 className="mt-1.5 text-base leading-snug font-bold">{next.title}</h3>
          <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${muted}`}>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {dayHeading(next.start, now)} · {next.timeLabel}
            </span>
            {next.detail && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {HAS_PLACE.includes(next.type) && (
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{next.detail}</span>
              </span>
            )}
          </div>
        </div>
        <ArrowRight className={`mt-1 size-4 shrink-0 ${muted}`} aria-hidden="true" />
      </div>

      <Countdown item={next} />
    </Link>
  );
}