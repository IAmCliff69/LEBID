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
import { createTask, updateTask } from "@/api/tasks";
import type { Task } from "@/api/tasks";
import { getCourses } from "@/api/courses";
import { toPickerValue } from "@/lib/taskFormat";

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const NO_COURSE = "__none__";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  course_id: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.string().min(1, "Priority is required"),
  estimated_duration: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const EMPTY: FormData = {
  title: "",
  description: "",
  course_id: "",
  deadline: "",
  priority: "medium",
  estimated_duration: "",
  notes: "",
};

interface TaskFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null; // null = add a new task, a task = edit it
}

// The phone version of the Add Task pop-up. The same form edits a task.
export default function TaskFormSheet({ open, onOpenChange, task }: TaskFormSheetProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });
  const editing = task !== null;

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
      task
        ? {
            title: task.title,
            description: task.description ?? "",
            course_id: task.course_id ? String(task.course_id) : "",
            deadline: toPickerValue(task.deadline),
            priority: task.priority,
            estimated_duration: task.estimated_duration_minutes
              ? String(task.estimated_duration_minutes)
              : "",
            notes: task.notes ?? "",
          }
        : EMPTY
    );
  }, [open, task, reset]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const payload = {
      title: data.title,
      description: data.description || null,
      course_id: data.course_id || null,
      deadline: data.deadline || null,
      priority: data.priority as Task["priority"],
      estimated_duration_minutes: data.estimated_duration
        ? parseInt(data.estimated_duration)
        : null,
      notes: data.notes || null,
    };

    try {
      if (task) {
        await updateTask(task.id, payload);
        toast.success("Task updated", { description: data.title });
      } else {
        await createTask(payload);
        toast.success("Task added", { description: data.title });
      }
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } };
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        setServerError(detail);
      } else if (Array.isArray(detail)) {
        setServerError(detail.map((d: { msg?: string }) => d.msg).join(", "));
      } else {
        setServerError(
          editing
            ? "Failed to update the task. Please try again."
            : "Failed to create the task. Please try again."
        );
      }
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit task" : "Add a task"}
    >
      <h2 className="mb-3 text-lg font-bold">{editing ? "Edit task" : "Add a task"}</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="task-title">Title</Label>
          <Input id="task-title" placeholder="e.g. Submit lab report" {...register("title")} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="task-description"
            placeholder="Any additional details..."
            {...register("description")}
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            Course <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Controller
            name="course_id"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => field.onChange(value === NO_COURSE ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COURSE}>No course</SelectItem>
                  {(courses.data ?? []).map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.code} — {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-deadline">
            Deadline <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Controller
            name="deadline"
            control={control}
            render={({ field }) => (
              <DateTimePicker
                id="task-deadline"
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder="Pick date and time"
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
                <Select onValueChange={field.onChange} value={field.value}>
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
            <Label htmlFor="task-duration">Minutes</Label>
            <Input
              id="task-duration"
              type="number"
              inputMode="numeric"
              min={5}
              placeholder="e.g. 60"
              {...register("estimated_duration")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-notes">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="task-notes" placeholder="Anything to remember..." {...register("notes")} />
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
            {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add task"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}