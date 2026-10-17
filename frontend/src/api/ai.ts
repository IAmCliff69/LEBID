import apiClient from "./client";

export interface ConversationMessage {
  role: "user" | "model";
  content: string;
}

export interface AiRecommendation {
  type:
    | "add_study_session"
    | "reschedule_session"
    | "adjust_workload"
    | "general_advice";
  title: string;
  description: string;
  data: Record<string, unknown>;
}

export type AiActionKind = "create" | "update" | "delete";
export type AiActionEntity =
  | "study_session"
  | "task"
  | "assignment"
  | "exam"
  | "event";

// A change the AI proposes. Nothing happens until the student presses Apply.
export interface AiAction {
  key: string;
  action: AiActionKind;
  entity: AiActionEntity;
  id: string | null;
  title: string;
  description: string;
  target: string | null; // the real item, read from the database
  payload: Record<string, unknown>;
  previous: Record<string, unknown> | null; // what Undo needs
}
export interface AiChatResponse {
  message: string;
  recommendations: AiRecommendation[];
  insights: string[];
  actions: AiAction[];
  action_warnings: string[];
}

export const sendAiMessage = async (
  message: string,
  conversationHistory: ConversationMessage[] = [],
  signal?: AbortSignal
): Promise<AiChatResponse> => {
  const response = await apiClient.post(
    "/ai/chat",
    {
      message,
      conversation_history: conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    { signal }
  );
  return response.data;
};