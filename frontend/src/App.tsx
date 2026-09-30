import { Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
<<<<<<< HEAD
import ProfilePage from "@/pages/profile/ProfilePage";
=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e

import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";

<<<<<<< HEAD
import AuthPage from "@/pages/auth/AuthPage";
=======
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
import DashboardPage from "@/pages/dashboard/DashboardPage";
import TimetablePage from "@/pages/timetable/TimetablePage";
import StudyPlannerPage from "@/pages/planner/StudyPlannerPage";
import TasksPage from "@/pages/tasks/TasksPage";
import AssignmentsPage from "@/pages/assignments/AssignmentsPage";
import ExamsPage from "@/pages/exams/ExamsPage";
import AnalyticsPage from "@/pages/analytics/AnalyticsPage";
import CoursesPage from "@/pages/courses/CoursesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function ProtectedLayout({
  children,
  title,
<<<<<<< HEAD
  showTopBar = true,
=======
  showTopBar = false,
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
}: {
  children: ReactNode;
  title: string;
  showTopBar?: boolean;
}) {
  return (
    <ProtectedRoute>
      <AppLayout title={title} showTopBar={showTopBar}>
        {children}
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
<<<<<<< HEAD
          <Route path="/login" element={<AuthPage initialMode="login" />} />
          <Route path="/register" element={<AuthPage initialMode="register" />} />
=======
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedLayout title="Dashboard" showTopBar>
                <DashboardPage />
              </ProtectedLayout>
            }
          />

          <Route
            path="/courses"
            element={
              <ProtectedLayout title="Courses">
                <CoursesPage />
              </ProtectedLayout>
            }
          />

          <Route
<<<<<<< HEAD
            path="/profile"
            element={
              <ProtectedLayout title="Profile">
                <ProfilePage />
              </ProtectedLayout>
            }
          />

          <Route
=======
>>>>>>> b74a0f9e4fa401d536ad40e316075040a1c5632e
            path="/timetable"
            element={
              <ProtectedLayout title="Timetable">
                <TimetablePage />
              </ProtectedLayout>
            }
          />

          <Route
            path="/planner"
            element={
              <ProtectedLayout title="Study Planner">
                <StudyPlannerPage />
              </ProtectedLayout>
            }
          />

          <Route
            path="/tasks"
            element={
              <ProtectedLayout title="Tasks">
                <TasksPage />
              </ProtectedLayout>
            }
          />

          <Route
            path="/assignments"
            element={
              <ProtectedLayout title="Assignments">
                <AssignmentsPage />
              </ProtectedLayout>
            }
          />

          <Route
            path="/exams"
            element={
              <ProtectedLayout title="Exams">
                <ExamsPage />
              </ProtectedLayout>
            }
          />

          <Route
            path="/analytics"
            element={
              <ProtectedLayout title="Analytics">
                <AnalyticsPage />
              </ProtectedLayout>
            }
          />

          {/* Default routes */}
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />

          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}