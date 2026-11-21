import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  action: () => void | Promise<void>;
}

interface ConfirmDialogProps {
  request: ConfirmRequest | null;
  onClose: () => void;
}

export function ConfirmDialog({ request, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [request, busy, onClose]);

  if (!request) return null;

  const danger = request.tone !== "primary";

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await request.action();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/20 animate-dialog-in sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              danger ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-600"
            }`}
          >
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
              {request.title}
            </h2>
            <p id="confirm-description" className="mt-1 text-sm leading-6 text-slate-600">
              {request.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
              danger ? "bg-rose-600 hover:bg-rose-500" : "bg-slate-900 hover:bg-slate-700"
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
