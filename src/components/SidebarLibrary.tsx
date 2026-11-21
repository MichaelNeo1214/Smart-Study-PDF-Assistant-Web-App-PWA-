import { useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Cloud,
  FileText,
  FileUp,
  HardDrive,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { StudyNote } from "../types/models";
import { countWords, relativeTime, snippet } from "../utils/format";

export interface UploadProgressState {
  fileName: string;
  percent: number;
  page: number;
  totalPages: number;
}

interface SidebarLibraryProps {
  notes: StudyNote[];
  activeNoteId: string | null;
  selectedIds: string[];
  userSignedIn: boolean;
  online: boolean;
  uploading: UploadProgressState | null;
  synthesizing: boolean;
  onSelectNote: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onNewNote: () => void;
  onUploadPdf: (file: File) => void;
  onDeleteNote: (id: string) => void;
  onResetSamples: () => void;
  onSynthesize: () => void;
}

function SyncBadge({ note, userSignedIn }: { note: StudyNote; userSignedIn: boolean }) {
  if (!userSignedIn || note.syncState === "local-only") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
        <HardDrive className="h-2.5 w-2.5" aria-hidden="true" />
        Local
      </span>
    );
  }

  if (note.syncState === "synced") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
        Synced
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
      <Cloud className="h-2.5 w-2.5" aria-hidden="true" />
      Pending
    </span>
  );
}

export function SidebarLibrary({
  notes,
  activeNoteId,
  selectedIds,
  userSignedIn,
  online,
  uploading,
  synthesizing,
  onSelectNote,
  onToggleSelect,
  onClearSelection,
  onNewNote,
  onUploadPdf,
  onDeleteNote,
  onResetSamples,
  onSynthesize,
}: SidebarLibraryProps) {
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(normalized) ||
        note.content.toLowerCase().includes(normalized)
    );
  }, [notes, query]);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    onUploadPdf(file);
  };

  return (
    <aside
      aria-label="Study library"
      className="relative flex h-full min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 shadow-sm"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFile(event.dataTransfer.files?.[0]);
      }}
    >
      <div className="border-b border-slate-200 bg-white p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Library</p>
            <h2 className="text-sm font-semibold text-slate-900">Study notes</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {notes.length}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onNewNote}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New Note
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(uploading)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Upload PDF
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <div className="relative mt-2.5">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or content…"
            aria-label="Search notes"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {uploading && (
        <div className="border-b border-emerald-100 bg-emerald-50/70 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-emerald-900">
              {uploading.fileName}
            </p>
            <span className="text-[10px] font-semibold tabular-nums text-emerald-700">
              {uploading.percent}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-200/70">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${uploading.percent}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-emerald-700">
            Extracting text locally · page {uploading.page} of {uploading.totalPages}
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {filteredNotes.length === 0 ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/70 text-slate-400">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-700">No notes found</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              {query ? "Try a different search term." : "Create a note or import a PDF to begin."}
            </p>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 text-[11px] font-semibold text-slate-600 underline-offset-2 hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredNotes.map((note) => {
              const active = note.id === activeNoteId;
              const selected = selectedIds.includes(note.id);

              return (
                <li key={note.id}>
                  <div
                    className={`group relative rounded-xl border p-2.5 transition ${
                      active
                        ? "border-slate-300 bg-white shadow-sm"
                        : "border-transparent hover:border-slate-200 hover:bg-white/80"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleSelect(note.id)}
                        aria-pressed={selected}
                        aria-label={`${selected ? "Deselect" : "Select"} ${note.title}`}
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-transparent hover:border-slate-500"
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectNote(note.id)}
                        className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                      >
                        <div className="flex items-center gap-1.5">
                          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                            {note.title || "Untitled note"}
                          </p>
                          {note.isSample && (
                            <span className="shrink-0 rounded bg-violet-50 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-600">
                              Sample
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
                          {snippet(note.content, 110) || "Empty note — start writing…"}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400">
                          <span>{relativeTime(note.updatedAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{countWords(note.content)} words</span>
                          {note.pageCount ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{note.pageCount} pages</span>
                            </>
                          ) : null}
                          <span className="ml-auto">
                            <SyncBadge note={note} userSignedIn={userSignedIn} />
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        aria-label={`Delete ${note.title}`}
                        title="Delete note"
                        className="rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-500 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedIds.length >= 2 && (
        <div className="border-t border-slate-200 bg-white p-3 shadow-[0_-10px_24px_-16px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-700">
              {selectedIds.length} notes selected
            </p>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 transition hover:text-slate-700"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Clear
            </button>
          </div>
          <button
            type="button"
            onClick={onSynthesize}
            disabled={synthesizing || !online}
            title={
              online
                ? "Combine the selected notes into one comprehensive exam guide using Cloud AI."
                : "Cloud AI needs a connection. Local on-device study still works."
            }
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {synthesizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Synthesize Exam Guide (Cloud AI)
          </button>
          {!online && (
            <p className="mt-1.5 text-[10px] leading-4 text-amber-600">
              Reconnect to run Cloud AI. Your selected notes stay safely on this device.
            </p>
          )}
        </div>
      )}

      <div className="border-t border-slate-200 bg-white/70 p-2">
        <button
          type="button"
          onClick={onResetSamples}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Reset Sample Notes
        </button>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-400 bg-sky-50/95 p-6 text-center backdrop-blur-sm">
          <FileUp className="h-8 w-8 text-sky-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-sky-800">Drop your PDF here</p>
          <p className="mt-1 text-[11px] text-sky-600">Text is extracted locally in your browser.</p>
        </div>
      )}
    </aside>
  );
}
