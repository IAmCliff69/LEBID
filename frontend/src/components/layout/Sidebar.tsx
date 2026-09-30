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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const navItems = [
<<<<<<< HEAD
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Courses",
    to: "/courses",
    icon: Library,
  },
  {
    label: "Timetable",
    to: "/timetable",
    icon: CalendarDays,
  },
  {
    label: "Study Planner",
    to: "/planner",
    icon: CalendarClock,
  },
  {
    label: "Tasks",
    to: "/tasks",
    icon: ClipboardList,
  },
  {
    label: "Assignments",
    to: "/assignments",
    icon: BookOpen,
  },
  {
    label: "Exams",
    to: "/exams",
    icon: GraduationCap,
  },
  {
    label: "Analytics",
    to: "/analytics",
    icon: BarChart2,
  },
=======
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Courses", to: "/courses", icon: Library },
  { label: "Timetable", to: "/timetable", icon: CalendarDays },
  { label: "Study Planner", to: "/planner", icon: CalendarClock },
  { label: "Tasks", to: "/tasks", icon: ClipboardList },
  { label: "Assignments", to: "/assignments", icon: BookOpen },
  { label: "Exams", to: "/exams", icon: GraduationCap },
  { label: "Analytics", to: "/analytics", icon: BarChart2 },
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
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
<<<<<<< HEAD
        <div
          className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          aria-label="Lebid"
          title="Lebid"
        >
=======
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" aria-label="Lebid" title="Lebid">
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
          <span className="text-sm font-bold">L</span>
        </div>
      </div>

      {/* Navigation */}
<<<<<<< HEAD
      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-hidden px-2 py-4"
      >
        <div className="space-y-2">
=======
      <nav aria-label="Main navigation" className="flex-1 overflow-hidden px-2 py-3">
        <div className="space-y-1">
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
<<<<<<< HEAD
                  "group flex h-11 w-full items-center justify-center rounded-xl",
                  "transition-all duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2",
                  "focus-visible:outline-sidebar-ring",

                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
=======
                  "group relative flex h-12 items-center justify-center rounded-xl transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
<<<<<<< HEAD
                      "size-5.5 shrink-0 transition-transform duration-200",
                      !isActive && "group-hover:scale-105"
                    )}
                    strokeWidth={isActive ? 2.4 : 2}
                  />

                  <span className="sr-only">
                    {item.label}
                  </span>
=======
                      "size-6 shrink-0 transition-transform duration-200",
                      !isActive && "group-hover:scale-105"
                    )}
                  />

                  <span className="sr-only">{item.label}</span>
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

<<<<<<< HEAD
      {/* Logout */}
=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
<<<<<<< HEAD
          className="flex h-9 w-full items-center justify-center rounded-xl text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
=======
          className="flex h-9 w-full items-center justify-center rounded-xl text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </aside>
  );
}