import apiClient from "./client";

export const NOTIFICATIONS_UPDATED_EVENT = "lebid:notifications-updated";

export interface AppNotification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  linked_item_type: string | null;
  linked_item_id: string | null;
  created_at: string;
}

export interface GenerateNotificationsResponse {
  created_count: number;
  message: string;
}

export const generateNotifications =
  async (): Promise<GenerateNotificationsResponse> => {
    const response = await apiClient.post("/notifications/generate");
    return response.data;
  };

export const getNotifications = async (params?: {
  unread_only?: boolean;
  limit?: number;
}): Promise<AppNotification[]> => {
  const response = await apiClient.get("/notifications", { params });
  return response.data;
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await apiClient.get("/notifications/unread-count");
  return response.data.unread_count;
};

export const markAsRead = async (id: string): Promise<AppNotification> => {
  const response = await apiClient.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllAsRead = async (): Promise<void> => {
  await apiClient.post("/notifications/read-all");
};

export const deleteNotification = async (id: string): Promise<void> => {
  await apiClient.delete(`/notifications/${id}`);
};

export const clearAllNotifications = async (): Promise<void> => {
  await apiClient.delete("/notifications");
};

export interface NotificationPreferences {
  deadline_reminders: boolean;
  exam_reminders: boolean;
  missed_session_alerts: boolean;
}

export const getNotificationPreferences =
  async (): Promise<NotificationPreferences> => {
    const response = await apiClient.get("/notifications/preferences");
    return response.data;
  };

export const saveNotificationPreferences = async (
  data: NotificationPreferences
): Promise<NotificationPreferences> => {
  const response = await apiClient.put("/notifications/preferences", data);
  return response.data;
};