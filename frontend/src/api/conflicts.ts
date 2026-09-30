import apiClient from "./client";

export interface ConflictItem {
  conflict_type:
    | "timetable_entry"
    | "study_session"
    | "event"
    | "exam";
  description: string;
  conflicting_item: Record<string, unknown>;
}

export interface ConflictCheckResponse {
  has_conflicts: boolean;
  conflict_count: number;
  conflicts: ConflictItem[];
  message: string;
}

/** Check a specific date + time range for conflicts. */
export const checkConflicts = async (params: {
  check_date: string;       // YYYY-MM-DD
  start_time: string;       // HH:MM
  end_time: string;         // HH:MM
  exclude_session_id?: string;
  exclude_event_id?: string;
}): Promise<ConflictCheckResponse> => {
  const response = await apiClient.post("/conflicts/check", params);
  return response.data;
};

/** Scan an entire day for any overlapping items. */
export const checkDayConflicts = async (
  check_date: string        // YYYY-MM-DD
): Promise<ConflictCheckResponse> => {
  const response = await apiClient.get("/conflicts/day", {
    params: { check_date },
  });
  return response.data;
};