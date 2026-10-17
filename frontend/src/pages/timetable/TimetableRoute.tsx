import TimetablePage from "./TimetablePage";
import MobileTimetablePage from "./MobileTimetablePage";
import { useIsMobile } from "@/hooks/useIsMobile";

// Chooses the phone Timetable or the desktop one for the /timetable route.
export default function TimetableRoute() {
  return useIsMobile() ? <MobileTimetablePage /> : <TimetablePage />;
}