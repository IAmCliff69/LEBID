import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListTodo,
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getAssignments } from "@/api/assignments";
import { getStudySessions } from "@/api/studySessions";
import { getTasks } from "@/api/tasks";
import { getTimetable } from "@/api/timetable";
import { useAuth } from "@/context/AuthContext";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const overviewCards = [
  {
    label: "Today's Classes",
    description: "Your scheduled classes for today",
    icon: CalendarDays,
    href: "/timetable",
  },
  {
    label: "Upcoming Deadlines",
    description: "Assignments and tasks coming up",
    icon: Clock3,
    href: "/assignments",
  },
  {
    label: "Study Sessions",
    description: "Planned study sessions",
    icon: BookOpen,
    href: "/planner",
  },
];

const quickActions = [
  {
    label: "View timetable",
    description: "Check today's and upcoming classes",
    icon: CalendarDays,
    href: "/timetable",
  },
  {
    label: "Manage tasks",
    description: "Review what needs to get done",
    icon: ListTodo,
    href: "/tasks",
  },
  {
    label: "View courses",
    description: "Keep track of your courses",
    icon: BookOpen,
    href: "/courses",
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const [timetable, assignments, tasks, studySessions] = await Promise.all([
        getTimetable(),
        getAssignments(),
        getTasks(),
        getStudySessions({
          date_from: toDateKey(new Date()),
          date_to: toDateKey(new Date()),
        }),
      ]);
      const today = new Date();
      const todayKey = toDateKey(today);
      const weekday = (today.getDay() + 6) % 7;
      const upcomingDeadlines = [...assignments, ...tasks].filter((item) => {
        return (
          item.status !== "completed" &&
          item.deadline !== null &&
          item.deadline.slice(0, 10) >= todayKey
        );
      }).length;

      return {
        classesToday: timetable.filter((entry) => entry.day_of_week === weekday)
          .length,
        upcomingDeadlines,
        studySessions: studySessions.filter(
          (session) =>
            session.status === "planned" || session.status === "in_progress"
        ).length,
      };
    },
  });

  const firstName =
  user?.full_name?.split(" ")[0] ?? "Student";

  const overviewValues = [
    overviewQuery.data?.classesToday,
    overviewQuery.data?.upcomingDeadlines,
    overviewQuery.data?.studySessions,
  ];

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Welcome */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative">
            <div className="mb-3 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Your academic workspace
            </div>

            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, {firstName}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Stay on top of your classes, tasks, assignments, and study
              sessions from one place.
            </p>
          </div>
        </section>

        {/* Overview */}
        <section>
          <div className="mb-4">
            <h3 className="text-base font-semibold tracking-tight">
              Your overview
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              A quick look at what's happening in your academic schedule.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {overviewCards.map((card, index) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.label}
                  to={card.href}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {card.label}
                      </p>

                      <p className="mt-3 text-3xl font-bold tracking-tight">
                        {overviewQuery.isLoading
                          ? "..."
                          : overviewValues[index] ?? "—"}
                      </p>
                    </div>

                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" />
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </Link>
              );
            })}
          </div>
          {overviewQuery.isError && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-destructive">
              <p>Dashboard data could not be loaded.</p>
              <button
                type="button"
                onClick={() => overviewQuery.refetch()}
                className="font-semibold underline underline-offset-4"
              >
                Retry
              </button>
            </div>
          )}
        </section>

        {/* Quick access */}
        <section>
          <div className="mb-4">
            <h3 className="text-base font-semibold tracking-tight">
              Quick access
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Jump straight into the areas you use most.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  to={action.href}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:bg-primary/3 hover:shadow-sm"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{action.label}</p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>

                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Getting started */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle2 className="size-5" />
              </div>

              <div>
                <h3 className="text-sm font-semibold">
                  Keep your academic life organized
                </h3>

                <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                  Add your courses, build your timetable, create tasks, and
                  plan your study sessions to get the most out of Lebid.
                </p>
              </div>
            </div>

            <Link
              to="/courses"
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Let's get started
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}