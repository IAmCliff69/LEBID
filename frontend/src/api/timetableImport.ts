import apiClient from "./client";

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
  course_id: string;
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
}

export const uploadTimetable = async (
  file: File
): Promise<ExtractionResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post("/timetable-import/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
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