import { useCallback, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import PublicOnlyRoute from "@/components/common/PublicOnlyRoute";
import AppLayout from "@/components/layout/AppLayout";
import SplashScreen from "@/components/splash/SplashScreen";
import NotificationsPage from "@/pages/notifications/NotificationsPage";

import AuthPage from "@/pages/auth/AuthPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import TimetablePage from "@/pages/timetable/TimetablePage";
import StudyPlannerPage from "@/pages/planner/StudyPlannerPage";
import TasksPage from "@/pages/tasks/TasksPage";
import AssignmentsPage from "@/pages/assignments/AssignmentsPage";
import ExamsPage from "@/pages/exams/ExamsPage";
import EventsPage from "@/pages/events/EventsPage";
import AnalyticsPage from "@/pages/analytics/AnalyticsPage";
import CoursesPage from "@/pages/courses/CoursesPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import AiAssistantPage from "@/pages/ai/AiAssistantPage";
import TimetableImportPage from "@/pages/timetable/TimetableImportPage";
import ConflictCheckerPage from "@/pages/conflicts/ConflictCheckerPage";
import AccountCreationPage from "@/pages/auth/AccountCreationPage";

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
  showTopBar = true,
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

function AuthLayout() {
  return <AuthPage initialMode="login" />;
}

// Everything that depends on the session lives here, inside AuthProvider.
// The session check starts as soon as the app opens, while the splash plays.
function AppRoutes() {
  const { isLoading, isAuthenticated } = useAuth();

  // The splash shows once every time the app is opened (page load/refresh).
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // 1. Splash always plays first (~3 seconds).
  if (!splashDone) {
    return <SplashScreen onComplete={finishSplash} />;
  }

  // 2. If the session check is somehow still running, wait on a blank
  //    background rather than flashing the wrong page.
  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  // 3. Session known: send the user to the right place immediately
  //    so we do not bounce through a protected route just to redirect.
    if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<AuthLayout />} />
        <Route path="/register" element={<AuthLayout />} />
        <Route path="/account-setup" element={<AccountCreationPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public routes — logged-in users are sent to the Dashboard */}
      <Route
        element={
          <PublicOnlyRoute>
            <AuthLayout />
          </PublicOnlyRoute>
        }
      >
        <Route path="/login" element={<></>} />
        <Route path="/register" element={<></>} />
      </Route>

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

      {/* Profile */}
      <Route
        path="/profile"
        element={
          <ProtectedLayout title="Profile">
            <ProfilePage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/timetable-import"
        element={
          <ProtectedLayout title="Import Timetable">
            <TimetableImportPage />
          </ProtectedLayout>
        }
      />

      <Route
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
        path="/conflicts"
        element={
          <ProtectedLayout title="Conflict Checker">
            <ConflictCheckerPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/ai"
        element={
          <ProtectedLayout title="AI Assistant">
            <AiAssistantPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedLayout title="Notifications" showTopBar>
            <NotificationsPage />
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
        path="/events"
        element={
          <ProtectedLayout title="Events">
            <EventsPage />
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

      {/* Default routes for authenticated users */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  );
}