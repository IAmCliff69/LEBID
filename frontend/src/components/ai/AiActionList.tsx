import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Undo2 } from "lucide-react";

import type { AiAction } from "@/api/ai";
import AiActionCard from "@/components/ai/AiActionCard";
import { ACTION_HANDLERS, canUndo, getActionError } from "@/lib/aiActions";
import type { ActionState } from "@/lib/aiActions";

interface AiActionListProps {
  actions: AiAction[];
  states?: Record<string, ActionState>;
  onStateChange: (key: string, state: ActionState) => void;
}

// All the cards of one AI reply, plus "Apply all" and "Undo all".
export default function AiActionList({
  actions,
  states,
  onStateChange,
}: AiActionListProps) {
  const queryClient = useQueryClient();
  const [working, setWorking] = useState<"apply" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cards still waiting for the student. Deletes are never part of "Apply all":
  // each one needs its own confirmation.
  const waiting = actions.filter(
    (a) => !states?.[a.key] && ACTION_HANDLERS[a.entity]
  );
  const pending = waiting.filter((a) => a.action !== "delete");
  const leftOutDeletes = waiting.length - pending.length;

  const undoable = actions.filter(
    (a) => states?.[a.key]?.status === "applied" && canUndo(a)
  );

  const refreshLists = (keys: Set<string>) => {
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const applyAll = async () => {
    setWorking("apply");
    setError(null);
    const keys = new Set<string>();
    try {
      for (const action of pending) {
        const handler = ACTION_HANDLERS[action.entity];
        if (!handler) continue;
        try {
          const createdId = await handler.apply(action);
          handler.queryKeys.forEach((k) => keys.add(k));
          onStateChange(action.key, { status: "applied", createdId });
        } catch (err) {
          setError(
            `Stopped at "${action.title}": ${getActionError(err)} The remaining changes were not applied.`
          );
          break;
        }
      }
    } finally {
      refreshLists(keys);
      setWorking(null);
    }
  };

  const undoAll = async () => {
    setWorking("undo");
    setError(null);
    const keys = new Set<string>();
    try {
      // Newest change first
      for (const action of [...undoable].reverse()) {
        const handler = ACTION_HANDLERS[action.entity];
        if (!handler) continue;
        try {
          await handler.undo(action, states?.[action.key]?.createdId);
          handler.queryKeys.forEach((k) => keys.add(k));
          onStateChange(action.key, { status: "undone" });
        } catch (err) {
          setError(
            `Stopped at "${action.title}": ${getActionError(err)} The remaining changes were not undone.`
          );
          break;
        }
      }
    } finally {
      refreshLists(keys);
      setWorking(null);
    }
  };

  const buttonClass =
    "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60";

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Suggested changes
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {pending.length >= 2 && (
            <button
              type="button"
              disabled={working !== null}
              onClick={applyAll}
              className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary-hover`}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {working === "apply" ? "Applying..." : `Apply all (${pending.length})`}
            </button>
          )}

          {undoable.length >= 2 && (
            <button
              type="button"
              disabled={working !== null}
              onClick={undoAll}
              className={`${buttonClass} border border-border text-secondary-foreground hover:bg-muted`}
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              {working === "undo" ? "Undoing..." : `Undo all (${undoable.length})`}
            </button>
          )}
        </div>
      </div>

      {pending.length >= 2 && leftOutDeletes > 0 && (
        <p className="text-xs text-muted-foreground">
          {leftOutDeletes === 1
            ? "1 delete suggestion is not included. Confirm it on its own card."
            : `${leftOutDeletes} delete suggestions are not included. Confirm each one on its own card.`}
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {actions.map((action) => (
        <AiActionCard
          key={action.key}
          action={action}
          state={states?.[action.key]}
          disabled={working !== null}
          onStateChange={(state) => onStateChange(action.key, state)}
        />
      ))}
    </div>
  );
}