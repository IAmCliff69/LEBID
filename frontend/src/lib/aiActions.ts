import {
  createStudySession,
  deleteStudySession,
  updateStudySession,
} from "@/api/studySessions";
import type {
  CreateStudySessionData,
  UpdateStudySessionData,
} from "@/api/studySessions";
import type { AiAction, AiActionEntity } from "@/api/ai";
import { createTask, deleteTask, updateTask } from "@/api/tasks";
import type { CreateTaskData } from "@/api/tasks";
import {
  createAssignment,
  deleteAssignment,
  updateAssignment,
} from "@/api/assignments";
import type { CreateAssignmentData } from "@/api/assignments";
import { createExam, deleteExam, updateExam } from "@/api/exams";
import type { CreateExamData } from "@/api/exams";
import { createEvent, deleteEvent, updateEvent } from "@/api/events";
import type { CreateEventData } from "@/api/events";

// What happened to a card. It is saved with the conversation.
export interface ActionState {
  status: "applied" | "dismissed" | "undone";
  createdId?: string; // the new item's id after a "create" (needed for Undo)
}

// Each kind of item knows how to apply a change and how to undo it.
export interface ActionHandler {
  // Makes the change. Returns the id of a newly created item, if any.
  apply: (action: AiAction) => Promise<string | undefined>;
  // Reverses the change.
  undo: (action: AiAction, createdId?: string) => Promise<void>;
  // Which cached lists to refresh afterwards
  queryKeys: string[];
}

const studySessionHandler: ActionHandler = {
  queryKeys: ["study-sessions"],

  async apply(action) {
    if (action.action === "create") {
      const created = await createStudySession(
        action.payload as unknown as CreateStudySessionData
      );
      return created.id;
    }
    if (!action.id) throw new Error("Missing id");
    if (action.action === "update") {
      await updateStudySession(
        action.id,
        action.payload as UpdateStudySessionData
      );
      return undefined;
    }
    await deleteStudySession(action.id);
    return undefined;
  },

  async undo(action, createdId) {
    if (action.action === "create") {
      if (createdId) await deleteStudySession(createdId);
      return;
    }
    if (action.action === "update") {
      if (action.id && action.previous) {
        await updateStudySession(
          action.id,
          action.previous as UpdateStudySessionData
        );
      }
      return;
    }
    // A delete is undone by creating the session again
    if (action.previous) {
      await createStudySession(
        action.previous as unknown as CreateStudySessionData
      );
    }
  },
};

// Tasks and assignments work the same way, so one helper builds both handlers.
interface CrudFunctions {
  create: (data: Record<string, unknown>) => Promise<{ id: string }>;
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  queryKeys: string[];
}

function makeCrudHandler(fns: CrudFunctions): ActionHandler {
  return {
    queryKeys: fns.queryKeys,

    async apply(action) {
      if (action.action === "create") {
        const created = await fns.create(action.payload);
        return created.id;
      }
      if (!action.id) throw new Error("Missing id");
      if (action.action === "update") {
        await fns.update(action.id, action.payload);
        return undefined;
      }
      await fns.remove(action.id);
      return undefined;
    },

    async undo(action, createdId) {
      if (action.action === "create") {
        if (createdId) await fns.remove(createdId);
        return;
      }
      if (action.action === "update") {
        if (action.id && action.previous) {
          await fns.update(action.id, action.previous);
        }
        return;
      }
      // A delete is undone by creating the item again
      if (action.previous) await fns.create(action.previous);
    },
  };
}

const taskHandler = makeCrudHandler({
  queryKeys: ["tasks"],
  create: (data) => createTask(data as unknown as CreateTaskData),
  update: (id, data) =>
    updateTask(id, data as unknown as Parameters<typeof updateTask>[1]),
  remove: (id) => deleteTask(id),
});

const assignmentHandler = makeCrudHandler({
  queryKeys: ["assignments"],
  create: (data) =>
    createAssignment(data as unknown as CreateAssignmentData),
  update: (id, data) =>
    updateAssignment(
      id,
      data as unknown as Parameters<typeof updateAssignment>[1]
    ),
  remove: (id) => deleteAssignment(id),
});

const examHandler = makeCrudHandler({
  queryKeys: ["exams"],
  create: (data) => createExam(data as unknown as CreateExamData),
  update: (id, data) =>
    updateExam(id, data as unknown as Parameters<typeof updateExam>[1]),
  remove: (id) => deleteExam(id),
});

const eventHandler = makeCrudHandler({
  queryKeys: ["events"],
  create: (data) => createEvent(data as unknown as CreateEventData),
  update: (id, data) =>
    updateEvent(id, data as unknown as Parameters<typeof updateEvent>[1]),
  remove: (id) => deleteEvent(id),
});

// Every kind of item the AI can change. Courses and timetable classes are
// deliberately not included.
export const ACTION_HANDLERS: Partial<Record<AiActionEntity, ActionHandler>> = {
  study_session: studySessionHandler,
  task: taskHandler,
  assignment: assignmentHandler,
  exam: examHandler,
  event: eventHandler,
};

export const ENTITY_NAMES: Record<AiActionEntity, string> = {
  study_session: "study session",
  task: "task",
  assignment: "assignment",
  exam: "exam",
  event: "event",
};

// True when we kept enough information to reverse the change
export function canUndo(action: AiAction): boolean {
  if (action.action === "update") return !!action.id && !!action.previous;
  if (action.action === "delete") return !!action.previous;
  return true;
}

// ─── Showing what will change ────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  topic: "Topic",
  description: "Description",
  session_date: "Date",
  exam_date: "Date",
  event_date: "Date",
  start_time: "Start",
  end_time: "End",
  deadline: "Deadline",
  venue: "Venue",
  location: "Location",
  priority: "Priority",
  status: "Status",
  category: "Category",
  exam_type: "Exam type",
  flexibility: "Flexibility",
  estimated_duration_minutes: "Estimated minutes",
  estimated_hours: "Estimated hours",
  notes: "Notes",
};

// Values like "not_started" read better as "not started"
const WORD_FIELDS = new Set([
  "status",
  "priority",
  "category",
  "exam_type",
  "flexibility",
]);

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "string") {
    if (key.endsWith("_time") && /^\d{2}:\d{2}/.test(value)) {
      return value.slice(0, 5);
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return value.replace("T", " ").slice(0, 16);
    }
    return WORD_FIELDS.has(key) ? value.replace(/_/g, " ") : value;
  }
  return String(value);
}

// One short line per field the action sets or changes
export function describeChanges(action: AiAction): string[] {
  if (action.action === "delete") return [];

  const lines: string[] = [];
  for (const [key, value] of Object.entries(action.payload)) {
    const label = FIELD_LABELS[key];
    if (!label) continue; // for example course_id: shown by the card title
    if (action.action === "update" && action.previous && key in action.previous) {
      lines.push(
        `${label}: ${formatValue(key, action.previous[key])} → ${formatValue(key, value)}`
      );
    } else {
      lines.push(`${label}: ${formatValue(key, value)}`);
    }
  }
  return lines;
}

// Turns a failed request into a sentence the student can understand
export function getActionError(err: unknown): string {
  const error = err as { response?: { data?: { detail?: unknown } } };
  if (!error.response) {
    return "We couldn't reach Lebid. Please check your connection and try again.";
  }
  const detail = error.response.data?.detail;
  if (typeof detail === "string" && detail.trim() !== "") return detail;
  return "That change couldn't be applied. Please try again.";
}