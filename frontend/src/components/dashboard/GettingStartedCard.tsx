import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";

import { getCourses } from "@/api/courses";
import { getStudySessions } from "@/api/studySessions";
import { getTimetable } from "@/api/timetable";

// Shown only to brand-new accounts. It disappears by itself once the student
// has a timetable, courses and study sessions.
export default function GettingStartedCard() {
  const courses = useQuery({ queryKey: ["courses"], queryFn: getCourses });
  const timetable = useQuery({ queryKey: ["timetable"], queryFn: getTimetable });
  const sessions = useQuery({
    queryKey: ["study-sessions", "any"],
    queryFn: () => getStudySessions(),
  });

  // Wait until we KNOW the answers (no flashing while loading)
  if (courses.isLoading || timetable.isLoading || sessions.isLoading) return null;
  if (courses.isError || timetable.isError || sessions.isError) return null;

  // The timetable comes first: importing it also creates the courses.
  const steps = [
    {
      label: "Add your timetable",
      done: (timetable.data?.length ?? 0) > 0,
      to: "/timetable-import",
    },
    { label: "Add your courses", done: (courses.data?.length ?? 0) > 0, to: "/courses" },
    {
      label: "Plan your study sessions",
      done: (sessions.data?.length ?? 0) > 0,
      to: "/planner",
    },
  ];

  const nextStep = steps.find((step) => !step.done);
  if (!nextStep) return null; // everything is set up: hide the card

  return (
    <section className="shrink-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 dashboard-fit:p-3 dashboard-fit:px-4">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between dashboard-fit:gap-4">
        <div className="min-w-0 dashboard-fit:flex dashboard-fit:flex-1 dashboard-fit:items-center dashboard-fit:gap-6">
          <div>
            <h3 className="text-sm font-semibold">
              Keep your academic life organized
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground dashboard-fit:hidden">
              Add your timetable, your courses, and your study sessions to get
              the most out of Lebid.
            </p>
          </div>

          <ul className="mt-3 space-y-1.5 dashboard-fit:mt-0 dashboard-fit:flex dashboard-fit:flex-wrap dashboard-fit:gap-x-5 dashboard-fit:space-y-0">
            {steps.map((step) => (
              <li
                key={step.label}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                {step.done ? (
                  <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                ) : (
                  <Circle className="size-4" aria-hidden="true" />
                )}
                <span className={step.done ? "line-through" : "text-foreground"}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          to={nextStep.to}
          className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-center text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dashboard-fit:py-2"
        >
          {nextStep.label}
        </Link>
      </div>
    </section>
  );
}