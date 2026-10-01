import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Sparkles,
  Lightbulb,
  BookOpen,
  SquarePen,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { marked } from "marked";
import { sendAiMessage } from "@/api/ai";
import type { ConversationMessage, AiRecommendation } from "@/api/ai";
import { createStudySession } from "@/api/studySessions";
import { Button } from "@/components/ui/button";

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

const STORAGE_KEY = "lebid_ai_conversations";
const MAX_STORED = 30;

const SUGGESTIONS = [
  "What do I have on today?",
  "I missed my study session yesterday. What should I do?",
  "I have an exam coming up. How should I prepare?",
  "Help me plan my assignments for this week.",
  "I have too much to do. Can you help me reorganise?",
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadConversations(): SavedConversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedConversation[]) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: SavedConversation[]): void {
  try {
    // Keep only the most recent MAX_STORED conversations
    const trimmed = convos.slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
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
      className="prose prose-sm max-w-none text-slate-800
        prose-p:my-1 prose-p:leading-relaxed
        prose-ul:my-1 prose-ul:pl-4
        prose-ol:my-1 prose-ol:pl-4
        prose-li:my-0.5
        prose-strong:font-semibold prose-strong:text-slate-900
        prose-em:italic
        prose-headings:font-semibold prose-headings:text-slate-900
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
      ? "bg-[#f4fbff] border-[#CAF0F8]"
      : rec.type === "reschedule_session"
        ? "bg-amber-50 border-amber-100"
        : "bg-slate-50 border-slate-200";

  const iconColor =
    rec.type === "add_study_session"
      ? "text-[#023EBA]"
      : rec.type === "reschedule_session"
        ? "text-amber-600"
        : "text-slate-500";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${bgColor}`}>
      <div className="flex items-start gap-2">
        <BookOpen className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800">{rec.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {rec.description}
          </p>
          {state === "done" && (
            <p className="mt-2 text-xs font-semibold text-green-600">
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
              className="mt-2 rounded-lg bg-[#023EBA] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#023EBA]/90"
            >
              Add to planner
            </button>
          )}
          {state === "loading" && (
            <p className="mt-2 text-xs text-slate-400">Adding...</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AiAssistantPage() {
  // All saved conversations, newest first
  const [conversations, setConversations] = useState<SavedConversation[]>(
    () => loadConversations()
  );

  // The active conversation ID (null = brand-new, unsaved)
  const [activeId, setActiveId] = useState<string | null>(null);

  // Messages in the current chat
  const [chat, setChat] = useState<ChatEntry[]>([]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, isLoading]);

  // Persist conversations to localStorage when their state changes.
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // ── Conversation management ────────────────────────────────────────────────

  const startNew = useCallback(() => {
    setActiveId(null);
    setChat([]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  const loadConversation = useCallback((convo: SavedConversation) => {
    setActiveId(convo.id);
    setChat(convo.messages);
    setInput("");
  }, []);

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

  const buildHistory = (): ConversationMessage[] =>
    chat
      .filter((e) => !e.error)
      .map((e) => ({
        role: e.role === "user" ? "user" : "model",
        content: e.content,
      }));

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    const userEntry: ChatEntry = { role: "user", content: trimmed };
    const nextMessages = [...chat, userEntry];

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
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const result = await sendAiMessage(trimmed, buildHistory());
      const assistantEntry: ChatEntry = {
        role: "assistant",
        content: result.message,
        recommendations: result.recommendations,
        insights: result.insights,
      };
      const updatedMessages = [...nextMessages, assistantEntry];
      const updatedAt = getCurrentTime();
      setChat((prev) => [...prev, assistantEntry]);
      setConversations((prev) =>
        updateConversation(prev, currentId, updatedMessages, updatedAt)
      );
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      const errorEntry: ChatEntry = {
        role: "assistant",
        content:
          error.response?.data?.detail ??
          "Something went wrong. Please try again.",
        error: true,
      };
      const updatedMessages = [...nextMessages, errorEntry];
      const updatedAt = getCurrentTime();
      setChat((prev) => [...prev, errorEntry]);
      setConversations((prev) =>
        updateConversation(prev, currentId, updatedMessages, updatedAt)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
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
    <div className="theme-aware-surface -m-5 flex h-[calc(100vh-3.5rem)] bg-[#f4fbff] sm:-m-6 lg:-m-8">

      {/* ── Conversation sidebar ───────────────────────────────────── */}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        {/* Sidebar header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#CAF0F8", color: "#023EBA" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold text-slate-800">
              AI Assistant
            </span>
          </div>

          <button
            type="button"
            onClick={startNew}
            title="New conversation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#023EBA]"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center px-4 pt-8 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs text-slate-400">
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
                      ? "bg-[#f4fbff]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <MessageSquare
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      isActive ? "text-[#023EBA]" : "text-slate-400"
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-medium ${
                        isActive ? "text-[#023EBA]" : "text-slate-700"
                      }`}
                    >
                      {convo.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {formatTime(convo.updatedAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => deleteConversation(convo.id, e)}
                    title="Delete conversation"
                    className="ml-auto shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
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
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              {activeId
                ? (conversations.find((c) => c.id === activeId)?.title ??
                    "Conversation")
                : "New conversation"}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Powered by your academic schedule
            </p>
          </div>

          <button
            type="button"
            onClick={startNew}
            title="New conversation"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
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
                  style={{ backgroundColor: "#CAF0F8", color: "#023EBA" }}
                >
                  <Sparkles className="h-7 w-7" />
                </div>

                <h2 className="text-lg font-bold text-slate-900">
                  How can I help you today?
                </h2>

                <p className="mt-2 max-w-sm text-sm text-slate-500">
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
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-[#023EBA]/30 hover:bg-[#f4fbff] hover:text-[#023EBA]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {chat.map((entry, i) => (
              <div
                key={i}
                className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex max-w-[85%] flex-col space-y-3 ${
                    entry.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    entry.role === "user"
                      ? "bg-[#023EBA] text-white"
                      : entry.error
                        ? "border border-destructive/20 bg-destructive/10 text-destructive"
                        : "border border-slate-200 bg-white text-slate-800 shadow-sm"
                  }`}
                >
                  {entry.role === "user" || entry.error ? (
                    // User messages and errors stay as plain text
                    entry.content.split("\n").map((line, j) => (
                      <span key={j}>
                        {line}
                        {j < entry.content.split("\n").length - 1 && <br />}
                      </span>
                    ))
                  ) : (
                    // AI responses render as markdown
                    <MarkdownMessage content={entry.content} />
                  )}
                </div>

                  {entry.insights && entry.insights.length > 0 && (
                    <div className="w-full space-y-1.5">
                      {entry.insights.map((insight, j) => (
                        <div
                          key={j}
                          className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                        >
                          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          {insight}
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.recommendations && entry.recommendations.length > 0 && (
                    <div className="w-full space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Recommendations
                      </p>
                      {entry.recommendations.map((rec, j) => (
                        <RecommendationCard key={j} rec={rec} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-2 w-2 animate-bounce rounded-full bg-[#023EBA]"
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
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[#023EBA]/40 focus-within:bg-white transition">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your schedule, workload, or anything academic..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                style={{ maxHeight: "140px" }}
                disabled={isLoading}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => send(input)}
                disabled={!input.trim() || isLoading}
                className="shrink-0"
                style={{ backgroundColor: "#023EBA" }}
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400">
              Press Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}