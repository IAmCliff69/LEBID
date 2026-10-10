import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";

import { updateEvent } from "@/api/events";
import type { PlannerEvent, EventFlexibility } from "@/api/events";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

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

const FLEXIBILITY_OPTIONS: { label: string; value: EventFlexibility }[] = [
  { label: "Fixed — cannot be moved", value: "fixed" },
  { label: "Flexible — can be rescheduled", value: "flexible" },
  { label: "Protected — important, keep if possible", value: "protected" },
];

function toTimeInput(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

const schema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    event_date: z.string().min(1, "Date is required"),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    location: z.string().optional(),
    flexibility: z.string().min(1, "Please select a flexibility type"),
    is_recurring: z.boolean(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.start_time || !data.end_time || data.end_time > data.start_time,
    {
      message: "End time must be after start time",
      path: ["end_time"],
    }
  );

type FormData = z.infer<typeof schema>;

interface Props {
  event: PlannerEvent;
  onEventUpdated: (event: PlannerEvent) => void;
}

export default function EditEventDialog({ event, onEventUpdated }: Props) {
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
      title: event.title,
      description: event.description ?? "",
      event_date: event.event_date,
      start_time: toTimeInput(event.start_time),
      end_time: toTimeInput(event.end_time),
      location: event.location ?? "",
      flexibility: event.flexibility,
      is_recurring: event.is_recurring,
      notes: event.notes ?? "",
    },
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      reset({
        title: event.title,
        description: event.description ?? "",
        event_date: event.event_date,
        start_time: toTimeInput(event.start_time),
        end_time: toTimeInput(event.end_time),
        location: event.location ?? "",
        flexibility: event.flexibility,
        is_recurring: event.is_recurring,
        notes: event.notes ?? "",
      });
      setServerError(null);
    }
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const updated = await updateEvent(event.id, {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        event_date: data.event_date,
        start_time: data.start_time ? data.start_time + ":00" : null,
        end_time: data.end_time ? data.end_time + ":00" : null,
        location: data.location?.trim() || null,
        flexibility: data.flexibility as EventFlexibility,
        is_recurring: data.is_recurring,
        notes: data.notes?.trim() || null,
      });
      onEventUpdated(updated);
      setOpen(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: unknown } } };
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        setServerError(detail);
      } else if (Array.isArray(detail)) {
        setServerError(detail.map((d: { msg?: string }) => d.msg).join(", "));
      } else {
        setServerError("Failed to update event. Please try again.");
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
          <DialogTitle>Edit event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          <div className="space-y-1.5">
            <Label htmlFor="eedit_title">Title</Label>
            <Input id="eedit_title" {...register("title")} />
            {errors.title && (
              <p className="text-destructive text-xs">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eedit_desc">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="eedit_desc" {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eedit_date">Date</Label>
            <Controller
              name="event_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="eedit_date"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.event_date}
                />
              )}
            />
            {errors.event_date && (
              <p className="text-destructive text-xs">{errors.event_date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eedit_start">
                Start time{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Controller
                name="start_time"
                control={control}
                render={({ field }) => (
                  <TimePicker
                    id="eedit_start"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    clearable
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eedit_end">
                End time{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Controller
                name="end_time"
                control={control}
                render={({ field }) => (
                  <TimePicker
                    id="eedit_end"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    clearable
                    invalid={!!errors.end_time}
                  />
                )}
              />
              {errors.end_time && (
                <p className="text-destructive text-xs">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eedit_loc">
              Location{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="eedit_loc"
              placeholder="e.g. Community Centre"
              {...register("location")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Flexibility</Label>
            <Controller
              name="flexibility"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLEXIBILITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center gap-3">
            <Controller
              name="is_recurring"
              control={control}
              render={({ field }) => (
                <input
                  id="eedit_recurring"
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
              )}
            />
            <Label htmlFor="eedit_recurring" className="cursor-pointer font-normal">
              This is a recurring event
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eedit_notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea id="eedit_notes" {...register("notes")} />
          </div>

          {serverError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              <p className="text-destructive text-sm">{serverError}</p>
            </div>
          )}

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