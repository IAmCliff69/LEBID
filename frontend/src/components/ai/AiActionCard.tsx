import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, Undo2 } from "lucide-react";

import type { AiAction } from "@/api/ai";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import {
  ACTION_HANDLERS,
  ENTITY_NAMES,
  canUndo,
  describeChanges,
  getActionError,
} from "@/lib/aiActions";
import type { ActionState } from "@/lib/aiActions";

interface AiActionCardProps {
  action: AiAction;
  state?: ActionState;
  disabled?: boolean;
  onStateChange: (state: ActionState) => void;
}

export default function AiActionCard({
  action,
  state,
  disabled = false,
  onStateChange,
}: AiActionCardProps) {
  const queryClient = useQueryClient();
  const handler = ACTION_HANDLERS[action.entity];

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDelete = action.action === "delete";
  const Icon =
    action.action === "create" ? Plus : isDelete ? Trash2 : Pencil;
  const changes = describeChanges(action);
  const name = ENTITY_NAMES[action.entity];

  const refreshLists = () => {
    if (!handler) return;
    for (const key of handler.queryKeys) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const runApply = async () => {
    if (!handler || busy) return;
    setBusy(true);
    setError(null);
    try {
      const createdId = await handler.apply(action);
      refreshLists();
      onStateChange({ status: "applied", createdId });
    } catch (err) {
      setError(getActionError(err));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const runUndo = async () => {
    if (!handler || busy) return;
    setBusy(true);
    setError(null);
    try {
      await handler.undo(action, state?.createdId);
      refreshLists();
      onStateChange({ status: "undone" });
    } catch (err) {
      setError(getActionError(err));
    } finally {
      setBusy(false);
    }
  };

  const status = state?.status;
  const isFinished = status === "dismissed" || status === "undone";

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        isDelete ? "border-destructive/30 bg-destructive/5" : "border-secondary bg-background"
      } ${isFinished ? "opacity-60" : ""}`}
      role="group"
      aria-label={action.title}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            isDelete ? "text-destructive" : "text-primary"
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{action.title}</p>

          {action.description && (
            <p className="mt-1 text-xs leading-relaxed text-secondary-foreground">
              {action.description}
            </p>
          )}

          {/* The real item, read from the database (not from the AI) */}
          {action.target && (
            <p className="mt-1 text-xs text-muted-foreground">
              Affects: {action.target}
            </p>
          )}

          {changes.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-foreground">
              {changes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          {/* Buttons / status */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {!status && !handler && (
              <>
                <p className="text-xs text-muted-foreground">
                  I can&apos;t apply this kind of change yet. You can make it
                  yourself on the {name} page.
                </p>
                <button
                  type="button"
                  onClick={() => onStateChange({ status: "dismissed" })}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition hover:bg-muted"
                >
                  Dismiss
                </button>
              </>
            )}

            {!status && handler && (
              <>
                <button
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => (isDelete ? setConfirmDelete(true) : runApply())}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                    isDelete
                      ? "bg-destructive text-white hover:bg-destructive/90"
                      : "bg-primary text-primary-foreground hover:bg-primary-hover"
                  }`}
                >
                  {busy ? "Applying..." : isDelete ? "Delete" : "Apply"}
                </button>
                <button
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => onStateChange({ status: "dismissed" })}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition hover:bg-muted disabled:opacity-60"
                >
                  Dismiss
                </button>
              </>
            )}

            {status === "applied" && (
              <>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Applied
                </span>
                {canUndo(action) && (
                  <button
                    type="button"
                    disabled={busy || disabled}
                    onClick={runUndo}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition hover:bg-muted disabled:opacity-60"
                  >
                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {busy ? "Undoing..." : "Undo"}
                  </button>
                )}
              </>
            )}

            {status === "undone" && (
              <span className="text-xs font-semibold text-muted-foreground">
                Undone
              </span>
            )}
            {status === "dismissed" && (
              <span className="text-xs font-semibold text-muted-foreground">
                Dismissed
              </span>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete this ${name}?`}
        description={`${action.target ?? "This item"} will be deleted. You can undo it from this chat afterwards.`}
        confirmLabel="Delete"
        isLoading={busy}
        onConfirm={runApply}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}