import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  CalendarClock,
  BarChart2,
  Library,
  BookOpen,
  LogOut,
  AlertCircle,
  Calendar,
  FileUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Courses", to: "/courses", icon: Library },
  { label: "Timetable", to: "/timetable", icon: CalendarDays },
  { label: "Study Planner", to: "/planner", icon: CalendarClock },
  { label: "Tasks", to: "/tasks", icon: ClipboardList },
  { label: "Assignments", to: "/assignments", icon: BookOpen },
  { label: "Exams", to: "/exams", icon: GraduationCap },
  { label: "Events", to: "/events", icon: Calendar },
  { label: "Analytics", to: "/analytics", icon: BarChart2 },
  { label: "Import Timetable", to: "/timetable-import", icon: FileUp },
  { label: "Conflict Checker", to: "/conflicts", icon: AlertCircle },
];

export default function Sidebar() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <aside className="sticky top-0 flex h-screen w-18 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-sidebar-border">
        <div
          className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          aria-label="Lebid"
          title="Lebid"
        >
          <span className="text-sm font-bold">L</span>
        </div>
      </div>

      {/* Navigation — flex column that fills all available space and
          distributes items evenly so nothing is ever clipped */}
      <nav
        aria-label="Main navigation"
        className="flex flex-1 flex-col px-2 py-3"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                // Each item stretches to fill its equal share of the nav height
                "group flex flex-1 w-full items-center justify-center rounded-xl",
                "transition-all duration-200 min-h-0",
                "focus-visible:outline-2 focus-visible:outline-offset-2",
                "focus-visible:outline-sidebar-ring",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "size-5 shrink-0 transition-transform duration-200",
                    !isActive && "group-hover:scale-105"
                  )}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span className="sr-only">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-9 w-full items-center justify-center rounded-xl text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </aside>
  );
}