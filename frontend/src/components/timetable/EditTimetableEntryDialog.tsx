import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";

import { updateTimetableEntry } from "@/api/timetable";
import type { TimetableEntry } from "@/api/timetable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const DAYS = [
  { label: "Monday", value: "0" },
  { label: "Tuesday", value: "1" },
  { label: "Wednesday", value: "2" },
  { label: "Thursday", value: "3" },
  { label: "Friday", value: "4" },
  { label: "Saturday", value: "5" },
  { label: "Sunday", value: "6" },
];

const CLASS_TYPES = [
  { label: "Lecture", value: "lecture" },
  { label: "Tutorial", value: "tutorial" },
  { label: "Lab", value: "lab" },
  { label: "Practical", value: "practical" },
  { label: "Other", value: "other" },
];

// Strips seconds from "HH:MM:SS" → "HH:MM"
function toTimeInput(time: string): string {
  return time.slice(0, 5);
}

const schema = z.object({
  day: z.string().min(1, "Please select a day"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  class_type: z.string().min(1, "Please select a class type"),
  venue: z.string().optional(),
  lecturer: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  entry: TimetableEntry;
  onEntryUpdated: (entry: TimetableEntry) => void;
}

export default function EditTimetableEntryDialog({
  entry,
  onEntryUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      day: String(entry.day_of_week),
      start_time: toTimeInput(entry.start_time),
      end_time: toTimeInput(entry.end_time),
      class_type: entry.class_type,
      venue: entry.venue || "",
      lecturer: entry.lecturer || "",
    },
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      reset({
        day: String(entry.day_of_week),
        start_time: toTimeInput(entry.start_time),
        end_time: toTimeInput(entry.end_time),
        class_type: entry.class_type,
        venue: entry.venue || "",
        lecturer: entry.lecturer || "",
      });
      setServerError(null);
    }
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const updated = await updateTimetableEntry(entry.id, {
        day_of_week: parseInt(data.day),
        start_time: data.start_time + ":00",
        end_time: data.end_time + ":00",
        class_type: data.class_type,
        venue: data.venue || null,
        lecturer: data.lecturer || null,
      });
      onEntryUpdated(updated);
      setOpen(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } };
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        setServerError(detail);
      } else {
        setServerError("Failed to update entry. Please try again.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit class</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          {/* Day */}
          <div className="space-y-1.5">
            <Label>Day</Label>
            <Controller
              name="day"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.day && (
              <p className="text-destructive text-xs">{errors.day.message}</p>
            )}
          </div>

          {/* Start and end time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Start time</Label>
              <Input id="edit-start" type="time" {...register("start_time")} />
              {errors.start_time && (
                <p className="text-destructive text-xs">{errors.start_time.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">End time</Label>
              <Input id="edit-end" type="time" {...register("end_time")} />
              {errors.end_time && (
                <p className="text-destructive text-xs">{errors.end_time.message}</p>
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
                <Select onValueChange={field.onChange} value={field.value}>
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

          {/* Venue */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-venue">
              Venue{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="edit-venue"
              placeholder="e.g. Room 204"
              {...register("venue")}
            />
          </div>

          {/* Lecturer */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-lecturer">
              Lecturer{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="edit-lecturer"
              placeholder="e.g. Dr. Mensah"
              {...register("lecturer")}
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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