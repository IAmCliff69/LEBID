import GettingStartedCard from "@/components/dashboard/GettingStartedCard";
import LectureMarksSummaryWidget from "@/components/dashboard/LectureMarksSummaryWidget";
import MissedSessionsWidget from "@/components/dashboard/MissedSessionsWidget";
import TodayClassesWidget from "@/components/dashboard/TodayClassesWidget";
import TodaySessionsWidget from "@/components/dashboard/TodaySessionsWidget";
import UpcomingActivityWidget from "@/components/dashboard/UpcomingActivityWidget";
import UpcomingDeadlinesWidget from "@/components/dashboard/UpcomingDeadlinesWidget";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import { useAuth } from "@/context/AuthContext";

// "dashboard-fit" (defined in index.css) switches on the one-screen layout on
// laptops and desktops that are big enough. In that mode the page itself never
// scrolls: the banner takes 2 cells of a 4 x 2 grid, every other card fills one
// cell, and long lists scroll inside their card. On phones, tablets and very
// small windows the cards stack and the page scrolls as normal.
const CARD_FILL = "dashboard-fit:h-auto dashboard-fit:min-h-0";

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] ?? "Student";

  return (
    // 8.25rem = the top bar (4rem) + the page padding (2 x 2rem) + a little spare
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 dashboard-fit:h-[calc(100dvh-8.25rem)]">
      {/* Shown only to brand-new accounts */}
      <GettingStartedCard />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 dashboard-fit:min-h-0 dashboard-fit:flex-1 dashboard-fit:grid-cols-4 dashboard-fit:grid-rows-2">
        {/* Welcome */}
        <WelcomeBanner
          firstName={firstName}
          className="col-span-full dashboard-fit:col-span-2"
        />

        <TodayClassesWidget className={`h-80 ${CARD_FILL}`} />
        <UpcomingActivityWidget className={`h-72 ${CARD_FILL}`} />
        <UpcomingDeadlinesWidget className={`h-80 ${CARD_FILL}`} />
        <TodaySessionsWidget className={`h-80 ${CARD_FILL}`} />
        <MissedSessionsWidget className={`h-80 ${CARD_FILL}`} />

        {/* The two lecture summaries share one cell */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2 lg:col-span-1 lg:grid-cols-1 dashboard-fit:col-span-1 dashboard-fit:min-h-0 dashboard-fit:grid-rows-2">
          <LectureMarksSummaryWidget status="missed" className={CARD_FILL} />
          <LectureMarksSummaryWidget status="cancelled" className={CARD_FILL} />
        </div>
      </div>
    </div>
  );
}