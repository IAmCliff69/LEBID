import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Lightbulb, BookOpen, RotateCcw } from "lucide-react";

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

// ─── Suggestion chips shown when conversation is empty ────────────────────────

const SUGGESTIONS = [
  "What do I have on today?",
  "I missed my study session yesterday. What should I do?",
  "I have an exam coming up. How should I prepare?",
  "Help me plan my assignments for this week.",
  "I have too much to do. Can you help me reorganise?",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  onAccepted,
}: {
  rec: AiRecommendation;
  onAccepted?: (rec: AiRecommendation) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAddSession = rec.type === "add_study_session";
  const canAct = isAddSession && !!onAccepted;

  const handleAccept = async () => {
    if (!canAct || state !== "idle") return;
    setState("loading");
    setErrorMsg(null);
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
      onAccepted(rec);
    } catch {
      setState("error");
      setErrorMsg("Failed to create session. Please try again.");
    }
  };

  const iconColor =
    rec.type === "add_study_session"
      ? "text-[#023EBA]"
      : rec.type === "reschedule_session"
        ? "text-amber-600"
        : "text-slate-500";

  const bgColor =
    rec.type === "add_study_session"
      ? "bg-[#f4fbff] border-[#CAF0F8]"
      : rec.type === "reschedule_session"
        ? "bg-amber-50 border-amber-100"
        : "bg-slate-50 border-slate-200";

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${bgColor}`}
    >
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

          {state === "error" && errorMsg && (
            <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
          )}

          {canAct && state === "idle" && (
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
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever chat updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, isLoading]);

  // Build the history array the backend expects
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
    setChat((prev) => [...prev, userEntry]);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const history = buildHistory();
      const result = await sendAiMessage(trimmed, history);

      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.message,
          recommendations: result.recommendations,
          insights: result.insights,
        },
      ]);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      const detail =
        error.response?.data?.detail ??
        "Something went wrong. Please try again.";

      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: detail,
          error: true,
        },
      ]);
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
    // Auto-grow textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  const clearChat = () => {
    setChat([]);
    setInput("");
  };

  const isEmpty = chat.length === 0;

  return (
    <div className="-m-5 flex h-[calc(100vh-3.5rem)] flex-col bg-[#f4fbff] sm:-m-6 lg:-m-8">

      {/* ── Header ──────────────────────────────────────────────────── */}

      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#CAF0F8", color: "#023EBA" }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              AI Assistant
            </h1>
            <p className="text-xs text-slate-500">
              Powered by your academic schedule
            </p>
          </div>
        </div>

        {!isEmpty && (
          <button
            type="button"
            onClick={clearChat}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New conversation
          </button>
        )}
      </div>

      {/* ── Chat area ───────────────────────────────────────────────── */}

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
                I can see your timetable, assignments, exams, study sessions
                and events. Ask me anything about your academic schedule.
              </p>

              {/* Suggestion chips */}
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

          {/* Messages */}
          {chat.map((entry, i) => (
            <div key={i} className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] space-y-3 ${entry.role === "user" ? "items-end" : "items-start"} flex flex-col`}>

                {/* Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    entry.role === "user"
                      ? "bg-[#023EBA] text-white"
                      : entry.error
                        ? "border border-destructive/20 bg-destructive/10 text-destructive"
                        : "border border-slate-200 bg-white text-slate-800 shadow-sm"
                  }`}
                >
                  {/* Preserve newlines */}
                  {entry.content.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < entry.content.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>

                {/* Insights */}
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

                {/* Recommendations */}
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

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-[#023EBA]"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-[#023EBA]"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-[#023EBA]"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input bar ───────────────────────────────────────────────── */}

      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
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
  );
}