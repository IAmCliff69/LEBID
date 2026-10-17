import type { ReactNode } from "react";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import ThemeToggle from "./ThemeToggle";
import MobileTopBar from "./MobileTopBar";
import MobileBottomBar from "./MobileBottomBar";
import EmailVerificationBanner from "./EmailVerificationBanner";
import FloatingAiButton from "@/components/ai/FloatingAiButton";
import LoginReminders from "@/components/reminders/LoginReminders";
import { useIsMobile } from "@/hooks/useIsMobile";

interface AppLayoutProps {
  title: string;
  showTopBar?: boolean;
  children: ReactNode;
}

export default function AppLayout({
  title,
  showTopBar = false,
  children,
}: AppLayoutProps) {
  const isMobile = useIsMobile();

  // ── Phone layout: top bar, page, floating bottom bar ──────────────────────
  if (isMobile) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <MobileTopBar />
        <EmailVerificationBanner />

        {/* The whole page scrolls. The padding keeps the last item clear of the bottom bar. */}
        <main className="flex-1 px-4 pt-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>

        <MobileBottomBar />
        <FloatingAiButton />
        <LoginReminders />
      </div>
    );
  }

  // ── Desktop layout (unchanged) ─────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main application area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {showTopBar && <TopBar title={title} />}
        <EmailVerificationBanner />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-5 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Floating AI assistant — available on every protected page */}
      <FloatingAiButton />
      <ThemeToggle />
      <LoginReminders />
    </div>
  );
}