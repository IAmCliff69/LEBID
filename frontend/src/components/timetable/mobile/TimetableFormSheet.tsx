import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import BottomSheet from "@/components/mobile/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { getCourses } from "@/api/courses";
import { createTimetableEntry, updateTimetableEntry } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";
import { DAY_NAMES } from "@/lib/timetableWeek";

const CLASS_TYPES = [
  { label: "Lecture", value: "lecture" },
  { label: "Tutorial", value: "tutorial" },
  { label: "Lab", value: "lab" },
  { label: "Practical", value: "practical" },
  { label: "Other", value: "other" },
];

const schema = z
  .object({
    course_id: z.string().optional(),
    day: z.string().min(1, "Please select a day"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    class_type: z.string().min(1, "Please select a class type"),
    venue: z.string().optional(),
    lecturer: z.string().optional(),
  })
  .refine(
    (data) => !data.start_time || !data.end_time || data.end_time > data.start_time,
    { message: "End time must be after start time", path: ["end_time"] }
  );

type FormData = z.infer<typeof schema>;

interface TimetableFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimetableEntry | null; // null = add a class, an entry = edit it
  defaultDay: number; // the day pre-selected when adding
}

// The phone version of Add Class. The same form edits a class (the course
// can't be changed when editing, like on desktop).
export default function TimetableFormSheet({
  open,
  onOpenChange,
  entry,
  defaultDay,
}: TimetableFormSheetProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });
  const editing = entry !== null;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { class_type: "lecture", day: String(defaultDay) },
  });

  // Fill the form each time the sheet opens
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    reset(
      entry
        ? {
            course_id: String(entry.course_id),
            day: String(entry.day_of_week),
            start_time: entry.start_time.slice(0, 5),
            end_time: entry.end_time.slice(0, 5),
            class_type: entry.class_type.toLowerCase(),
            venue: entry.venue ?? "",
            lecturer: entry.lecturer ?? "",
          }
        : {
            course_id: "",
            day: String(defaultDay),
            start_time: "",
            end_time: "",
            class_type: "lecture",
            venue: "",
            lecturer: "",
          }
    );
  }, [open, entry, defaultDay, reset]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    if (!entry && !data.course_id) {
      setServerError("Please select a course.");
      return;
    }

    try {
      if (entry) {
        const updated = await updateTimetableEntry(entry.id, {
          day_of_week: parseInt(data.day),
          start_time: `${data.start_time}:00`,
          end_time: `${data.end_time}:00`,
          class_type: data.class_type,
          venue: data.venue || null,
          lecturer: data.lecturer || null,
        });
        toast.success("Class updated", {
          description: `${updated.course_code} ${updated.class_type}`,
        });
      } else {
        const created = await createTimetableEntry({
          course_id: data.course_id as string,
          day_of_week: parseInt(data.day),
          start_time: `${data.start_time}:00`,
          end_time: `${data.end_time}:00`,
          venue: data.venue || null,
          class_type: data.class_type,
          lecturer: data.lecturer || null,
        });
        toast.success("Class added", {
          description: `${created.course_code} ${created.class_type}`,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["timetable"] });
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } };
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        setServerError(detail);
      } else {
        setServerError(
          editing
            ? "Failed to update the class. Please try again."
            : "Failed to add the class. Please try again."
        );
      }
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit class" : "Add a class"}
    >
      <h2 className="mb-3 text-lg font-bold">{editing ? "Edit class" : "Add a class"}</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Course (only when adding) */}
        {editing ? (
          <div className="rounded-2xl bg-muted/60 px-4 py-3">
            <p className="text-xs text-muted-foreground">Course</p>
            <p className="text-sm font-semibold">
              {entry.course_code} — {entry.course_name}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Controller
              name="course_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {(courses.data ?? []).map((course) => (
                      <SelectItem key={course.id} value={String(course.id)}>
                        {course.code} — {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {courses.isError && (
              <p className="text-xs text-destructive">
                Unable to load your courses. Please try again.
              </p>
            )}
            {courses.data && courses.data.length === 0 && (
              <p className="text-xs text-muted-foreground">
                You have no courses yet. Add one under More, then Courses.
              </p>
            )}
          </div>
        )}

        {/* Day */}
        <div className="space-y-1.5">
          <Label>Day</Label>
          <Controller
            name="day"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, index) => (
                    <SelectItem key={name} value={String(index)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.day && <p className="text-xs text-destructive">{errors.day.message}</p>}
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tt-start">Start time</Label>
            <Controller
              name="start_time"
              control={control}
              render={({ field }) => (
                <TimePicker
                  id="tt-start"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.start_time}
                />
              )}
            />
            {errors.start_time && (
              <p className="text-xs text-destructive">{errors.start_time.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tt-end">End time</Label>
            <Controller
              name="end_time"
              control={control}
              render={({ field }) => (
                <TimePicker
                  id="tt-end"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.end_time}
                />
              )}
            />
            {errors.end_time && (
              <p className="text-xs text-destructive">{errors.end_time.message}</p>
            )}
          </div>
        </div>

        {/* Class type */}
        <div className="space-y-1.5">
          <Label>Class type</Label>
          <Controller
            name="class_type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Venue and lecturer */}
        <div className="space-y-1.5">
          <Label htmlFor="tt-venue">
            Venue <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="tt-venue" placeholder="e.g. Room 204" {...register("venue")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tt-lecturer">
            Lecturer <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="tt-lecturer" placeholder="e.g. Dr. Mensah" {...register("lecturer")} />
        </div>

        {serverError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{serverError}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-12 flex-1 rounded-full">
            {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add class"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}