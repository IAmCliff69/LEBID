import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createStudySession } from "@/api/studySessions";
import type {
  StudySession,
  StudySessionPriority,
} from "@/api/studySessions";
import type { Course } from "@/api/courses";   // useState is probably already there – just make sure useEffect is imported too
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
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Plus } from "lucide-react";

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
  /** Courses already loaded by the planner page. */
  courses: Course[];
  /** Pre-fills the date field (format: YYYY-MM-DD). */
  defaultDate?: string;
  /** Called after the backend confirms the session was created. */
  onSessionAdded: (session: StudySession) => void;
}

export default function AddStudySessionDialog({
  courses,
  defaultDate = "",
  onSessionAdded,
}: Props) {
  const [open, setOpen] = useState(false);
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
    defaultValues: {
      course_id: "",
      topic: "",
      session_date: defaultDate,
      start_time: "",
      end_time: "",
      venue: "",
      priority: "medium",
      notes: "",
    },
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

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    try {
      const session = await createStudySession({
        course_id: data.course_id,
        topic: data.topic?.trim() || null,
        session_date: data.session_date,
        start_time: data.start_time,
        end_time: data.end_time,
        venue: data.venue.trim(),
        priority: data.priority as StudySessionPriority,
        notes: data.notes?.trim() || null,
      });

      onSessionAdded(session);
      reset();
      setOpen(false);
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
          "Failed to create study session. Please try again."
        );
      }
    }
  };

  const handleDialogChange = (value: boolean) => {
    setOpen(value);

    if (value) {
      // Re-apply the default date each time the dialog opens
      reset({
        course_id: "",
        topic: "",
        session_date: defaultDate,
        start_time: "",
        end_time: "",
        venue: "",
        priority: "medium",
        notes: "",
      });
    } else {
      setServerError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Add Study Session
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a study session</DialogTitle>
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
                  value={field.value}
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

            {courses.length === 0 && (
              <p className="text-xs text-muted-foreground">
                You need to add a course before creating a study
                session.
              </p>
            )}

            {errors.course_id && (
              <p className="text-destructive text-xs">
                {errors.course_id.message}
              </p>
            )}
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <Label htmlFor="ss_topic">
              Topic{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>

            <Input
              id="ss_topic"
              placeholder="e.g. Normalisation"
              {...register("topic")}
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="ss_date">Date</Label>

            <Input
              id="ss_date"
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
              <Label htmlFor="ss_start">Start time</Label>

              <Input
                id="ss_start"
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
              <Label htmlFor="ss_end">End time</Label>

              <Input
                id="ss_end"
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
              <Label htmlFor="ss_venue">Venue</Label>

              <Input
                id="ss_venue"
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
                    value={field.value}
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
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ss_notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>

            <Textarea
              id="ss_notes"
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
              onClick={() => handleDialogChange(false)}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}