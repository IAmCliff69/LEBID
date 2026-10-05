import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import type { ExtractionResponse } from "@/api/timetableImport";
import type { GeneratedStudyPlan } from "@/api/studyPlan";

export type StudyTime = "morning" | "afternoon" | "evening";
export type BreakPreference = "short" | "long";

export interface StudyPreferences {
  studyTimes: StudyTime[]; // one or more of morning, afternoon, evening
  studyDays: number[]; // 0 = Monday ... 6 = Sunday (same numbers as the timetable)
  sessionLength: number; // the LONGEST a single session may be, in minutes
  breakPreference: BreakPreference;
}

// Holds information collected during onboarding while the student moves
// between onboarding pages. It lives only in memory (nothing is saved in
// the browser), and it is cleared automatically when the student logs out.
interface OnboardingContextType {
  timetableFile: File | null;
  setTimetableFile: (file: File | null) => void;
  extraction: ExtractionResponse | null;
  setExtraction: (extraction: ExtractionResponse | null) => void;
  studyPreferences: StudyPreferences | null;
  setStudyPreferences: (preferences: StudyPreferences | null) => void;
  studyPlan: GeneratedStudyPlan | null;
  setStudyPlan: (plan: GeneratedStudyPlan | null) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [timetableFile, setTimetableFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(
    null
  );
  const [studyPreferences, setStudyPreferences] =
    useState<StudyPreferences | null>(null);
  const [studyPlan, setStudyPlan] = useState<GeneratedStudyPlan | null>(null);

  return (
    <OnboardingContext.Provider
      value={{
        timetableFile,
        setTimetableFile,
        extraction,
        setExtraction,
        studyPreferences,
        setStudyPreferences,
        studyPlan,
        setStudyPlan,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}

