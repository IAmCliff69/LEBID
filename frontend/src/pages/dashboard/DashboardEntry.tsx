import DashboardPage from "./DashboardPage";
import MobileDashboardPage from "./MobileDashboardPage";
import { useIsMobile } from "@/hooks/useIsMobile";

// Chooses the phone dashboard or the desktop one for the /dashboard route.
export default function DashboardEntry() {
  return useIsMobile() ? <MobileDashboardPage /> : <DashboardPage />;
}