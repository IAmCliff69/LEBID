import AssignmentsPage from "./AssignmentsPage";
import MobileAssignmentsPage from "./MobileAssignmentsPage";
import { useIsMobile } from "@/hooks/useIsMobile";

// Chooses the phone Assignments page or the desktop one for the /assignments route.
export default function AssignmentsEntry() {
  return useIsMobile() ? <MobileAssignmentsPage /> : <AssignmentsPage />;
}