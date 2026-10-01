import { AlertTriangle, Clock, GraduationCap, BookOpen, Calendar } from "lucide-react";
import type { ConflictItem } from "@/api/conflicts";

const TYPE_ICON: Record<string, React.ElementType> = {
  timetable_entry: GraduationCap,
  study_session: BookOpen,
  event: Calendar,
  exam: AlertTriangle,
};

const TYPE_LABEL: Record<string, string> = {
  timetable_entry: "Lecture / class",
  study_session: "Study session",
  event: "Personal event",
  exam: "Exam",
};

interface Props {
  conflicts: ConflictItem[];
}

export default function ConflictWarning({ conflicts }: Props) {
  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
        <p className="text-xs font-semibold text-warning">
          {conflicts.length === 1
            ? "This time slot has a conflict"
            : `This time slot has ${conflicts.length} conflicts`}
        </p>
      </div>

      <div className="space-y-1.5">
        {conflicts.map((c, i) => {
          const Icon = TYPE_ICON[c.conflict_type] ?? Clock;
          return (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-card/70 px-3 py-2"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                  {TYPE_LABEL[c.conflict_type] ?? c.conflict_type}
                </p>
                <p className="text-xs text-secondary-foreground">{c.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-warning">
        You can still save — this is a warning, not a block.
      </p>
    </div>
  );
}