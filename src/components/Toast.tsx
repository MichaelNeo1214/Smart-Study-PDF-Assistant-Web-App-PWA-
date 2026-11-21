import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

const toneStyles: Record<ToastTone, { container: string; icon: string }> = {
  success: { container: "border-emerald-200 bg-white", icon: "text-emerald-600" },
  error: { container: "border-rose-200 bg-white", icon: "text-rose-600" },
  info: { container: "border-sky-200 bg-white", icon: "text-sky-600" },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(onDismiss, toast.tone === "error" ? 7_000 : 4_500);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const style = toneStyles[toast.tone];
  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertCircle : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-20 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border p-3.5 shadow-xl shadow-slate-900/10 xl:bottom-6 ${style.container} animate-toast-in`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} aria-hidden="true" />
      <p className="flex-1 text-sm leading-5 text-slate-700">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
