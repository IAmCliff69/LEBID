import TasksPage from "./TasksPage";
import MobileTasksPage from "./MobileTasksPage";
import { useIsMobile } from "@/hooks/useIsMobile";

// Chooses the phone Tasks page or the desktop one for the /tasks route.
export default function TasksEntry() {
  return useIsMobile() ? <MobileTasksPage /> : <TasksPage />;
}