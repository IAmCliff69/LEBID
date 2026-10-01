import type { ReactNode } from "react";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import FloatingAiButton from "@/components/ai/FloatingAiButton";  // ← add

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
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main application area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {showTopBar && <TopBar title={title} />}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-5 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Floating AI assistant — available on every protected page */}
      <FloatingAiButton />
    </div>
  );
}