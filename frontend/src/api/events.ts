import apiClient from "./client";

export type EventFlexibility =
  | "fixed"
  | "flexible"
  | "protected";

export interface PlannerEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  flexibility: EventFlexibility;
  is_recurring: boolean;
  notes: string | null;
}

export interface CreateEventData {
  title: string;
  description?: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  flexibility?: EventFlexibility;
  is_recurring?: boolean;
  notes?: string | null;
}

export interface UpdateEventData {
  title?: string;
  description?: string | null;
  event_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  flexibility?: EventFlexibility;
  is_recurring?: boolean;
  notes?: string | null;
}

export interface DeleteEventResponse {
  message: string;
}

/**
 * Get all personal events.
 *
 * Optional filters:
 * - flexibility
 * - upcoming_only
 */
export const getEvents = async (params?: {
  flexibility?: EventFlexibility;
  upcoming_only?: boolean;
}): Promise<PlannerEvent[]> => {
  const response = await apiClient.get("/events", {
    params,
  });

  return response.data;
};

/**
 * Get upcoming events.
 *
 * days can be between 1 and 90.
 */
export const getUpcomingEvents = async (
  days: number = 7
): Promise<PlannerEvent[]> => {
  const response = await apiClient.get("/events/upcoming", {
    params: { days },
  });

  return response.data;
};

/**
 * Get one event.
 */
export const getEvent = async (
  id: string
): Promise<PlannerEvent> => {
  const response = await apiClient.get(`/events/${id}`);

  return response.data;
};

/**
 * Create a personal event.
 */
export const createEvent = async (
  data: CreateEventData
): Promise<PlannerEvent> => {
  const response = await apiClient.post("/events", data);

  return response.data;
};

/**
 * Update a personal event.
 */
export const updateEvent = async (
  id: string,
  data: UpdateEventData
): Promise<PlannerEvent> => {
  const response = await apiClient.patch(
    `/events/${id}`,
    data
  );

  return response.data;
};

/**
 * Delete a personal event.
 */
export const deleteEvent = async (
  id: string
): Promise<DeleteEventResponse> => {
  const response = await apiClient.delete(`/events/${id}`);

  return response.data;
};