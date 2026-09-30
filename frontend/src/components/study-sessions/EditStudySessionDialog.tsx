import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { updateStudySession } from "@/api/studySessions";
import type {
  StudySession,
  StudySessionPriority,
  StudySessionStatus,
} from "@/api/studySessions";
import type { Course } from "@/api/courses";
import { checkConflicts } from "@/api/conflicts";
import type { ConflictItem } from "@/api/conflicts";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ConflictWarning from "@/components/conflicts/ConflictWarning";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

// "Rescheduled" is not listed here on purpose: a session only becomes
// rescheduled through the Reschedule action, which keeps the link to the
// original session (rescheduled_from_id).
const STATUSES = [
  { label: "Planned", value: "planned" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Skipped", value: "skipped" },
];

const schema = z
  .object({
    course_id: z.string().min(1, "Course is required"),
    topic: z.string().optional(),
    session_date: z.string().min(1, "Date is required"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    venue: z.string().trim().min(1, "Venue is required"),
    priority: z.string().min(1, "Priority is required"),
    status: z.string().min(1, "Status is required"),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.start_time ||
      !data.end_time ||
      data.end_time > data.start_time,
    {
      message: "End time must be after start time",
      path: ["end_time"],
    }
  );

type FormData = z.infer<typeof schema>;

interface Props {
  /** The session being edited. The dialog is open whenever this is not null. */
  session: StudySession | null;
  courses: Course[];
  /** Called when the dialog should close (Cancel, X, Escape, or after saving). */
  onClose: () => void;
  /** Called after the backend confirms the update. */
  onSessionUpdated: (session: StudySession) => void;
}

/** The backend returns "HH:MM:SS"; <input type="time"> wants "HH:MM". */
function toInputTime(time: string): string {
  return time.slice(0, 5);
}

function sessionToFormValues(session: StudySession): FormData {
  return {
    course_id: String(session.course_id),
    topic: session.topic ?? "",
    session_date: session.session_date,
    start_time: toInputTime(session.start_time),
    end_time: toInputTime(session.end_time),
    venue: session.venue,
    priority: session.priority,
    status: session.status,
    notes: session.notes ?? "",
  };
}

export default function EditStudySessionDialog({
  session,
  courses,
  onClose,
  onSessionUpdated,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Conflict state
const [conflicts, setConflicts] = useState<ConflictItem[]>([]);

// Watch the three fields that determine a conflict
const sessionDate = watch("session_date");
const startTime = watch("start_time");
const endTime = watch("end_time");

// Automatically check for conflicts whenever the student fills in date + times
useEffect(() => {
  if (!sessionDate || !startTime || !endTime || endTime <= startTime) {
    setConflicts([]);
    return;
  }

  let cancelled = false;

  checkConflicts({
    check_date: sessionDate,
    start_time: startTime,
    end_time: endTime,
    // ONLY in EditStudySessionDialog add the next line:
    // exclude_session_id: session?.id,
  })
    .then((res) => {
      if (!cancelled) setConflicts(res.conflicts);
    })
    .catch(() => {
      if (!cancelled) setConflicts([]);
    });

  return () => {
    cancelled = true;
  };
}, [sessionDate, startTime, endTime /*, session?.id if you used it */]);

  // Fill the form with the selected session every time a different one opens
useEffect(() => {
  if (session) {
    reset(sessionToFormValues(session));
    setServerError(null);
  }
}, [session, reset, setServerError]);

  const isRescheduled = session?.status === "rescheduled";

  const onSubmit = async (data: FormData) => {
    if (!session) return;

    setServerError(null);

    try {
      const updated = await updateStudySession(session.id, {
        course_id: data.course_id,
        topic: data.topic?.trim() || null,
        session_date: data.session_date,
        start_time: data.start_time,
        end_time: data.end_time,
        venue: data.venue.trim(),
        priority: data.priority as StudySessionPriority,
        notes: data.notes?.trim() || null,
        // A rescheduled session keeps its status; everything else is editable
        ...(isRescheduled
          ? {}
          : { status: data.status as StudySessionStatus }),
      });

      onSessionUpdated(updated);
      onClose();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { detail?: unknown } };
      };
      const detail = error.response?.data?.detail;

      if (typeof detail === "string") {
        setServerError(detail);
      } else if (Array.isArray(detail)) {
        setServerError(
          detail
            .map((d: { msg?: string }) => d.msg)
            .filter(Boolean)
            .join(", ")
        );
      } else {
        setServerError(
          "Failed to update study session. Please try again."
        );
      }
    }
  };

  return (
    <Dialog
      open={session !== null}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit study session</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 mt-2"
        >
          {/* Course */}
          <div className="space-y-1.5">
            <Label>Course</Label>

            <Controller
              name="course_id"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>

                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem
                        key={course.id}
                        value={String(course.id)}
                      >
                        {course.code} — {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            {errors.course_id && (
              <p className="text-destructive text-xs">
                {errors.course_id.message}
              </p>
            )}
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_ss_topic">
              Topic{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>

            <Input
              id="edit_ss_topic"
              placeholder="e.g. Normalisation"
              {...register("topic")}
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_ss_date">Date</Label>

            <Input
              id="edit_ss_date"
              type="date"
              {...register("session_date")}
            />

            {errors.session_date && (
              <p className="text-destructive text-xs">
                {errors.session_date.message}
              </p>
            )}
          </div>

          {/* Start and end time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_ss_start">Start time</Label>

              <Input
                id="edit_ss_start"
                type="time"
                {...register("start_time")}
              />

              {errors.start_time && (
                <p className="text-destructive text-xs">
                  {errors.start_time.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit_ss_end">End time</Label>

              <Input
                id="edit_ss_end"
                type="time"
                {...register("end_time")}
              />

              {errors.end_time && (
                <p className="text-destructive text-xs">
                  {errors.end_time.message}
                </p>
              )}
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_ss_venue">Venue</Label>

            <Input
              id="edit_ss_venue"
              placeholder="e.g. Library"
              {...register("venue")}
            />

            {errors.venue && (
              <p className="text-destructive text-xs">
                {errors.venue.message}
              </p>
            )}
          </div>

          {/* Priority and status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>

              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>

                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {!isRescheduled && (
              <div className="space-y-1.5">
                <Label>Status</Label>

                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>

                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_ss_notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>

            <Textarea
              id="edit_ss_notes"
              placeholder="Anything you want to remember..."
              {...register("notes")}
            />
          </div>

          {/* Conflict warning – shows automatically when there are clashes */}
          <ConflictWarning conflicts={conflicts} />

          {/* Server error */}
          {serverError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <p className="text-destructive text-sm">
                {serverError}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
