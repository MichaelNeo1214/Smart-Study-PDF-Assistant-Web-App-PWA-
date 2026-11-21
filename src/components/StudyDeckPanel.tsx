import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  Cpu,
  Download,
  FilePlus2,
  GraduationCap,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { InsightKind, StudyDeck, StudyInsight, StudyNote } from "../types/models";
import { relativeTime } from "../utils/format";
import { MarkdownView } from "./MarkdownView";

export type StudyTab = "flashcards" | "insights";
export type AiBusyAction = "flashcards" | "explain" | "summarize" | "exam-guide" | null;

interface StudyDeckPanelProps {
  note: StudyNote | null;
  deck: StudyDeck | null;
  insights: StudyInsight[];
  activeInsightId: string | null;
  tab: StudyTab;
  busy: AiBusyAction;
  online: boolean;
  onTabChange: (tab: StudyTab) => void;
  onSelectInsight: (id: string) => void;
  onGenerateFlashcards: () => void;
  onGenerateInsight: (kind: InsightKind) => void;
  onToggleMastered: (index: number) => void;
  onCopyDeck: () => void;
  onExportDeck: () => void;
  onCopyMarkdown: (markdown: string) => void;
  onAppendToNote: (markdown: string) => void;
}

const KIND_META: Record<
  InsightKind,
  { label: string; shortLabel: string; icon: LucideIcon; chip: string }
> = {
  explain: {
    label: "Explain Simply",
    shortLabel: "Explain",
    icon: Lightbulb,
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  summarize: {
    label: "Summary",
    shortLabel: "Summary",
    icon: ListChecks,
    chip: "bg-sky-50 text-sky-700 border-sky-200",
  },
  "exam-guide": {
    label: "Comprehensive Exam Guide",
    shortLabel: "Exam Guide",
    icon: GraduationCap,
    chip: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

const BUSY_LABELS: Record<Exclude<AiBusyAction, null>, string> = {
  flashcards: "Generating flashcards",
  explain: "Explaining",
  summarize: "Summarizing",
  "exam-guide": "Synthesizing exam guide",
};

function SourceBadge({ source }: { source: StudyInsight["source"] }) {
  if (source === "ON_DEVICE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
        <Cpu className="h-2.5 w-2.5" aria-hidden="true" />
        On-device
      </span>
    );
  }
  if (source === "IN_CLOUD") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">
        <Cloud className="h-2.5 w-2.5" aria-hidden="true" />
        Cloud
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
      Hybrid
    </span>
  );
}

function EmptyInsights({
  note,
  busy,
  online,
  onGenerateInsight,
}: {
  note: StudyNote | null;
  busy: AiBusyAction;
  online: boolean;
  onGenerateInsight: (kind: InsightKind) => void;
}) {
  const disabled = !note?.content.trim() || busy !== null;

  return (
    <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-800">Your AI study insights live here</h3>
      <p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-500">
        Explain a concept, condense a lecture, or build a full exam guide. Short passages use Gemini Nano
        on this device; long syntheses use Cloud AI.
      </p>

      <div className="mt-4 grid w-full max-w-xs gap-1.5">
        <button
          type="button"
          onClick={() => onGenerateInsight("explain")}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Lightbulb className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          Explain current note
        </button>
        <button
          type="button"
          onClick={() => onGenerateInsight("summarize")}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ListChecks className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
          Summarize current note
        </button>
        <button
          type="button"
          onClick={() => onGenerateInsight("exam-guide")}
          disabled={disabled || !online}
          title={online ? "Cloud AI exam guide" : "Reconnect to run Cloud AI"}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
          Create Exam Guide (Cloud AI)
        </button>
      </div>

      {!note && (
        <p className="mt-3 text-[10px] text-slate-400">Select or create a note to enable AI actions.</p>
      )}
    </div>
  );
}

export function StudyDeckPanel({
  note,
  deck,
  insights,
  activeInsightId,
  tab,
  busy,
  online,
  onTabChange,
  onSelectInsight,
  onGenerateFlashcards,
  onGenerateInsight,
  onToggleMastered,
  onCopyDeck,
  onExportDeck,
  onCopyMarkdown,
  onAppendToNote,
}: StudyDeckPanelProps) {
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setCardIndex(0);
    setFlipped(false);
  }, [deck?.id]);

  useEffect(() => {
    if (!deck || deck.cards.length === 0) {
      setCardIndex(0);
      return;
    }
    setCardIndex((current) => Math.min(current, deck.cards.length - 1));
  }, [deck]);

  useEffect(() => {
    if (tab !== "flashcards" || !deck || deck.cards.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        setFlipped((value) => !value);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setFlipped(false);
        setCardIndex((current) => (current - 1 + deck.cards.length) % deck.cards.length);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setFlipped(false);
        setCardIndex((current) => (current + 1) % deck.cards.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab, deck]);

  const hasDeck = Boolean(deck && deck.cards.length > 0);
  const currentCard = hasDeck && deck ? deck.cards[cardIndex] : null;
  const mastered = Boolean(deck?.mastered?.includes(cardIndex));
  const activeInsight =
    insights.find((insight) => insight.id === activeInsightId) ?? insights[0] ?? null;

  const goPrevious = () => {
    if (!deck || deck.cards.length === 0) return;
    setFlipped(false);
    setCardIndex((current) => (current - 1 + deck.cards.length) % deck.cards.length);
  };

  const goNext = () => {
    if (!deck || deck.cards.length === 0) return;
    setFlipped(false);
    setCardIndex((current) => (current + 1) % deck.cards.length);
  };

  return (
    <section
      aria-label="Study deck and AI insights"
      className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 p-1.5">
        <button
          type="button"
          onClick={() => onTabChange("flashcards")}
          aria-pressed={tab === "flashcards"}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition ${
            tab === "flashcards"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Flashcards
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
            {deck?.cards.length ?? 0}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("insights")}
          aria-pressed={tab === "insights"}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition ${
            tab === "insights"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          AI Insights & Exam Guide
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
            {insights.length}
          </span>
        </button>
      </div>

      {busy && (
        <div className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/70 px-3 py-1.5 text-[10px] font-semibold text-violet-700">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {BUSY_LABELS[busy]}… hybrid routing in progress
        </div>
      )}

      {tab === "flashcards" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {!hasDeck || !currentCard ? (
            <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Layers className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800">No flashcards yet</h3>
              <p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-500">
                Turn this note into an active-recall deck. Short notes run on-device with Gemini Nano 4;
                longer notes route to Cloud AI automatically.
              </p>
              <button
                type="button"
                onClick={onGenerateFlashcards}
                disabled={!note?.content.trim() || busy !== null}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy === "flashcards" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Generate Flashcards from Current Note
              </button>
              {!note && (
                <p className="mt-3 text-[10px] text-slate-400">Select or create a note first.</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <SourceBadge source={deck?.inferenceSource ?? "UNKNOWN"} />
                  {deck?.model && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                      {deck.model}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">
                  {deck?.cards.length} cards · {relativeTime(deck?.updatedAt)}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onGenerateFlashcards}
                    disabled={busy !== null}
                    title="Generate a fresh deck from this note"
                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-45"
                  >
                    {busy === "flashcards" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onCopyDeck}
                    title="Copy deck as JSON"
                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onExportDeck}
                    title="Export deck as JSON file"
                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col justify-center p-3">
                <button
                  type="button"
                  onClick={() => setFlipped((value) => !value)}
                  className="flip-card relative block h-[250px] w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:h-[270px]"
                  aria-label={flipped ? "Show the question" : "Show the answer"}
                >
                  <div className={`flip-card-inner ${flipped ? "is-flipped" : ""}`}>
                    <div className="flip-face flex flex-col rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Question
                        </span>
                        {currentCard.tag && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                            {currentCard.tag}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 flex-1 overflow-y-auto text-base font-semibold leading-7 text-slate-900">
                        {currentCard.front}
                      </p>
                      <p className="mt-2 text-[10px] text-slate-400">
                        Click the card or press <kbd className="rounded bg-slate-100 px-1">Space</kbd> to
                        reveal the answer.
                      </p>
                    </div>

                    <div className="flip-face flip-back flex flex-col rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                          Answer
                        </span>
                        {currentCard.tag && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                            {currentCard.tag}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 flex-1 overflow-y-auto text-[13px] leading-6 text-slate-700">
                        {currentCard.back}
                      </p>
                      <p className="mt-2 text-[10px] text-emerald-700/70">
                        Click again or press <kbd className="rounded bg-emerald-100 px-1">Space</kbd> to
                        return.
                      </p>
                    </div>
                  </div>
                </button>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrevious}
                    aria-label="Previous card"
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        Card {cardIndex + 1} of {deck?.cards.length}
                      </span>
                      <span>{mastered ? "Mastered" : "Needs review"}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width]"
                        style={{
                          width: `${deck ? ((cardIndex + 1) / deck.cards.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next card"
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleMastered(cardIndex)}
                    aria-pressed={mastered}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${
                      mastered
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {mastered ? "Mastered" : "Mark as mastered"}
                  </button>
                  <p className="hidden text-[9px] text-slate-400 sm:block">
                    <kbd className="rounded bg-slate-100 px-1">←</kbd>{" "}
                    <kbd className="rounded bg-slate-100 px-1">→</kbd> navigate ·{" "}
                    <kbd className="rounded bg-slate-100 px-1">Space</kbd> flip
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {insights.length === 0 ? (
            <EmptyInsights
              note={note}
              busy={busy}
              online={online}
              onGenerateInsight={onGenerateInsight}
            />
          ) : (
            <>
              <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 px-3 py-2">
                {insights.map((insight) => {
                  const meta = KIND_META[insight.kind];
                  const active = activeInsight?.id === insight.id;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={insight.id}
                      type="button"
                      onClick={() => onSelectInsight(insight.id)}
                      aria-pressed={active}
                      title={insight.title}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {meta.shortLabel}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-2">
                <SourceBadge source={activeInsight?.source ?? "UNKNOWN"} />
                {activeInsight?.model && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                    {activeInsight.model}
                  </span>
                )}
                <span className="text-[9px] text-slate-400">
                  {activeInsight ? relativeTime(activeInsight.createdAt) : ""}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onGenerateInsight("explain")}
                    disabled={!note?.content.trim() || busy !== null}
                    title="Explain the current note"
                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
                  >
                    {busy === "explain" ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Lightbulb className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onGenerateInsight("summarize")}
                    disabled={!note?.content.trim() || busy !== null}
                    title="Summarize the current note"
                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
                  >
                    {busy === "summarize" ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <ListChecks className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onGenerateInsight("exam-guide")}
                    disabled={!note?.content.trim() || busy !== null || !online}
                    title={online ? "Generate a Cloud AI exam guide" : "Reconnect to run Cloud AI"}
                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
                  >
                    {busy === "exam-guide" ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <GraduationCap className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {activeInsight && (
                  <>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          KIND_META[activeInsight.kind].chip
                        }`}
                      >
                        {KIND_META[activeInsight.kind].label}
                      </span>
                      {activeInsight.noteId === null && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                          Multi-note synthesis
                        </span>
                      )}
                    </div>
                    <MarkdownView markdown={activeInsight.markdown} />
                  </>
                )}
              </div>

              {activeInsight && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onCopyMarkdown(activeInsight.markdown)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Copy Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => onAppendToNote(activeInsight.markdown)}
                    disabled={!note}
                    title={note ? "Append this result to the current note" : "Select a note first"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FilePlus2 className="h-3 w-3" aria-hidden="true" />
                    Append to Current Note
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
