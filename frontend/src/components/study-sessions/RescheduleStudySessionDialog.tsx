import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { rescheduleStudySession } from "@/api/studySessions";
import type {
  StudySession,
  StudySessionPriority,
} from "@/api/studySessions";
import type { Course } from "@/api/courses";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

const schema = z
  .object({
    course_id: z.string().min(1, "Course is required"),
    topic: z.string().optional(),
    session_date: z.string().min(1, "Date is required"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    venue: z.string().trim().min(1, "Venue is required"),
    priority: z.string().min(1, "Priority is required"),
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
  /**
   * The session being rescheduled. The dialog is open whenever this is
   * not null. The backend will mark this session as "rescheduled" and
   * create a new session linked to it via rescheduled_from_id.
   */
  session: StudySession | null;
  courses: Course[];
  onClose: () => void;
  /** Called with the newly created replacement session. */
  onSessionRescheduled: (newSession: StudySession) => void;
}

function toInputTime(time: string): string {
  return time.slice(0, 5);
}

export default function RescheduleStudySessionDialog({
  session,
  courses,
  onClose,
  onSessionRescheduled,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Pre-fill with the original session's values so the student
  // only has to change what actually moved (usually just the date/time).
  useEffect(() => {
    if (session) {
      reset({
        course_id: String(session.course_id),
        topic: session.topic ?? "",
        session_date: session.session_date,
        start_time: toInputTime(session.start_time),
        end_time: toInputTime(session.end_time),
        venue: session.venue,
        priority: session.priority,
        notes: session.notes ?? "",
      });
      setServerError(null);
    }
  }, [session, reset]);

  const onSubmit = async (data: FormData) => {
    if (!session) return;
    setServerError(null);

    try {
      const newSession = await rescheduleStudySession(session.id, {
        course_id: data.course_id,
        topic: data.topic?.trim() || null,
        session_date: data.session_date,
        start_time: data.start_time,
        end_time: data.end_time,
        venue: data.venue.trim(),
        priority: data.priority as StudySessionPriority,
        notes: data.notes?.trim() || null,
        is_ai_generated: false,
      });

      onSessionRescheduled(newSession);
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
          "Failed to reschedule session. Please try again."
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
          <DialogTitle>Reschedule study session</DialogTitle>
        </DialogHeader>

        {/* Context note */}
        <p className="text-xs text-muted-foreground -mt-1">
          The original session will be marked as rescheduled and a
          new session will be created with the details below.
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 mt-1"
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
            <Label htmlFor="rs_topic">
              Topic{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>

            <Input
              id="rs_topic"
              placeholder="e.g. Normalisation"
              {...register("topic")}
            />
          </div>

          {/* New date */}
          <div className="space-y-1.5">
            <Label htmlFor="rs_date">New date</Label>

            <Input
              id="rs_date"
              type="date"
              {...register("session_date")}
            />

            {errors.session_date && (
              <p className="text-destructive text-xs">
                {errors.session_date.message}
              </p>
            )}
          </div>

          {/* New start and end time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rs_start">New start time</Label>

              <Input
                id="rs_start"
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
              <Label htmlFor="rs_end">New end time</Label>

              <Input
                id="rs_end"
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

          {/* Venue and priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rs_venue">Venue</Label>

              <Input
                id="rs_venue"
                placeholder="e.g. Library"
                {...register("venue")}
              />

              {errors.venue && (
                <p className="text-destructive text-xs">
                  {errors.venue.message}
                </p>
              )}
            </div>

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
                      <SelectValue placeholder="Priority" />
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
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="rs_notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>

            <Textarea
              id="rs_notes"
              placeholder="Reason for rescheduling..."
              {...register("notes")}
            />
          </div>

          {/* Server error */}
          {serverError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <p className="text-destructive text-sm">{serverError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Rescheduling..." : "Reschedule session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}