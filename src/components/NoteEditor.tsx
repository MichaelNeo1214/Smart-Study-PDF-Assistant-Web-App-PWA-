import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  CheckCircle2,
  HardDrive,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import type { StudyNote } from "../types/models";
import { countWords, estimateTokens } from "../utils/format";
import { MarkdownView } from "./MarkdownView";

export type EditorAction = "explain" | "summarize" | "flashcards";

interface NoteEditorProps {
  note: StudyNote | null;
  busy: EditorAction | null;
  online: boolean;
  localCharLimit: number;
  saveState: "idle" | "saving" | "saved";
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onAction: (action: EditorAction, text: string) => void;
  onNewNote: () => void;
  onOpenLibrary: () => void;
}

interface SelectionState {
  text: string;
}

interface FloatingPosition {
  x: number;
  y: number;
}

const BUSY_LABELS: Record<EditorAction, string> = {
  explain: "Explaining",
  summarize: "Summarizing",
  flashcards: "Building flashcards",
};

const ACTIONS: Array<{ action: EditorAction; label: string; icon: LucideIcon }> = [
  { action: "explain", label: "Explain Simply", icon: Lightbulb },
  { action: "summarize", label: "Summarize", icon: ListChecks },
  { action: "flashcards", label: "Make Flashcards", icon: Layers },
];

function ActionButton({
  action,
  label,
  icon: Icon,
  busy,
  disabled,
  onClick,
}: {
  action: EditorAction;
  label: string;
  icon: LucideIcon;
  busy: EditorAction | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const active = busy === action;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {active ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {active ? `${BUSY_LABELS[action]}…` : label}
    </button>
  );
}

export function NoteEditor({
  note,
  busy,
  online,
  localCharLimit,
  saveState,
  onTitleChange,
  onContentChange,
  onAction,
  onNewNote,
  onOpenLibrary,
}: NoteEditorProps) {
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition | null>(null);

  useEffect(() => {
    setView("edit");
    setSelection(null);
    setFloatingPosition(null);
  }, [note?.id]);

  useEffect(() => {
    if (!floatingPosition) return;
    const hide = () => setFloatingPosition(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [floatingPosition]);

  const captureSelection = (target: HTMLTextAreaElement, point?: FloatingPosition) => {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const text = target.value.slice(start, end).trim();

    if (text.length < 8) {
      setSelection(null);
      setFloatingPosition(null);
      return;
    }

    setSelection({ text });

    if (point) {
      const halfWidth = 240;
      const x = Math.min(Math.max(point.x, halfWidth), window.innerWidth - halfWidth);
      const y = Math.min(Math.max(point.y + 12, 64), window.innerHeight - 110);
      setFloatingPosition({ x, y });
    } else {
      const rect = target.getBoundingClientRect();
      setFloatingPosition({
        x: Math.min(Math.max(rect.left + rect.width / 2, 240), window.innerWidth - 240),
        y: Math.min(Math.max(rect.top + 56, 64), window.innerHeight - 110),
      });
    }
  };

  const runAction = (action: EditorAction, text: string) => {
    setSelection(null);
    setFloatingPosition(null);
    onAction(action, text);
  };

  if (!note) {
    return (
      <section className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-emerald-300 shadow-sm">
          <BookOpen className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
          Your study workspace is ready
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Create a note, import a lecture PDF, or open one of the sample lectures from the library.
          Everything is saved locally and works offline.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onNewNote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Note
          </button>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Open Library
          </button>
        </div>
        <p className="mt-6 max-w-md text-[11px] leading-5 text-slate-400">
          Tip: select any passage to reveal the floating AI toolbar — Explain Simply, Summarize, or Make
          Flashcards with Gemini Nano 4.
        </p>
      </section>
    );
  }

  const words = countWords(note.content);
  const characters = note.content.length;
  const tokens = estimateTokens(note.content);
  const onDeviceFriendly = characters <= localCharLimit && tokens <= 9_216;
  const hasContent = note.content.trim().length > 0;

  return (
    <section
      aria-label="Note editor"
      className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Editor</p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setView("edit")}
                aria-pressed={view === "edit"}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${
                  view === "edit"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setView("preview")}
                aria-pressed={view === "preview"}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${
                  view === "preview"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Preview
              </button>
            </div>

            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
              {saveState === "saving" ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />
              )}
              {saveState === "saving" ? "Saving…" : "Saved locally"}
            </span>
          </div>
        </div>

        <input
          type="text"
          value={note.title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Untitled note"
          aria-label="Note title"
          maxLength={160}
          className="mt-1 w-full border-0 bg-transparent p-0 text-xl font-semibold tracking-tight text-slate-900 placeholder:text-slate-300 focus:outline-none"
        />

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
          <span>{words} words</span>
          <span aria-hidden="true">·</span>
          <span>{characters.toLocaleString()} chars</span>
          <span aria-hidden="true">·</span>
          <span>~{tokens.toLocaleString()} tokens</span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-semibold ${
              onDeviceFriendly ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
            }`}
            title={
              onDeviceFriendly
                ? "This note fits the on-device Gemini Nano context window."
                : "This note is routed to Cloud AI because it exceeds the on-device context window."
            }
          >
            {onDeviceFriendly ? "On-device friendly" : "Cloud context"}
          </span>
          {note.pageCount ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{note.pageCount} pages</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-2">
        <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
          AI actions
        </span>
        {ACTIONS.map(({ action, label, icon }) => (
          <ActionButton
            key={action}
            action={action}
            label={label}
            icon={icon}
            busy={busy}
            disabled={!hasContent || busy !== null}
            onClick={() => runAction(action, note.content)}
          />
        ))}
        <span className="ml-auto hidden text-[10px] text-slate-400 2xl:inline">
          Select text for the floating toolbar
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {view === "edit" ? (
          <textarea
            value={note.content}
            onChange={(event) => onContentChange(event.target.value)}
            onMouseUp={(event) =>
              captureSelection(event.currentTarget, { x: event.clientX, y: event.clientY })
            }
            onKeyUp={(event) => captureSelection(event.currentTarget)}
            onBlur={() => {
              setSelection(null);
              setFloatingPosition(null);
            }}
            placeholder="Paste lecture notes, or import a PDF to extract text locally…"
            aria-label="Note content"
            spellCheck
            className="min-h-[300px] w-full flex-1 resize-none border-0 bg-transparent p-4 text-[13px] leading-7 text-slate-700 placeholder:text-slate-300 focus:outline-none"
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <MarkdownView markdown={note.content || "_Nothing to preview yet._"} />
          </div>
        )}

        {busy && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {BUSY_LABELS[busy]} with hybrid AI…
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <HardDrive className="h-3 w-3" aria-hidden="true" />
          IndexedDB · works offline
        </span>
        <span>{online ? "Cloud sync available" : "Airplane mode — on-device AI only"}</span>
      </div>

      {selection &&
        floatingPosition &&
        !busy &&
        createPortal(
          <div
            style={{ left: floatingPosition.x, top: floatingPosition.y }}
            className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl shadow-slate-950/30 animate-toolbar-in"
            onMouseDown={(event) => event.preventDefault()}
            role="toolbar"
            aria-label="AI actions for selected text"
          >
            <span className="px-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
              AI
            </span>
            {ACTIONS.map(({ action, label, icon: Icon }) => (
              <button
                key={action}
                type="button"
                onClick={() => runAction(action, selection.text)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSelection(null);
                setFloatingPosition(null);
              }}
              aria-label="Dismiss selection toolbar"
              className="rounded-md p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>,
          document.body
        )}
    </section>
  );
}
