import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Sparkles,
  Lightbulb,
  BookOpen,
  SquarePen,
  Trash2,
  MessageSquare,
  Square,
  Pencil,
  RotateCcw,
  X,
  Mic,
} from "lucide-react";
import { marked } from "marked";
import { sendAiMessage } from "@/api/ai";
import type { ConversationMessage, AiRecommendation } from "@/api/ai";
import { createStudySession } from "@/api/studySessions";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import type { SpeechError } from "@/hooks/useSpeechToText";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  recommendations?: AiRecommendation[];
  insights?: string[];
  error?: boolean;
}

interface SavedConversation {
  id: string;
  title: string;        // first user message, truncated
  createdAt: number;    // timestamp ms
  updatedAt: number;
  messages: ChatEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// The OLD key was shared by every account in the same browser (the privacy leak).
const LEGACY_STORAGE_KEY = "lebid_ai_conversations";

// Each user now gets their own key, built from their user id.
const getStorageKey = (userId: string) => `lebid_ai_conversations_${userId}`;
const MAX_STORED = 30;

const SUGGESTIONS = [
  "What do I have on today?",
  "I missed my study session yesterday. What should I do?",
  "I have an exam coming up. How should I prepare?",
  "Help me plan my assignments for this week.",
  "I have too much to do. Can you help me reorganise?",
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadConversations(storageKey: string): SavedConversation[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SavedConversation[]) : [];
  } catch {
    return [];
  }
}

function saveConversations(
  storageKey: string,
  convos: SavedConversation[]
): void {
  try {
    // Keep only the most recent MAX_STORED conversations
    const trimmed = convos.slice(0, MAX_STORED);
    localStorage.setItem(storageKey, JSON.stringify(trimmed));
  } catch {
    // localStorage full — silently ignore
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeTitle(messages: ChatEntry[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  return first.content.length > 48
    ? first.content.slice(0, 48) + "…"
    : first.content;
}

function getCurrentTime(): number {
  return Date.now();
}

function updateConversation(
  conversations: SavedConversation[],
  id: string,
  messages: ChatEntry[],
  updatedAt: number
): SavedConversation[] {
  return conversations
    .map((conversation) =>
      conversation.id === id
        ? { ...conversation, title: makeTitle(messages), updatedAt, messages }
        : conversation
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MarkdownMessage({ content }: { content: string }) {
  const html = marked(content, {
    breaks: true,   // treat single newlines as <br>
    gfm: true,      // GitHub-flavoured markdown (bold, lists etc.)
  }) as string;

  return (
    <div
      className="prose prose-sm max-w-none text-foreground
        prose-p:my-1 prose-p:leading-relaxed
        prose-ul:my-1 prose-ul:pl-4
        prose-ol:my-1 prose-ol:pl-4
        prose-li:my-0.5
        prose-strong:font-semibold prose-strong:text-foreground
        prose-em:italic
        prose-headings:font-semibold prose-headings:text-foreground
        prose-headings:mt-2 prose-headings:mb-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── RecommendationCard ───────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: AiRecommendation }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAddSession = rec.type === "add_study_session";

  const handleAccept = async () => {
    if (!isAddSession || state !== "idle") return;
    setState("loading");
    try {
      const d = rec.data as Record<string, string>;
      await createStudySession({
        course_id: String(d.course_id),
        session_date: d.suggested_date,
        start_time: d.suggested_start_time,
        end_time: d.suggested_end_time,
        venue: d.venue || "TBD",
        topic: d.topic || null,
      });
      setState("done");
    } catch {
      setState("error");
      setErrorMsg("Failed to create session.");
    }
  };

  const bgColor =
    rec.type === "add_study_session"
      ? "bg-background border-secondary"
      : rec.type === "reschedule_session"
        ? "bg-warning/10 border-warning/20"
        : "bg-muted border-border";

  const iconColor =
    rec.type === "add_study_session"
      ? "text-primary"
      : rec.type === "reschedule_session"
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${bgColor}`}>
      <div className="flex items-start gap-2">
        <BookOpen className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{rec.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-secondary-foreground">
            {rec.description}
          </p>
          {state === "done" && (
            <p className="mt-2 text-xs font-semibold text-success">
              ✓ Study session added to your planner.
            </p>
          )}
          {state === "error" && (
            <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
          )}
          {isAddSession && state === "idle" && (
            <button
              type="button"
              onClick={handleAccept}
              className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover"
            >
              Add to planner
            </button>
          )}
          {state === "loading" && (
            <p className="mt-2 text-xs text-muted-foreground">Adding...</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
// Turns a failed request into a sentence a student can understand.
function getFriendlyAiError(err: unknown): string {
  const error = err as { response?: { data?: { detail?: unknown } } };

  // No reply at all: the request never reached the server
  if (!error.response) {
    return "We couldn't reach Lebid. Please check your internet connection and try again.";
  }

  const detail = error.response.data?.detail;
  if (
    typeof detail === "string" &&
    detail.trim() !== "" &&
    !detail.startsWith("AI service error")
  ) {
    return detail;
  }
  return "The AI assistant couldn't answer just now. Please try again in a moment.";
}

const SPEECH_ERROR_MESSAGES: Record<SpeechError, [string, string]> = {
  blocked: [
    "Microphone access is blocked",
    "Allow the microphone for this site in your browser settings, then try again.",
  ],
  "no-microphone": [
    "No microphone found",
    "Plug in or enable a microphone and try again.",
  ],
  "no-speech": ["We didn't hear anything", "Tap the mic and try again."],
  network: [
    "Voice input needs an internet connection",
    "Check your connection and try again.",
  ],
  other: ["Voice input stopped", "Please try again, or type your message."],
};

export default function AiAssistantPage() {
  // All saved conversations, newest first
    const { user } = useAuth();
  const storageKey = getStorageKey(user?.id ?? "unknown");

  // All saved conversations for THIS user only, newest first
  const [conversations, setConversations] = useState<SavedConversation[]>(
    () => loadConversations(storageKey)
  );

  // The active conversation ID (null = brand-new, unsaved)
  const [activeId, setActiveId] = useState<string | null>(null);

  // Messages in the current chat
  const [chat, setChat] = useState<ChatEntry[]>([]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
    // Lets the Stop button cancel the request that is waiting for an answer
  const abortRef = useRef<AbortController | null>(null);
  // Which of the student's messages is being edited (an index in `chat`)
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Which message has its long-press menu open (touch screens)
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const pressTimerRef = useRef<number | null>(null);
    // Voice input
  const voiceBaseRef = useRef(""); // what was in the box when dictation started
  const voiceActiveRef = useRef(false); // false once the message is sent

  const resizeTextarea = () => {
    const box = textareaRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 140)}px`;
  };

  const speech = useSpeechToText({
    onText: (spoken) => {
      // Ignore words that arrive after the message was already sent
      if (!voiceActiveRef.current) return;
      const base = voiceBaseRef.current.trimEnd();
      const next = base ? `${base} ${spoken.trimStart()}` : spoken.trimStart();
      setInput(next);
      requestAnimationFrame(resizeTextarea);
    },
    onError: (error) => {
      const [title, description] = SPEECH_ERROR_MESSAGES[error];
      toast.error(title, { description });
    },
  });

  const toggleVoice = () => {
    if (speech.isListening) {
      speech.stop();
      return;
    }
    voiceBaseRef.current = input;
    voiceActiveRef.current = true;
    speech.start();
  };
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, isLoading]);

  // Persist conversations to localStorage when their state changes.
    useEffect(() => {
    saveConversations(storageKey, conversations);
  }, [storageKey, conversations]);

  // One-time cleanup: delete the old shared history that every account could see.
  useEffect(() => {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, []);

  // ── Conversation management ────────────────────────────────────────────────

  const startNew = useCallback(() => {
    setActiveId(null);
    setChat([]);
    setInput("");
    setEditingIndex(null);
    setMenuIndex(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [setMenuIndex]);

  const loadConversation = useCallback((convo: SavedConversation) => {
    setActiveId(convo.id);
    setChat(convo.messages);
    setInput("");
    setEditingIndex(null);
    setMenuIndex(null);
  }, [setMenuIndex]);

  const deleteConversation = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConversations((prev) => {
        return prev.filter((conversation) => conversation.id !== id);
      });
      if (activeId === id) startNew();
    },
    [activeId, startNew]
  );

  // ── Chat logic ─────────────────────────────────────────────────────────────

    const buildHistory = (messages: ChatEntry[]): ConversationMessage[] =>
    messages
      .filter((e) => !e.error)
      .map((e) => ({
        role: e.role === "user" ? "user" : "model",
        content: e.content,
      }));

  // replaceFrom: when editing or re-asking, the index of the message being
  // replaced. That message and everything after it is dropped first.
  const send = async (message: string, replaceFrom: number | null = null) => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;
        // Sending ends any voice input in progress
    voiceActiveRef.current = false;
    speech.stop();

    const baseMessages =
      replaceFrom === null ? chat : chat.slice(0, replaceFrom);
    const userEntry: ChatEntry = { role: "user", content: trimmed };
    const nextMessages = [...baseMessages, userEntry];

    // Create a new conversation ID on the very first message
    const currentId = activeId ?? generateId();
    const now = getCurrentTime();
    if (!activeId) {
      const newConvo: SavedConversation = {
        id: currentId,
        title: trimmed.length > 48 ? trimmed.slice(0, 48) + "…" : trimmed,
        createdAt: now,
        updatedAt: now,
        messages: nextMessages,
      };
      setActiveId(currentId);
      setConversations((prev) => [newConvo, ...prev]);
    } else {
      setConversations((prev) =>
        updateConversation(prev, currentId, nextMessages, now)
      );
    }

    setChat(nextMessages);
    setInput("");
    requestAnimationFrame(resizeTextarea);
    setEditingIndex(null);
    setMenuIndex(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await sendAiMessage(
        trimmed,
        buildHistory(baseMessages),
        controller.signal
      );
      const assistantEntry: ChatEntry = {
        role: "assistant",
        content: result.message,
        recommendations: result.recommendations,
        insights: result.insights,
      };
      const updatedMessages = [...nextMessages, assistantEntry];
      const updatedAt = getCurrentTime();
      setChat(updatedMessages);
      setConversations((prev) =>
        updateConversation(prev, currentId, updatedMessages, updatedAt)
      );
    } catch (err: unknown) {
      // The student pressed Stop: take the question back out of the chat and
      // put it in the text box so it can be changed and sent again.
      if (controller.signal.aborted) {
        setInput(trimmed);
        setChat(baseMessages);
        if (baseMessages.length === 0) {
          setConversations((prev) => prev.filter((c) => c.id !== currentId));
          setActiveId(null);
        } else {
          setConversations((prev) =>
            updateConversation(prev, currentId, baseMessages, getCurrentTime())
          );
        }
        return;
      }

      const errorEntry: ChatEntry = {
        role: "assistant",
        content: getFriendlyAiError(err),
        error: true,
      };
      const updatedMessages = [...nextMessages, errorEntry];
      const updatedAt = getCurrentTime();
      setChat(updatedMessages);
      setConversations((prev) =>
        updateConversation(prev, currentId, updatedMessages, updatedAt)
      );
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  // Stop button: stop waiting for the answer
  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  // Ask the same question again (replaces the old answer)
  const rerun = (index: number) => {
    void send(chat[index].content, index);
  };

  // Put a message back in the text box to change it
  const startEdit = (index: number) => {
    setMenuIndex(null);
    setEditingIndex(index);
    setInput(chat[index].content);
    requestAnimationFrame(() => {
      const box = textareaRef.current;
      if (!box) return;
      box.focus();
      box.style.height = "auto";
      box.style.height = `${Math.min(box.scrollHeight, 140)}px`;
    });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setInput("");
    requestAnimationFrame(resizeTextarea);
  };

  // "Try again" under an error: re-ask the question that came before it
  const retryAfterError = (errorIndex: number) => {
    if (errorIndex > 0) void send(chat[errorIndex - 1].content, errorIndex - 1);
  };

  // Touch screens: press and hold one of your messages for the menu
  const startPress = (event: React.PointerEvent, index: number) => {
    if (event.pointerType === "mouse") return;
    pressTimerRef.current = window.setTimeout(() => {
      setMenuIndex(index);
      navigator.vibrate?.(15);
    }, 500);
  };

  const cancelPress = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input, editingIndex);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const isEmpty = chat.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="-m-5 flex h-[calc(100vh-3.5rem)] bg-background sm:-m-6 lg:-m-8">

      {/* ── Conversation sidebar ───────────────────────────────────── */}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        {/* Sidebar header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--secondary)", color: "var(--primary)" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              AI Assistant
            </span>
          </div>

          <button
            type="button"
            onClick={startNew}
            title="New conversation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center px-4 pt-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">
                No conversations yet.
                <br />
                Start one below.
              </p>
            </div>
          ) : (
            conversations.map((convo) => {
              const isActive = convo.id === activeId;
              return (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => loadConversation(convo)}
                  className={`group flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
                    isActive
                      ? "bg-background"
                      : "hover:bg-muted"
                  }`}
                >
                  <MessageSquare
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-medium ${
                        isActive ? "text-primary" : "text-secondary-foreground"
                      }`}
                    >
                      {convo.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatTime(convo.updatedAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => deleteConversation(convo.id, e)}
                    title="Delete conversation"
                    className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Chat area ──────────────────────────────────────────────── */}

      <div className="flex min-w-0 flex-1 flex-col">

        {/* Chat header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {activeId
                ? (conversations.find((c) => c.id === activeId)?.title ??
                    "Conversation")
                : "New conversation"}
            </h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Powered by your academic schedule
            </p>
          </div>

          <button
            type="button"
            onClick={startNew}
            title="New conversation"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
          >
            <SquarePen className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl space-y-6">

            {/* Empty state */}
            {isEmpty && (
              <div className="flex flex-col items-center pt-8 text-center">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--primary)" }}
                >
                  <Sparkles className="h-7 w-7" />
                </div>

                <h2 className="text-lg font-bold text-foreground">
                  How can I help you today?
                </h2>

                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  I can see your timetable, assignments, exams, study
                  sessions and events. Ask me anything about your academic
                  schedule.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-secondary-foreground shadow-sm transition hover:border-primary/30 hover:bg-background hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

                        {/* Chat messages */}
            {chat.map((entry, i) => {
              const isUser = entry.role === "user";
              const canAct = isUser && !isLoading;

              return (
                <div
                  key={i}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[85%] flex-col space-y-3 ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="group relative flex items-start gap-2">
                      {/* Mouse: buttons appear when you hover over your message */}
                      {canAct && (
                        <div className="mt-1.5 hidden shrink-0 items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 md:flex">
                          <button
                            type="button"
                            onClick={() => startEdit(i)}
                            title="Edit message"
                            aria-label="Edit message"
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => rerun(i)}
                            title="Ask again"
                            aria-label="Ask again"
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <div
                        onPointerDown={
                          canAct ? (event) => startPress(event, i) : undefined
                        }
                        onPointerUp={canAct ? cancelPress : undefined}
                        onPointerLeave={canAct ? cancelPress : undefined}
                        onPointerCancel={canAct ? cancelPress : undefined}
                        onContextMenu={
                          canAct ? (event) => event.preventDefault() : undefined
                        }
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUser
                            ? "bg-primary text-primary-foreground pointer-coarse:select-none"
                            : entry.error
                              ? "border border-destructive/20 bg-destructive/10 text-destructive"
                              : "border border-border bg-card text-foreground shadow-sm"
                        }`}
                      >
                        {isUser || entry.error ? (
                          // User messages and errors stay as plain text
                          entry.content.split("\n").map((line, j) => (
                            <span key={j}>
                              {line}
                              {j < entry.content.split("\n").length - 1 && (
                                <br />
                              )}
                            </span>
                          ))
                        ) : (
                          // AI responses render as markdown
                          <MarkdownMessage content={entry.content} />
                        )}
                      </div>

                      {/* Touch screens: the menu that opens after a long press */}
                      {menuIndex === i && (
                        <div className="absolute right-0 top-full z-20 mt-1 flex w-40 flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-lg">
                          <button
                            type="button"
                            onClick={() => startEdit(i)}
                            className="flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition hover:bg-muted"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit message
                          </button>
                          <button
                            type="button"
                            onClick={() => rerun(i)}
                            className="flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition hover:bg-muted"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Ask again
                          </button>
                        </div>
                      )}
                    </div>

                    {/* A failed answer: offer to try again */}
                    {entry.error && i > 0 && !isLoading && (
                      <button
                        type="button"
                        onClick={() => retryAfterError(i)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition hover:bg-muted"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Try again
                      </button>
                    )}

                    {entry.insights && entry.insights.length > 0 && (
                      <div className="w-full space-y-1.5">
                        {entry.insights.map((insight, j) => (
                          <div
                            key={j}
                            className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning"
                          >
                            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                            {insight}
                          </div>
                        ))}
                      </div>
                    )}

                    {entry.recommendations &&
                      entry.recommendations.length > 0 && (
                        <div className="w-full space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Recommendations
                          </p>
                          {entry.recommendations.map((rec, j) => (
                            <RecommendationCard key={j} rec={rec} />
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              );
            })}

            {/* Tap anywhere else to close the long-press menu */}
            {menuIndex !== null && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuIndex(null)}
              />
            )}

            {/* Loading dots */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-2 w-2 animate-bounce rounded-full bg-primary"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-border bg-card px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-2xl">
              {editingIndex !== null && (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-primary/10 px-3 py-1.5 text-xs text-primary">
                <span>
                  Editing your message. Sending replaces it and the replies
                  after it.
                </span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-end gap-3 rounded-2xl border border-border bg-muted px-4 py-3 transition focus-within:border-primary/40 focus-within:bg-card">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your schedule, workload, or anything academic..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{ maxHeight: "140px" }}
                disabled={isLoading}
              />
              
                            <button
                type="button"
                onClick={toggleVoice}
                disabled={isLoading || !speech.isSupported}
                aria-pressed={speech.isListening}
                aria-label={
                  speech.isListening ? "Stop voice input" : "Start voice input"
                }
                title={
                  !speech.isSupported
                    ? "Voice input isn't supported in this browser. Try Chrome, Edge or Safari."
                    : speech.isListening
                      ? "Tap to stop"
                      : "Speak your message"
                }
                className={`flex size-9 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  speech.isListening
                    ? "animate-pulse bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-card hover:text-primary"
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>

              {isLoading ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={stopGenerating}
                  className="shrink-0 gap-1.5"
                >
                  <Square className="h-3.5 w-3.5" fill="currentColor" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => send(input, editingIndex)}
                  disabled={!input.trim()}
                  className="shrink-0"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send</span>
                </Button>
              )}
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Press Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}