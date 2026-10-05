import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { discardImport, getPendingImport } from "@/api/timetableImport";
import type { PendingImport } from "@/api/timetableImport";
import { useOnboarding } from "@/context/OnboardingContext";

// Shown on the onboarding upload page when the student already uploaded a
// timetable earlier but did not finish. They can carry on with it (no new AI
// request) or throw it away and upload a different one.
export default function PendingUploadBanner() {
  const navigate = useNavigate();
  const { setExtraction, setTimetableFile, setStudyPlan } = useOnboarding();
  const [pending, setPending] = useState<PendingImport | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPendingImport()
      .then((result) => {
        if (!cancelled) setPending(result);
      })
      .catch(() => {
        // Not important enough to bother the student with.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing earlier to continue with (or it found no classes).
  if (!pending || pending.extracted_entries.length === 0) return null;

  const classCount = pending.extracted_entries.length;

  const handleContinue = () => {
    // Use the earlier upload as if it had just been processed.
    setTimetableFile(null);
    setStudyPlan(null);
    setExtraction(pending);
    navigate("/onboarding/study-preferences", { replace: true });
  };

  const handleDiscard = async () => {
    const importId = pending.import_id;
    setPending(null);
    try {
      await discardImport(importId);
    } catch {
      // If this fails, it is simply offered again next time.
    }
  };

  return (
    <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left">
      <p className="text-sm font-semibold text-foreground">
        You already uploaded a timetable
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {pending.original_filename} · {classCount}{" "}
        {classCount === 1 ? "class" : "classes"} found · uploaded{" "}
        {new Date(pending.created_at).toLocaleDateString()}. Continue with it,
        with no need to upload again.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleContinue}
          className="h-9 rounded-lg bg-foreground px-4 text-xs font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98]"
        >
          CONTINUE WITH THIS UPLOAD
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          className="h-9 rounded-lg border border-input bg-background px-4 text-xs font-semibold text-foreground transition-all hover:border-primary/60 active:scale-[0.98]"
        >
          DISCARD IT
        </button>
      </div>
    </div>
  );
}