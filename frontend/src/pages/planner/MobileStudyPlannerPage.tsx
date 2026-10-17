import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, Sparkles } from "lucide-react";
import { toast } from "sonner";

import AddStudySessionDialog from "@/components/study-sessions/AddStudySessionDialog";
import EditStudySessionDialog from "@/components/study-sessions/EditStudySessionDialog";
import RescheduleStudySessionDialog from "@/components/study-sessions/RescheduleStudySessionDialog";
import PlannerDateStrip from "@/components/planner/mobile/PlannerDateStrip";
import PlannerEntrySheet from "@/components/planner/mobile/PlannerEntrySheet";
import PlannerMonthGrid from "@/components/planner/mobile/PlannerMonthGrid";
import PlannerMonthPicker from "@/components/planner/mobile/PlannerMonthPicker";
import PlannerTimeline from "@/components/planner/mobile/PlannerTimeline";
import PlannerTopCards from "@/components/planner/mobile/PlannerTopCards";
import PlannerViewHeader from "@/components/planner/mobile/PlannerViewHeader";
import PlannerWeekList from "@/components/planner/mobile/PlannerWeekList";
import StudySessionSheet from "@/components/planner/mobile/StudySessionSheet";
import type { StudySession } from "@/api/studySessions";
import { useNow } from "@/hooks/useNow";
import { usePlannerRange } from "@/hooks/usePlannerDay";
import type { PlannerEntry, Visibility } from "@/hooks/usePlannerDay";
import { useStartPlanBuilder } from "@/hooks/useStartPlanBuilder";
import { formatDateLabel, parseDateString, toDateString } from "@/lib/dateTime";
import { KIND_ORDER } from "@/lib/plannerColors";
import type { PlannerKind } from "@/lib/plannerColors";
import { monthGridKeys, sameMonth, shiftMonth, weekKeys } from "@/lib/plannerDates";
import type { PlannerMode } from "@/lib/plannerDates";

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };
const STORAGE_KEY = "lebid-planner-visible";

// The "Other Calendars" ticks are remembered on this device.
function loadVisibility(): Visibility {
  const all = Object.fromEntries(KIND_ORDER.map((kind) => [kind, true])) as Visibility;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      for (const kind of KIND_ORDER) {
        if (typeof saved[kind] === "boolean") all[kind] = saved[kind];
      }
    }
  } catch {
    // Ignore a damaged saved value: everything simply starts ticked.
  }
  return all;
}

const monthYear = (dateKey: string) =>
  (parseDateString(dateKey) ?? new Date()).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

const shortDay = (dateKey: string) =>
  (parseDateString(dateKey) ?? new Date()).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

// The phone version of the Study Planner: Day, Week and Month views.
export default function MobileStudyPlannerPage() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const now = useNow();
  const todayKey = toDateString(now);
  const startPlanBuilder = useStartPlanBuilder();

  // A link (dashboard, notification) can open a particular day and card
  const [selected, setSelected] = useState(params.get("date") ?? todayKey);
  const [highlightId, setHighlightId] = useState<string | null>(params.get("highlight"));
  const [visible, setVisible] = useState<Visibility>(loadVisibility);
  const [mode, setMode] = useState<PlannerMode>("day");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [openEntry, setOpenEntry] = useState<PlannerEntry | null>(null);
  const [editing, setEditing] = useState<StudySession | null>(null);
  const [rescheduling, setRescheduling] = useState<StudySession | null>(null);

  // Which days the current view needs
  const dayKeys = useMemo(() => {
    if (mode === "week") return weekKeys(selected);
    if (mode === "month") return monthGridKeys(selected);
    return [selected];
  }, [mode, selected]);

  const planner = usePlannerRange(dayKeys, visible);

  // The pinned calendar header: measure its height so the sticky day headings
  // in the Week view sit right underneath it.
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const head = headRef.current;
    if (!section || !head) return;
    const apply = () =>
      section.style.setProperty("--planner-head", `${head.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(head);
    return () => observer.disconnect();
  }, []);

  // The flash on a linked card fades after a few seconds
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 3500);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const toggle = (kind: PlannerKind, value: boolean) => {
    const next = { ...visible, [kind]: value };
    setVisible(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Not important: it just won't be remembered.
    }
  };

  const refreshSessions = () =>
    queryClient.invalidateQueries({ queryKey: ["study-sessions"] });

  // Month picker: keep the day if it is the same month, jump to today for the
  // current month, otherwise the 1st.
  const pickMonth = (year: number, monthIndex: number) => {
    const first = toDateString(new Date(year, monthIndex, 1, 12));
    if (sameMonth(first, selected)) {
      // same month: nothing to change
    } else if (sameMonth(first, todayKey)) {
      setSelected(todayKey);
    } else {
      setSelected(first);
    }
    setPickerOpen(false);
  };

  // Sessions open in their own sheet; everything else in the general one
  const sessionEntry = openEntry?.session ?? null;
  const sessionCourse = sessionEntry
    ? planner.courses.find((c) => String(c.id) === String(sessionEntry.course_id))
    : undefined;

  const isToday = selected === todayKey;
  const dayEntries = planner.entriesByDay.get(selected) ?? [];
  const weekDays = mode === "week" ? dayKeys : [];

  let listHeading = isToday ? "Today" : formatDateLabel(selected);
  let countLabel = `${dayEntries.length} ${dayEntries.length === 1 ? "item" : "items"}`;
  if (mode === "week") {
    listHeading = `${shortDay(dayKeys[0])} – ${shortDay(dayKeys[dayKeys.length - 1])}`;
    const total = dayKeys.reduce(
      (sum, key) => sum + (planner.entriesByDay.get(key)?.length ?? 0),
      0
    );
    countLabel = `${total} ${total === 1 ? "item" : "items"}`;
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarClock className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-3xl leading-tight" style={friendlyFont}>
          Study Planner
        </h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void startPlanBuilder()}
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold"
        >
          <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">Build my study plan with AI</span>
        </button>

        <AddStudySessionDialog
          courses={planner.courses}
          defaultDate={selected}
          onSessionAdded={(session, count) => {
            void refreshSessions();
            setSelected(session.session_date);
            toast.success(
              count > 1 ? `${count} study sessions added` : "Study session added"
            );
          }}
        />
      </div>

      <PlannerTopCards visible={visible} onToggle={toggle} />

      {/* The calendar: a header that stays under the top bar while you scroll */}
      <section ref={sectionRef} aria-label="Calendar">
        <div
          ref={headRef}
          className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 rounded-b-[28px] bg-muted px-4 pt-2 pb-2 shadow-sm"
        >
          <PlannerViewHeader
            monthLabel={monthYear(selected)}
            mode={mode}
            onModeChange={setMode}
            onOpenPicker={() => setPickerOpen(true)}
          />
          {mode !== "month" && (
            <PlannerDateStrip selected={selected} onSelect={setSelected} />
          )}
        </div>

        <div className="mt-3">
          {mode !== "month" && (
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{listHeading}</h3>
              <span className="text-xs text-muted-foreground">{countLabel}</span>
            </div>
          )}

          {planner.isLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : planner.isError ? (
            <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
              Some of your planner couldn't be loaded. Please refresh the page.
            </p>
          ) : mode === "month" ? (
            <PlannerMonthGrid
              monthKey={selected}
              days={dayKeys}
              entriesByDay={planner.entriesByDay}
              selected={selected}
              todayKey={todayKey}
              onPickDay={(key) => {
                setSelected(key);
                setMode("day");
              }}
              onPrev={() => setSelected(shiftMonth(selected, -1))}
              onNext={() => setSelected(shiftMonth(selected, 1))}
            />
          ) : mode === "week" ? (
            <PlannerWeekList
              days={weekDays}
              entriesByDay={planner.entriesByDay}
              selected={selected}
              todayKey={todayKey}
              now={now}
              highlightId={highlightId}
              onOpen={setOpenEntry}
              onSelect={setSelected}
            />
          ) : dayEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-semibold">Nothing planned for this day</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a study session above, or let Lebid plan your week.
              </p>
              <button
                type="button"
                onClick={() => void startPlanBuilder()}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Build with AI
              </button>
            </div>
          ) : (
            <PlannerTimeline
              entries={dayEntries}
              isToday={isToday}
              now={now}
              highlightId={highlightId}
              onOpen={setOpenEntry}
            />
          )}
        </div>
      </section>

      {/* Sheets and dialogs */}
      <PlannerMonthPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={selected}
        todayKey={todayKey}
        onPick={pickMonth}
      />
      <StudySessionSheet
        session={sessionEntry}
        course={sessionCourse}
        now={now}
        onClose={() => setOpenEntry(null)}
        onEdit={setEditing}
        onReschedule={setRescheduling}
      />
      <PlannerEntrySheet
        entry={openEntry && !openEntry.session ? openEntry : null}
        dateKey={openEntry?.dateKey ?? selected}
        onClose={() => setOpenEntry(null)}
      />

      <EditStudySessionDialog
        session={editing}
        courses={planner.courses}
        onClose={() => setEditing(null)}
        onSessionUpdated={() => {
          void refreshSessions();
          toast.success("Study session updated");
        }}
      />
      <RescheduleStudySessionDialog
        session={rescheduling}
        courses={planner.courses}
        onClose={() => setRescheduling(null)}
        onSessionRescheduled={(newSession) => {
          void refreshSessions();
          setSelected(newSession.session_date);
          toast.success("Study session rescheduled");
        }}
      />
    </div>
  );
}