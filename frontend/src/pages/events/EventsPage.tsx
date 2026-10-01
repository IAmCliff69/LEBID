import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";

import { getEvents, deleteEvent } from "@/api/events";
import type { PlannerEvent } from "@/api/events";

import AddEventDialog from "@/components/events/AddEventDialog";
import EditEventDialog from "@/components/events/EditEventDialog";

const FLEXIBILITY_LABELS: Record<string, string> = {
  fixed: "Fixed",
  flexible: "Flexible",
  protected: "Protected",
};

function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function EventsPage() {
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch(() => setError("Failed to load events. Please refresh the page."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleEventAdded = (event: PlannerEvent) => {
    setEvents((prev) =>
      [...prev, event].sort(
        (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      )
    );
  };

  const handleEventUpdated = (updated: PlannerEvent) => {
    setEvents((prev) =>
      prev
        .map((e) => (e.id === updated.id ? updated : e))
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    );
  };

  const handleDeleteConfirm = async (event: PlannerEvent) => {
    setDeletingId(event.id);
    setDeleteError(null);
    try {
      await deleteEvent(event.id);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setConfirmingDeleteId(null);
    } catch {
      setDeleteError("Failed to delete event. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const upcoming = events.filter((e) => daysUntil(e.event_date) >= 0);
  const past = events.filter((e) => daysUntil(e.event_date) < 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Events</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your personal events and commitments.
          </p>
        </div>
        <AddEventDialog onEventAdded={handleEventAdded} />
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-muted-foreground text-sm">Loading events...</p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && events.length === 0 && (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <CalendarDays className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No events yet</p>
          <p className="text-muted-foreground text-xs mt-1">
            Add a personal event, appointment or commitment to keep
            Lebid's planner accurate.
          </p>
        </div>
      )}

      {/* Upcoming */}
      {!isLoading && upcoming.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Upcoming
          </p>
          {upcoming.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onUpdated={handleEventUpdated}
              isDeleting={deletingId === event.id}
              isConfirmingDelete={confirmingDeleteId === event.id}
              deleteError={confirmingDeleteId === event.id ? deleteError : null}
              onDeleteRequest={() => {
                setConfirmingDeleteId(event.id);
                setDeleteError(null);
              }}
              onDeleteConfirm={() => handleDeleteConfirm(event)}
              onDeleteCancel={() => {
                setConfirmingDeleteId(null);
                setDeleteError(null);
              }}
            />
          ))}
        </div>
      )}

      {/* Past */}
      {!isLoading && past.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Past
          </p>
          {past.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onUpdated={handleEventUpdated}
              isPast
              isDeleting={deletingId === event.id}
              isConfirmingDelete={confirmingDeleteId === event.id}
              deleteError={confirmingDeleteId === event.id ? deleteError : null}
              onDeleteRequest={() => {
                setConfirmingDeleteId(event.id);
                setDeleteError(null);
              }}
              onDeleteConfirm={() => handleDeleteConfirm(event)}
              onDeleteCancel={() => {
                setConfirmingDeleteId(null);
                setDeleteError(null);
              }}
            />
          ))}
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// EventCard
// ---------------------------------------------------------------------------

interface EventCardProps {
  event: PlannerEvent;
  onUpdated: (event: PlannerEvent) => void;
  isPast?: boolean;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  deleteError: string | null;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function EventCard({
  event,
  onUpdated,
  isPast = false,
  isDeleting,
  isConfirmingDelete,
  deleteError,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: EventCardProps) {
  const days = daysUntil(event.event_date);

  const flexBadge =
    event.flexibility === "fixed"
      ? "bg-muted text-secondary-foreground"
      : event.flexibility === "protected"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";

  return (
    <div
      className={`bg-card border border-border rounded-xl px-4 py-4 ${
        isPast ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Date block */}
        <div className="shrink-0 text-center min-w-12">
          <p className="text-xs text-muted-foreground font-medium uppercase">
            {new Date(event.event_date + "T00:00:00").toLocaleDateString(
              "en-GB",
              { month: "short" }
            )}
          </p>
          <p className="text-2xl font-bold leading-tight">
            {new Date(event.event_date + "T00:00:00").getDate()}
          </p>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{event.title}</p>

              {event.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {event.description}
                </p>
              )}
            </div>

            {/* Days until badge — only upcoming */}
            {!isPast && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${
                  days === 0
                    ? "text-destructive bg-destructive/10 border-destructive/20"
                    : days <= 3
                      ? "text-warning bg-warning/10 border-warning/20"
                      : "text-primary bg-primary/10 border-primary/20"
                }`}
              >
                {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            {/* Full date */}
            <span className="text-xs text-muted-foreground">
              {formatDate(event.event_date)}
            </span>

            {/* Time range */}
            {event.start_time && (
              <span className="text-xs text-muted-foreground">
                {formatTime(event.start_time)}
                {event.end_time ? ` – ${formatTime(event.end_time)}` : ""}
              </span>
            )}

            {/* Location */}
            {event.location && (
              <span className="text-xs text-muted-foreground">
                {event.location}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Flexibility badge */}
            <span
              className={`inline-flex text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${flexBadge}`}
            >
              {FLEXIBILITY_LABELS[event.flexibility]}
            </span>

            {/* Recurring badge */}
            {event.is_recurring && (
              <span className="inline-flex text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary/60 text-secondary-foreground">
                Recurring
              </span>
            )}
          </div>

          {event.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 truncate">
              {event.notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <EditEventDialog event={event} onEventUpdated={onUpdated} />

          {!isConfirmingDelete ? (
            <button
              type="button"
              onClick={onDeleteRequest}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Sure?</span>
              <button
                type="button"
                onClick={onDeleteConfirm}
                disabled={isDeleting}
                className="rounded-md bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-60"
              >
                {isDeleting ? "Deleting…" : "Yes"}
              </button>
              <button
                type="button"
                onClick={onDeleteCancel}
                disabled={isDeleting}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline delete error */}
      {deleteError && (
        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          <p className="text-destructive text-xs">{deleteError}</p>
        </div>
      )}
    </div>
  );
}