import { useCallback, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import PublicOnlyRoute from "@/components/common/PublicOnlyRoute";
import AppLayout from "@/components/layout/AppLayout";
import SplashScreen from "@/components/splash/SplashScreen";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import type { User } from "@/api/auth";
import OnboardingSignOut from "@/components/onboarding/OnboardingSignOut";
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
import GeminiSetupPage from "@/pages/onboarding/GeminiSetupPage";
import AcademicInformationPage from "@/pages/onboarding/AcademicInformationPage";
import TimetableUploadPage from "@/pages/onboarding/TimetableUploadPage";
import TimetableProcessingPage from "@/pages/onboarding/TimetableProcessingPage";
import { OnboardingProvider } from "@/context/OnboardingContext";
import StudyPreferencesPage from "@/pages/onboarding/StudyPreferencesPage";
import PlanBuildingPage from "@/pages/onboarding/PlanBuildingPage";
import PlanReviewPage from "@/pages/onboarding/PlanReviewPage";
import StudyVenuesPage from "@/pages/onboarding/StudyVenuesPage";
import FinishSetupPage from "@/pages/onboarding/FinishSetupPage";

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

// The first onboarding step a student has not finished yet.
function getResumeStep(user: User): string {
  if (!user.has_gemini_api_key) return "/onboarding/gemini";

  const hasAcademicInfo = Boolean(
    user.university && user.programme && user.level && user.semester
  );
  if (!hasAcademicInfo) return "/onboarding/academic";

  return "/onboarding/timetable";
}
// Everything that depends on the session lives here, inside AuthProvider.
// The session check starts as soon as the app opens, while the splash plays.
function AppRoutes() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

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
      <OnboardingProvider>
        <Routes>
          <Route path="/login" element={<AuthLayout />} />
          <Route path="/register" element={<AuthLayout />} />
          <Route path="/account-setup" element={<AccountCreationPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <OnboardingSignOut />
      </OnboardingProvider>
    );
  }

    // A student who has not finished onboarding can only see the onboarding
  // pages. Anything else (like the Dashboard) sends them to the step they
  // still have to do.
  if (
    user &&
    user.onboarding_completed === false &&
    !location.pathname.startsWith("/onboarding/")
  ) {
    return <Navigate to={getResumeStep(user)} replace />;
  }

  return (
    <OnboardingProvider>
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

        {/* Onboarding (logged in, but no sidebar/top bar) */}
        <Route
          path="/account-setup"
          element={<Navigate to="/onboarding/gemini" replace />}
        />
        <Route path="/onboarding/gemini" element={<GeminiSetupPage />} />
        <Route path="/onboarding/academic" element={<AcademicInformationPage />} />
        <Route path="/onboarding/timetable" element={<TimetableUploadPage />} />
        <Route path="/onboarding/timetable-processing"element={<TimetableProcessingPage />} />
        <Route path="/onboarding/study-preferences" element={<StudyPreferencesPage />} />
        <Route path="/onboarding/plan-building" element={<PlanBuildingPage />} />
        <Route path="/onboarding/plan-review" element={<PlanReviewPage />} />
        <Route path="/onboarding/study-venues" element={<StudyVenuesPage />} />
        <Route path="/onboarding/finish" element={<FinishSetupPage />} />

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
    <OnboardingSignOut />
    </OnboardingProvider>
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