import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
<<<<<<< HEAD

=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
import { createAssignment } from "@/api/assignments";
import type { Assignment } from "@/api/assignments";
import { getCourses } from "@/api/courses";
import type { Course } from "@/api/courses";
<<<<<<< HEAD

=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
<<<<<<< HEAD

=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
<<<<<<< HEAD

=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
<<<<<<< HEAD

=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
import { Plus } from "lucide-react";

const PRIORITIES = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
<<<<<<< HEAD
  course_id: z.string().min(1, "Course is required"),
  date_assigned: z.string().optional(),
  deadline: z.string().min(1, "Deadline is required"),
=======
  course_id: z.string().optional(),
  date_assigned: z.string().optional(),
  deadline: z.string().optional(),
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
  estimated_hours: z.string().optional(),
  priority: z.string().min(1, "Priority is required"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onAssignmentAdded: (assignment: Assignment) => void;
}

<<<<<<< HEAD
export default function AddAssignmentDialog({
  onAssignmentAdded,
}: Props) {
=======
export default function AddAssignmentDialog({ onAssignmentAdded }: Props) {
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
<<<<<<< HEAD
    getCourses()
      .then(setCourses)
      .catch(console.error);
=======
    getCourses().then(setCourses).catch(console.error);
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
  }, []);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: "medium",
<<<<<<< HEAD
      course_id: "",
      deadline: "",
=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
    },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
<<<<<<< HEAD

=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
    try {
      const assignment = await createAssignment({
        title: data.title,
        description: data.description || null,
<<<<<<< HEAD
        course_id: data.course_id,
        date_assigned: data.date_assigned || null,
        deadline: data.deadline,
=======
        course_id: data.course_id || null,
        date_assigned: data.date_assigned || null,
        deadline: data.deadline || null,
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
        estimated_hours: data.estimated_hours
          ? parseFloat(data.estimated_hours)
          : null,
        priority: data.priority as Assignment["priority"],
        notes: data.notes || null,
      });
<<<<<<< HEAD

      onAssignmentAdded(assignment);

      reset();
      setOpen(false);
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            detail?: unknown;
          };
        };
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
          "Failed to create assignment. Please try again."
        );
=======
      onAssignmentAdded(assignment);
      reset();
      setOpen(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } };
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        setServerError(detail);
      } else if (Array.isArray(detail)) {
        setServerError(detail.map((d: { msg?: string }) => d.msg).join(", "));
      } else {
        setServerError("Failed to create assignment. Please try again.");
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
      }
    }
  };

<<<<<<< HEAD
  const handleDialogChange = (value: boolean) => {
    setOpen(value);

    if (!value) {
      reset();
      setServerError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
=======
  return (
    <Dialog open={open} onOpenChange={setOpen}>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Add Assignment
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an assignment</DialogTitle>
        </DialogHeader>

<<<<<<< HEAD
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 mt-2"
        >
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>

=======
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            <Input
              id="title"
              placeholder="e.g. Database Design Report"
              {...register("title")}
            />
<<<<<<< HEAD

            {errors.title && (
              <p className="text-destructive text-xs">
                {errors.title.message}
              </p>
=======
            {errors.title && (
              <p className="text-destructive text-xs">{errors.title.message}</p>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">
              Description{" "}
<<<<<<< HEAD
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>

=======
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            <Textarea
              id="description"
              placeholder="What does this assignment involve?"
              {...register("description")}
            />
          </div>

          {/* Course */}
          <div className="space-y-1.5">
<<<<<<< HEAD
            <Label>Course</Label>

=======
            <Label>
              Course{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            <Controller
              name="course_id"
              control={control}
              render={({ field }) => (
<<<<<<< HEAD
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
=======
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={String(course.id)}>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
                        {course.code} — {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
<<<<<<< HEAD

            {errors.course_id && (
              <p className="text-destructive text-xs">
                {errors.course_id.message}
              </p>
            )}
=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
          </div>

          {/* Date assigned and deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date_assigned">
                Date assigned{" "}
<<<<<<< HEAD
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>

=======
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
              <Input
                id="date_assigned"
                type="datetime-local"
                {...register("date_assigned")}
              />
            </div>
<<<<<<< HEAD

            <div className="space-y-1.5">
              <Label htmlFor="deadline">
                Deadline
              </Label>

=======
            <div className="space-y-1.5">
              <Label htmlFor="deadline">
                Deadline{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
              <Input
                id="deadline"
                type="datetime-local"
                {...register("deadline")}
              />
<<<<<<< HEAD

              {errors.deadline && (
                <p className="text-destructive text-xs">
                  {errors.deadline.message}
                </p>
              )}
=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            </div>
          </div>

          {/* Estimated hours and priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="estimated_hours">
                Estimated hours{" "}
<<<<<<< HEAD
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>

=======
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
              <Input
                id="estimated_hours"
                type="number"
                min={0.5}
                step={0.5}
                placeholder="e.g. 3"
                {...register("estimated_hours")}
              />
            </div>
<<<<<<< HEAD

            <div className="space-y-1.5">
              <Label>Priority</Label>

=======
            <div className="space-y-1.5">
              <Label>Priority</Label>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
<<<<<<< HEAD
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>

                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem
                          key={p.value}
                          value={p.value}
                        >
=======
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
<<<<<<< HEAD

              {errors.priority && (
                <p className="text-destructive text-xs">
                  {errors.priority.message}
                </p>
              )}
=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">
              Notes{" "}
<<<<<<< HEAD
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>

=======
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              {...register("notes")}
            />
          </div>

          {/* Server error */}
          {serverError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
<<<<<<< HEAD
              <p className="text-destructive text-sm">
                {serverError}
              </p>
=======
              <p className="text-destructive text-sm">{serverError}</p>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
<<<<<<< HEAD
              onClick={() => handleDialogChange(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add assignment"}
            </Button>
          </div>
=======
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add assignment"}
            </Button>
          </div>

>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
        </form>
      </DialogContent>
    </Dialog>
  );
}