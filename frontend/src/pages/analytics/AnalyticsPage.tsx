import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  BookOpen,
  ClipboardList,
  FileText,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

import apiClient from "@/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "this_week" | "last_week" | "this_month" | "last_month";

interface StudyHours {
  period: string;
  planned_hours: number;
  completed_hours: number;
  skipped_hours: number;
  total_sessions: number;
  completed_sessions: number;
  skipped_sessions: number;
  missed_sessions: number;
  completion_rate_percent: number;
}

interface CourseDistribution {
  course_id: string;
  course_name: string;
  course_code: string | null;
  hours: number;
  percentage: number;
}

interface TaskAnalytics {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  pending_tasks: number;
  completion_rate_percent: number;
}

interface AssignmentAnalytics {
  total_assignments: number;
  completed_assignments: number;
  overdue_assignments: number;
  pending_assignments: number;
  completion_rate_percent: number;
}

interface WorkloadOverview {
  assignments_due_in_7_days: number;
  assignments_due_in_14_days: number;
  assignments_due_in_30_days: number;
  exams_in_14_days: number;
  exams_in_30_days: number;
  missed_study_sessions: number;
  overdue_assignments: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#023EBA";
const PALETTE = ["#023EBA", "#0077B6", "#0096C7", "#00B4D8", "#48CAE4", "#90E0EF"];

const PERIOD_LABELS: Record<Period, string> = {
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
};

const PERIODS: Period[] = ["this_week", "last_week", "this_month", "last_month"];

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 ${
        warn
          ? "border-red-200 bg-red-50"
          : accent
            ? "border-[#CAF0F8] bg-[#f4fbff]"
            : "border-border bg-card"
      }`}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          warn ? "text-red-600" : accent ? "text-[#023EBA]" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-[#023EBA]" />
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("this_week");

  const [studyHours, setStudyHours] = useState<StudyHours | null>(null);
  const [courseDistribution, setCourseDistribution] = useState<
    CourseDistribution[]
  >([]);
  const [tasks, setTasks] = useState<TaskAnalytics | null>(null);
  const [assignments, setAssignments] = useState<AssignmentAnalytics | null>(
    null
  );
  const [workload, setWorkload] = useState<WorkloadOverview | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [shRes, cdRes, tRes, aRes, wRes] = await Promise.all([
          apiClient.get(`/analytics/study-hours?period=${period}`),
          apiClient.get(`/analytics/course-distribution?period=${period}`),
          apiClient.get(`/analytics/tasks?period=${period}`),
          apiClient.get(`/analytics/assignments?period=${period}`),
          apiClient.get("/analytics/workload"),
        ]);
        setStudyHours(shRes.data);
        setCourseDistribution(cdRes.data);
        setTasks(tRes.data);
        setAssignments(aRes.data);
        setWorkload(wRes.data);
      } catch {
        setError("Failed to load analytics. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  // Build bar chart data: planned vs completed study hours
  const studyBarData = studyHours
    ? [
        {
          name: "Planned",
          hours: studyHours.planned_hours,
          fill: "#CAF0F8",
        },
        {
          name: "Completed",
          hours: studyHours.completed_hours,
          fill: PRIMARY,
        },
        {
          name: "Skipped",
          hours: studyHours.skipped_hours,
          fill: "#FDA4AF",
        },
      ]
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* ── Header ──────────────────────────────────────────────────── */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Your study habits and academic progress.
          </p>
        </div>

        {/* Period selector */}
        <div
          role="group"
          aria-label="Select period"
          className="flex items-center rounded-full border border-slate-200 bg-slate-100 p-1 self-start sm:self-auto"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                period === p
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div
            className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200"
            style={{ borderTopColor: PRIMARY }}
          />
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">

          {/* ── Study hours ─────────────────────────────────────────── */}

          <section className="space-y-4">
            <SectionHeading icon={BookOpen} title="Study hours" />

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Planned"
                value={`${studyHours?.planned_hours ?? 0}h`}
                accent
              />
              <StatCard
                label="Completed"
                value={`${studyHours?.completed_hours ?? 0}h`}
                accent
              />
              <StatCard
                label="Completion rate"
                value={`${studyHours?.completion_rate_percent ?? 0}%`}
                accent
              />
              <StatCard
                label="Missed sessions"
                value={studyHours?.missed_sessions ?? 0}
                warn={
                  studyHours !== null && studyHours.missed_sessions > 0
                }
              />
            </div>

            {/* Bar chart */}
            {studyHours &&
              studyHours.planned_hours +
                studyHours.completed_hours +
                studyHours.skipped_hours >
                0 ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Hours breakdown
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={studyBarData}
                    barCategoryGap="40%"
                    margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [`${value ?? 0}h`, "Hours"]}
                      contentStyle={{
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                      {studyBarData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No study sessions recorded for this period.
                </p>
              </div>
            )}
          </section>

          {/* ── Course distribution ──────────────────────────────────── */}

          <section className="space-y-4">
            <SectionHeading icon={TrendingUp} title="Course distribution" />
            <p className="text-xs text-muted-foreground -mt-2">
              Completed study hours by course
            </p>

            {courseDistribution.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Pie chart */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={courseDistribution}
                        dataKey="hours"
                        nameKey="course_code"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={3}
                      >
                        {courseDistribution.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PALETTE[i % PALETTE.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value ?? 0}h`, "Hours"]}
                        contentStyle={{
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex flex-col justify-center space-y-2">
                  {courseDistribution.map((c, i) => (
                    <div key={c.course_id} className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor: PALETTE[i % PALETTE.length],
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {c.course_code
                            ? `${c.course_code} — ${c.course_name}`
                            : c.course_name}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.hours}h ({c.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No completed study sessions to show distribution.
                </p>
              </div>
            )}
          </section>

          {/* ── Tasks and assignments ────────────────────────────────── */}

          <section className="space-y-4">
            <SectionHeading icon={ClipboardList} title="Tasks" />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total" value={tasks?.total_tasks ?? 0} />
              <StatCard
                label="Completed"
                value={tasks?.completed_tasks ?? 0}
                accent
              />
              <StatCard
                label="Pending"
                value={tasks?.pending_tasks ?? 0}
              />
              <StatCard
                label="Overdue"
                value={tasks?.overdue_tasks ?? 0}
                warn={tasks !== null && tasks.overdue_tasks > 0}
              />
            </div>

            {tasks && tasks.total_tasks > 0 && (
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    Completion rate
                  </p>
                  <p className="text-xs font-semibold text-slate-800">
                    {tasks.completion_rate_percent}%
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${tasks.completion_rate_percent}%`,
                      backgroundColor: PRIMARY,
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading icon={FileText} title="Assignments" />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Total"
                value={assignments?.total_assignments ?? 0}
              />
              <StatCard
                label="Completed"
                value={assignments?.completed_assignments ?? 0}
                accent
              />
              <StatCard
                label="Pending"
                value={assignments?.pending_assignments ?? 0}
              />
              <StatCard
                label="Overdue"
                value={assignments?.overdue_assignments ?? 0}
                warn={
                  assignments !== null && assignments.overdue_assignments > 0
                }
              />
            </div>

            {assignments && assignments.total_assignments > 0 && (
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    Completion rate
                  </p>
                  <p className="text-xs font-semibold text-slate-800">
                    {assignments.completion_rate_percent}%
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${assignments.completion_rate_percent}%`,
                      backgroundColor: PRIMARY,
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* ── Upcoming workload ────────────────────────────────────── */}

          <section className="space-y-4">
            <SectionHeading icon={AlertTriangle} title="Upcoming workload" />
            <p className="text-xs text-muted-foreground -mt-2">
              Always shows your next 30 days regardless of the period filter
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="Assignments due (7d)"
                value={workload?.assignments_due_in_7_days ?? 0}
                warn={
                  workload !== null &&
                  workload.assignments_due_in_7_days > 0
                }
              />
              <StatCard
                label="Assignments due (14d)"
                value={workload?.assignments_due_in_14_days ?? 0}
              />
              <StatCard
                label="Assignments due (30d)"
                value={workload?.assignments_due_in_30_days ?? 0}
              />
              <StatCard
                label="Exams (14d)"
                value={workload?.exams_in_14_days ?? 0}
                warn={
                  workload !== null && workload.exams_in_14_days > 0
                }
              />
              <StatCard
                label="Exams (30d)"
                value={workload?.exams_in_30_days ?? 0}
              />
              <StatCard
                label="Missed sessions"
                value={workload?.missed_study_sessions ?? 0}
                warn={
                  workload !== null &&
                  workload.missed_study_sessions > 0
                }
              />
            </div>

            {workload && workload.overdue_assignments > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">
                  You have{" "}
                  <span className="font-bold">
                    {workload.overdue_assignments}
                  </span>{" "}
                  overdue assignment
                  {workload.overdue_assignments === 1 ? "" : "s"} that
                  {workload.overdue_assignments === 1 ? " needs" : " need"}{" "}
                  attention.
                </p>
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}