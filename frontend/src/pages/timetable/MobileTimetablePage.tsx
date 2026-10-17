import { useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import TimetableClassSheet from "@/components/timetable/mobile/TimetableClassSheet";
import TimetableDayList from "@/components/timetable/mobile/TimetableDayList";
import TimetableFormSheet from "@/components/timetable/mobile/TimetableFormSheet";
import { deleteTimetableEntry } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";
import { useNow } from "@/hooks/useNow";
import { useTimetableWeek } from "@/hooks/useTimetableWeek";
import type { ClassItem } from "@/hooks/useTimetableWeek";
import { toDateString } from "@/lib/dateTime";
import { DAY_NAMES, DAY_SHORT, weekdayIndex } from "@/lib/timetableWeek";
import { cn } from "@/lib/utils";

const friendlyFont = { fontFamily: '"Original Surfer", cursive' };

type Mode = "day" | "week";

// The phone version of the Timetable: Day (weekday strip) and Week (a list).
export default function MobileTimetablePage() {
  const queryClient = useQueryClient();
  const now = useNow();
  const todayKey = toDateString(now);
  const todayIndex = weekdayIndex(now);
  const { days, entries, isLoading, isError } = useTimetableWeek(todayKey);

  const [mode, setMode] = useState<Mode>("day");
  const [selectedDay, setSelectedDay] = useState(todayIndex);

  const [openRef, setOpenRef] = useState<{ id: number; dateKey: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formEntry, setFormEntry] = useState<TimetableEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<TimetableEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // The pinned header: measure it so the sticky day headings in the Week view
  // sit right underneath it.
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const head = headRef.current;
    if (!section || !head) return;
    const apply = () => section.style.setProperty("--tt-head", `${head.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(head);
    return () => observer.disconnect();
  }, []);

  // The open class, looked up again each render so edits show straight away
  const openItem: ClassItem | null = openRef
    ? (days
        .flatMap((day) => day.items)
        .find((i) => i.entry.id === openRef.id && i.dateKey === openRef.dateKey) ?? null)
    : null;

  const openAdd = () => {
    setFormEntry(null);
    setFormOpen(true);
  };

  const openEdit = (entry: TimetableEntry) => {
    setOpenRef(null);
    setFormEntry(entry);
    setFormOpen(true);
  };

  const askDelete = (entry: TimetableEntry) => {
    setOpenRef(null);
    setEntryToDelete(entry);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    const entry = entryToDelete;
    setIsDeleting(true);
    try {
      await deleteTimetableEntry(entry.id);
      await queryClient.invalidateQueries({ queryKey: ["timetable"] });
      await queryClient.invalidateQueries({ queryKey: ["lecture-occurrences"] });
      toast.success("Class deleted", {
        description: `${entry.course_code} ${entry.class_type}`,
      });
    } catch {
      toast.error("Couldn't delete the class", { description: "Please try again." });
    } finally {
      setIsDeleting(false);
      setEntryToDelete(null);
    }
  };

  const open = (item: ClassItem) =>
    setOpenRef({ id: item.entry.id, dateKey: item.dateKey });

  const day = days[selectedDay];
  const dayHeading = selectedDay === todayIndex ? "Today" : DAY_NAMES[selectedDay];

  return (
    <div className="space-y-4">
      {/* Title and Add Class */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-3xl leading-tight" style={friendlyFont}>
            Timetable
          </h1>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Class
        </button>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">
          Keep track of your weekly classes and know where you need to be.
        </p>
        <Link
          to="/timetable-import"
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary"
        >
          <Upload className="size-4" aria-hidden="true" />
          Import timetable
        </Link>
      </div>

      <section ref={sectionRef} aria-label="Weekly timetable">
        {/* Pinned under the top bar: the Day | Week switch and the weekday strip */}
        <div
          ref={headRef}
          className="sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-4 rounded-b-[28px] bg-muted px-4 pt-3 pb-3 shadow-sm"
        >
          <div
            role="tablist"
            aria-label="Timetable view"
            className="grid grid-cols-2 rounded-full bg-card p-0.5"
          >
            {(["day", "week"] as Mode[]).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "h-9 rounded-full text-xs font-semibold capitalize transition-colors",
                  mode === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                )}
              >
                {value}
              </button>
            ))}
          </div>

          {mode === "day" && (
            <div
              role="listbox"
              aria-label="Choose a day"
              className="mt-3 grid grid-cols-7 items-end gap-1.5"
            >
              {DAY_SHORT.map((name, index) => {
                const isSelected = index === selectedDay;
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedDay(index)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-full text-xs font-semibold transition-all",
                      isSelected
                        ? "h-[64px] bg-primary text-primary-foreground shadow-md"
                        : "h-[52px] bg-card text-foreground"
                    )}
                  >
                    {name}
                    {index === todayIndex && !isSelected && (
                      <span
                        className="mt-1 size-1 rounded-full bg-primary"
                        aria-label="Today"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3">
          {isLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : isError ? (
            <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load timetable. Please refresh the page.
            </p>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-semibold">No classes yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a class, or import your timetable from a photo or PDF.
              </p>
            </div>
          ) : mode === "day" ? (
            <>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{dayHeading}</h3>
                <span className="text-xs text-muted-foreground">
                  {day.items.length} {day.items.length === 1 ? "class" : "classes"}
                </span>
              </div>
              {day.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm font-semibold">
                    No classes on {DAY_NAMES[selectedDay]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enjoy the free day, or add a class.
                  </p>
                </div>
              ) : (
                <TimetableDayList
                  items={day.items}
                  todayKey={todayKey}
                  now={now}
                  onOpen={open}
                />
              )}
            </>
          ) : (
            <div className="space-y-1">
              {days.map((weekDay) => (
                <section key={weekDay.index} aria-label={DAY_NAMES[weekDay.index]}>
                  <div className="sticky top-[calc(3.75rem+env(safe-area-inset-top)+var(--tt-head,7rem))] z-10 flex items-baseline justify-between bg-background py-2">
                    <span
                      className={cn(
                        "text-sm font-bold",
                        weekDay.index === todayIndex && "text-primary"
                      )}
                    >
                      {DAY_NAMES[weekDay.index]}
                      {weekDay.index === todayIndex && (
                        <span className="ml-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Today
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {weekDay.items.length}{" "}
                      {weekDay.items.length === 1 ? "class" : "classes"}
                    </span>
                  </div>
                  {weekDay.items.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                      No classes
                    </p>
                  ) : (
                    <TimetableDayList
                      items={weekDay.items}
                      todayKey={todayKey}
                      now={now}
                      onOpen={open}
                    />
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Sheets and dialogs */}
      <TimetableClassSheet
        item={openItem}
        todayKey={todayKey}
        now={now}
        onClose={() => setOpenRef(null)}
        onEdit={openEdit}
        onAskDelete={askDelete}
      />
      <TimetableFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={formEntry}
        defaultDay={selectedDay}
      />
      <ConfirmDialog
        open={entryToDelete !== null}
        title="Delete this class?"
        description={`This ${entryToDelete?.class_type ?? "class"} for ${entryToDelete?.course_code ?? "this course"} will be removed from your timetable. This cannot be undone.`}
        confirmLabel="Delete class"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
}