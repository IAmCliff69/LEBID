import { useState } from "react";
import { Search, CheckCircle } from "lucide-react";

import { checkConflicts, checkDayConflicts } from "@/api/conflicts";
import type { ConflictCheckResponse } from "@/api/conflicts";
import ConflictWarning from "@/components/conflicts/ConflictWarning";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ConflictCheckerPage() {
  const [mode, setMode] = useState<"slot" | "day">("slot");

  // Slot check form
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);

  // Day check form
  const [dayDate, setDayDate] = useState("");

  const [result, setResult] = useState<ConflictCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSlotCheck = async () => {
    setTimeError(null);
    if (!date || !startTime || !endTime) return;
    if (endTime <= startTime) {
      setTimeError("End time must be after start time.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await checkConflicts({
        check_date: date,
        start_time: startTime,
        end_time: endTime,
      });
      setResult(res);
    } catch {
      setError("Failed to check conflicts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDayCheck = async () => {
    if (!dayDate) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await checkDayConflicts(dayDate);
      setResult(res);
    } catch {
      setError("Failed to check conflicts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Conflict Checker</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Check whether a time slot or a full day has any scheduling conflicts
          before committing to it.
        </p>
      </div>

      {/* Mode tabs */}
      <div
        role="group"
        className="flex items-center rounded-full border border-border bg-muted p-1 w-fit"
      >
        <button
          type="button"
          onClick={() => { setMode("slot"); setResult(null); }}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            mode === "slot"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Time slot
        </button>
        <button
          type="button"
          onClick={() => { setMode("day"); setResult(null); }}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            mode === "day"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Full day
        </button>
      </div>

      {/* Time slot form */}
      {mode === "slot" && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cc_date">Date</Label>
            <Input
              id="cc_date"
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setResult(null); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc_start">Start time</Label>
              <Input
                id="cc_start"
                type="time"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); setResult(null); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc_end">End time</Label>
              <Input
                id="cc_end"
                type="time"
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); setResult(null); }}
              />
            </div>
          </div>

          {timeError && (
            <p className="text-destructive text-xs">{timeError}</p>
          )}

          <Button
            onClick={handleSlotCheck}
            disabled={!date || !startTime || !endTime || loading}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            {loading ? "Checking..." : "Check this slot"}
          </Button>
        </div>
      )}

      {/* Full day form */}
      {mode === "day" && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cc_day">Date</Label>
            <Input
              id="cc_day"
              type="date"
              value={dayDate}
              onChange={(e) => { setDayDate(e.target.value); setResult(null); }}
            />
          </div>

          <Button
            onClick={handleDayCheck}
            disabled={!dayDate || loading}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            {loading ? "Checking..." : "Scan this day"}
          </Button>
        </div>
      )}

      {/* API error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {result.has_conflicts ? (
            <ConflictWarning conflicts={result.conflicts} />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/10 px-4 py-3">
              <CheckCircle className="h-5 w-5 shrink-0 text-success" />
              <p className="text-sm font-medium text-success">
                {result.message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}