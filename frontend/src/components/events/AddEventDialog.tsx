import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Plus } from "lucide-react";

import { createEvent } from "@/api/events";
import type { PlannerEvent, EventFlexibility } from "@/api/events";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  onEventAdded: (event: PlannerEvent) => void;
}

export default function AddEventDialog({ onEventAdded }: Props) {
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
      flexibility: "fixed",
      is_recurring: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const event = await createEvent({
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
      onEventAdded(event);
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
        setServerError("Failed to add event. Please try again.");
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { reset(); setServerError(null); }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Add Event
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a personal event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ev_title">Title</Label>
            <Input
              id="ev_title"
              placeholder="e.g. Church service"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-destructive text-xs">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ev_desc">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="ev_desc"
              placeholder="Brief description..."
              {...register("description")}
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="ev_date">Date</Label>
            <Controller
              name="event_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="ev_date"
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

          {/* Start and end time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev_start">
                Start time{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Controller
                name="start_time"
                control={control}
                render={({ field }) => (
                  <TimePicker
                    id="ev_start"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    clearable
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev_end">
                End time{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Controller
                name="end_time"
                control={control}
                render={({ field }) => (
                  <TimePicker
                    id="ev_end"
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

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="ev_location">
              Location{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="ev_location"
              placeholder="e.g. Community Centre"
              {...register("location")}
            />
          </div>

          {/* Flexibility */}
          <div className="space-y-1.5">
            <Label>Flexibility</Label>
            <Controller
              name="flexibility"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
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
            {errors.flexibility && (
              <p className="text-destructive text-xs">{errors.flexibility.message}</p>
            )}
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <Controller
              name="is_recurring"
              control={control}
              render={({ field }) => (
                <input
                  id="ev_recurring"
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
              )}
            />
            <Label htmlFor="ev_recurring" className="cursor-pointer font-normal">
              This is a recurring event
            </Label>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ev_notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="ev_notes"
              placeholder="Anything else to note..."
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add event"}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}