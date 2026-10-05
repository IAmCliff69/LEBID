import apiClient from "./client";
import type { AxiosProgressEvent } from "axios";

export interface ExtractedEntry {
  course_name: string;
  course_code: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
  lecturer: string | null;
  class_type: string;
}

export interface ExtractionResponse {
  import_id: string;
  status: string;
  extracted_entries: ExtractedEntry[];
  extraction_notes: string | null;
  message: string;
}

export interface ConfirmEntryRequest {
  course_id: string | null; // one of your existing courses, or null
  course_name: string | null; // used to find or create the course when course_id is null
  course_code: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
  lecturer: string | null;
  class_type: string;
  notes: string | null;
}

export interface ConfirmImportResponse {
  saved_count: number;
  message: string;
  courses_created: number;
  duplicates_skipped: number;
}

// An earlier upload that was read by the AI but not confirmed yet.
export interface PendingImport extends ExtractionResponse {
  original_filename: string;
  created_at: string;
}

export const uploadTimetable = async (
  file: File,
  onUploadProgress?: (event: AxiosProgressEvent) => void
): Promise<ExtractionResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post("/timetable-import/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return response.data;
};
export const confirmImport = async (
  importId: string,
  entries: ConfirmEntryRequest[]
): Promise<ConfirmImportResponse> => {
  const response = await apiClient.post(
    `/timetable-import/confirm/${importId}`,
    { entries }
  );
  return response.data;
};

// The student's most recent unconfirmed upload (or null), so they can
// continue reviewing it without uploading again.
export const getPendingImport = async (): Promise<PendingImport | null> => {
  const response = await apiClient.get("/timetable-import/pending");
  return response.data;
};

// Throws away an unconfirmed upload so it is not offered again.
export const discardImport = async (importId: string): Promise<void> => {
  await apiClient.post(`/timetable-import/discard/${importId}`);
};