import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import BottomSheet from "@/components/mobile/BottomSheet";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAssignment, updateAssignment } from "@/api/assignments";
import type { Assignment } from "@/api/assignments";
import { getCourses } from "@/api/courses";
import { toPickerValue } from "@/lib/taskFormat";

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  course_id: z.string().min(1, "Course is required"),
  date_assigned: z.string().optional(),
  deadline: z.string().min(1, "Deadline is required"),
  estimated_hours: z.string().optional(),
  priority: z.string().min(1, "Priority is required"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const EMPTY: FormData = {
  title: "",
  description: "",
  course_id: "",
  date_assigned: "",
  deadline: "",
  estimated_hours: "",
  priority: "medium",
  notes: "",
};

interface AssignmentFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null; // null = add, an assignment = edit it
}

// The phone version of Add Assignment. The same form edits an assignment.
export default function AssignmentFormSheet({
  open,
  onOpenChange,
  assignment,
}: AssignmentFormSheetProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });
  const editing = assignment !== null;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // Fill the form each time the sheet opens
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    reset(
      assignment
        ? {
            title: assignment.title,
            description: assignment.description ?? "",
            course_id: assignment.course_id ? String(assignment.course_id) : "",
            date_assigned: toPickerValue(assignment.date_assigned),
            deadline: toPickerValue(assignment.deadline),
            estimated_hours: assignment.estimated_hours
              ? String(assignment.estimated_hours)
              : "",
            priority: assignment.priority,
            notes: assignment.notes ?? "",
          }
        : EMPTY
    );
  }, [open, assignment, reset]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const payload = {
      title: data.title,
      description: data.description || null,
      course_id: data.course_id,
      date_assigned: data.date_assigned || null,
      deadline: data.deadline,
      estimated_hours: data.estimated_hours ? parseFloat(data.estimated_hours) : null,
      priority: data.priority as Assignment["priority"],
      notes: data.notes || null,
    };

    try {
      if (assignment) {
        await updateAssignment(assignment.id, payload);
        toast.success("Assignment updated", { description: data.title });
      } else {
        await createAssignment(payload);
        toast.success("Assignment added", { description: data.title });
      }
      await queryClient.invalidateQueries({ queryKey: ["assignments"] });
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } };
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
          editing
            ? "Failed to update the assignment. Please try again."
            : "Failed to create the assignment. Please try again."
        );
      }
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit assignment" : "Add an assignment"}
    >
      <h2 className="mb-3 text-lg font-bold">
        {editing ? "Edit assignment" : "Add an assignment"}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="asg-title">Title</Label>
          <Input
            id="asg-title"
            placeholder="e.g. Database Design Report"
            {...register("title")}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="asg-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="asg-description"
            placeholder="What does this assignment involve?"
            {...register("description")}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Course</Label>
          <Controller
            name="course_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
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
          {errors.course_id && (
            <p className="text-xs text-destructive">{errors.course_id.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="asg-deadline">Deadline</Label>
          <Controller
            name="deadline"
            control={control}
            render={({ field }) => (
              <DateTimePicker
                id="asg-deadline"
                value={field.value ?? ""}
                onChange={field.onChange}
                invalid={!!errors.deadline}
              />
            )}
          />
          {errors.deadline && (
            <p className="text-xs text-destructive">{errors.deadline.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="asg-assigned">
            Date assigned <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Controller
            name="date_assigned"
            control={control}
            render={({ field }) => (
              <DateTimePicker
                id="asg-assigned"
                value={field.value ?? ""}
                onChange={field.onChange}
                defaultTime="09:00"
                clearable
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
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
            {errors.priority && (
              <p className="text-xs text-destructive">{errors.priority.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asg-hours">Hours</Label>
            <Input
              id="asg-hours"
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              placeholder="e.g. 3"
              {...register("estimated_hours")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="asg-notes">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="asg-notes" placeholder="Any additional notes..." {...register("notes")} />
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
            {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add assignment"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}