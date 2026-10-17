import StudyPlannerPage from "./StudyPlannerPage";
import MobileStudyPlannerPage from "./MobileStudyPlannerPage";
import { useIsMobile } from "@/hooks/useIsMobile";

// Chooses the phone planner or the desktop one for the /planner route.
export default function StudyPlannerEntry() {
  return useIsMobile() ? <MobileStudyPlannerPage /> : <StudyPlannerPage />;
}