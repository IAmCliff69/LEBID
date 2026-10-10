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

export interface AiChatResponse {
  message: string;
  recommendations: AiRecommendation[];
  insights: string[];
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