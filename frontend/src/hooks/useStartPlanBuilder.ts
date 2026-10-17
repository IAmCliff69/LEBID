import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getTimetable } from "@/api/timetable";
import { useOnboarding } from "@/context/OnboardingContext";

// Returns a function that starts the "Build my study plan with AI" flow
// for a student who is already using Lebid. It plans around the timetable
// saved in Lebid (no upload needed).
export function useStartPlanBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setTimetableFile, setExtraction, setStudyPlan, setPlanFromSaved } =
    useOnboarding();

  return async () => {
    try {
      // The plan needs classes to plan around
      const classes = await queryClient.fetchQuery({
        queryKey: ["timetable"],
        queryFn: getTimetable,
      });
      if (classes.length === 0) {
        toast.info("Add your timetable first", {
          description: "Lebid plans your study sessions around your classes.",
        });
        navigate("/timetable-import");
        return;
      }
    } catch {
      toast.error("We couldn't check your timetable. Please try again.");
      return;
    }

    // Start from a clean slate
    setTimetableFile(null);
    setExtraction(null);
    setStudyPlan(null);
    setPlanFromSaved(true);
    navigate("/onboarding/study-preferences");
  };
}