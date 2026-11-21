import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { GraduationCap, Library, Loader2, PenLine } from "lucide-react";
import { HybridTelemetryBar } from "./components/HybridTelemetryBar";
import { SidebarLibrary, type UploadProgressState } from "./components/SidebarLibrary";
import { NoteEditor, type EditorAction } from "./components/NoteEditor";
import { StudyDeckPanel, type AiBusyAction, type StudyTab } from "./components/StudyDeckPanel";
import { SetupBanner } from "./components/SetupBanner";
import { Toast, type ToastMessage, type ToastTone } from "./components/Toast";
import { ConfirmDialog, type ConfirmRequest } from "./components/ConfirmDialog";
import {
  generateExamGuide,
  generateFlashcards,
  generateStudyInsight,
  getRuntimeInfo,
  prepareLocalModel,
  type LocalModelStatus,
  type ModeSelection,
} from "./services/aiService";
import {
  signInAnonymouslyToApp,
  signInWithGoogle,
  signOutFromApp,
  watchAuth,
} from "./services/auth";
import { initializeRemoteConfig } from "./services/remoteConfig";
import { syncWorkspace } from "./services/syncEngine";
import { extractPdfText } from "./services/parser";
import { firebaseConfigured, missingFirebaseKeys } from "./lib/firebase";
import {
  LOCAL_UID,
  addTombstone,
  countPendingChanges,
  deleteNoteCascade,
  ensureSeedData,
  listDecks,
  listInsights,
  listNotes,
  putDeck,
  putInsight,
  putNote,
  requestPersistentStorage,
  resetSampleNotes,
} from "./utils/offlineStorage";
import type {
  InferenceSource,
  InsightKind,
  RoutingMode,
  StudyDeck,
  StudyInsight,
  StudyNote,
  TelemetrySnapshot,
} from "./types/models";
import { friendlyError } from "./utils/errors";
import { copyToClipboard, downloadTextFile, safeFilename } from "./utils/clipboard";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

type RuntimeInfo = Awaited<ReturnType<typeof getRuntimeInfo>>;
type MobilePane = "library" | "editor" | "study";
type AuthBusy = "guest" | "google" | null;
type SaveState = "idle" | "saving" | "saved";

function inferenceLabel(source: InferenceSource): string {
  if (source === "ON_DEVICE") return "Gemini Nano 4 on-device";
  if (source === "IN_CLOUD") return "Cloud AI";
  return "hybrid AI";
}

export default function App() {
  const online = useOnlineStatus();

  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [decks, setDecks] = useState<StudyDeck[]>([]);
  const [insights, setInsights] = useState<StudyInsight[]>([]);
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);
  const [studyTab, setStudyTab] = useState<StudyTab>("flashcards");
  const [route, setRoute] = useState<RoutingMode>(() => {
    try {
      const stored = localStorage.getItem("nanostudy:route");
      if (stored === "local" || stored === "cloud") return stored;
    } catch {
      // Private browsing can block localStorage; Auto Hybrid is the safe default.
    }
    return "auto";
  });

  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState<AuthBusy>(null);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalModelStatus | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [busy, setBusy] = useState<AiBusyAction>(null);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [uploading, setUploading] = useState<UploadProgressState | null>(null);
  const [booting, setBooting] = useState(true);
  const [mobilePane, setMobilePane] = useState<MobilePane>("editor");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const userRef = useRef<User | null>(null);
  const syncInFlight = useRef(false);
  const uploadInFlight = useRef(false);
  const saveTimers = useRef<Map<string, number>>(new Map());
  const syncTimer = useRef<number | null>(null);
  const toastCounter = useRef(0);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  );

  const activeDeck = useMemo(() => {
    if (!activeNoteId) return null;
    return (
      decks
        .filter((deck) => deck.noteId === activeNoteId)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0] ?? null
    );
  }, [decks, activeNoteId]);

  const visibleInsights = useMemo(() => {
    return insights
      .filter((insight) => insight.noteId === activeNoteId || insight.noteId === null)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [insights, activeNoteId]);

  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedIds.includes(note.id)),
    [notes, selectedIds]
  );

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, message, tone });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingCount(await countPendingChanges());
    } catch (error) {
      console.warn("[Local] Could not count pending changes:", error);
    }
  }, []);

  const refreshFromLocal = useCallback(async () => {
    const [localNotes, localDecks, localInsights] = await Promise.all([
      listNotes(),
      listDecks(),
      listInsights(),
    ]);

    setNotes(localNotes);
    setDecks(localDecks);
    setInsights(localInsights);
    setSelectedIds((current) => current.filter((id) => localNotes.some((note) => note.id === id)));
    setActiveNoteId((current) => {
      if (current && localNotes.some((note) => note.id === current)) return current;
      return localNotes[0]?.id ?? null;
    });
    setActiveInsightId((current) =>
      current && localInsights.some((insight) => insight.id === current) ? current : null
    );
    setPendingCount(await countPendingChanges());
  }, []);

  const runSync = useCallback(
    async (manual = false) => {
      const currentUser = userRef.current;
      if (!currentUser || !navigator.onLine || syncInFlight.current) {
        if (manual && !currentUser) notify("Sign in to sync with Cloud Firestore.", "info");
        if (manual && currentUser && !navigator.onLine) {
          notify("You are offline. Changes are queued in IndexedDB and will sync automatically.", "info");
        }
        return;
      }

      syncInFlight.current = true;
      setSyncing(true);
      try {
        const summary = await syncWorkspace(currentUser.uid);
        await refreshFromLocal();
        if (manual) {
          if (summary.failed > 0) {
            notify(`Sync finished with ${summary.failed} item(s) still pending.`, "error");
          } else if (summary.pushed === 0 && summary.pulled === 0) {
            notify("Everything is already in sync.", "info");
          } else {
            notify(
              `Cloud sync complete · ${summary.pushed} pushed, ${summary.pulled} pulled.`,
              "success"
            );
          }
        } else if (summary.failed > 0) {
          notify("Some changes could not sync. They remain safe in IndexedDB.", "error");
        }
      } catch (error) {
        if (manual) notify(friendlyError(error), "error");
        else console.warn("[Sync] Background sync failed:", error);
      } finally {
        syncInFlight.current = false;
        setSyncing(false);
      }
    },
    [notify, refreshFromLocal]
  );

  const scheduleSync = useCallback(() => {
    if (!userRef.current || !navigator.onLine) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncTimer.current = null;
      void runSync(false);
    }, 1_800);
  }, [runSync]);

  const queueNoteSave = useCallback(
    (note: StudyNote) => {
      setSaveState("saving");
      const existing = saveTimers.current.get(note.id);
      if (existing) window.clearTimeout(existing);

      const timer = window.setTimeout(() => {
        saveTimers.current.delete(note.id);
        void putNote(note)
          .then(() => {
            setSaveState("saved");
            return refreshPendingCount();
          })
          .then(() => scheduleSync())
          .catch((error) => notify(friendlyError(error), "error"));
      }, 550);

      saveTimers.current.set(note.id, timer);
    },
    [notify, refreshPendingCount, scheduleSync]
  );

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await ensureSeedData();
        if (cancelled) return;
        await refreshFromLocal();
        if (cancelled) return;
        setSaveState("saved");
        void requestPersistentStorage();
      } catch (error) {
        if (!cancelled) notify(friendlyError(error), "error");
      } finally {
        if (!cancelled) setBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [notify, refreshFromLocal]);

  useEffect(() => {
    if (!firebaseConfigured) return;

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = watchAuth((nextUser) => {
        userRef.current = nextUser;
        setUser(nextUser);
      });
    } catch (error) {
      console.warn("[Auth] Could not watch auth state:", error);
    }

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRuntime = async () => {
      try {
        const info = await getRuntimeInfo();
        if (cancelled) return;
        setRuntime(info);
        setLocalStatus(info.localModelStatus);
      } catch (error) {
        console.warn("[Runtime] Could not read AI runtime info:", error);
        if (!cancelled) setLocalStatus("unavailable");
      }
    };

    void loadRuntime();
    void initializeRemoteConfig()
      .then(async () => {
        const info = await getRuntimeInfo();
        if (!cancelled) setRuntime(info);
      })
      .catch((error) => console.warn("[Remote Config] Refresh skipped:", error));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!booting && user && online) void runSync(false);
  }, [booting, user, online, runSync]);

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, []);

  const recordTelemetry = useCallback(
    (source: InferenceSource, selection: ModeSelection, latencyMs: number) => {
      setTelemetry({
        source,
        model:
          source === "ON_DEVICE"
            ? "Gemini Nano 4"
            : runtime?.cloudModel ?? "gemini-3.5-flash-lite",
        latencyMs,
        reason: selection.reason,
        route: selection.routing,
        estimatedTokens: selection.estimatedTokens,
        createdAt: Date.now(),
      });
    },
    [runtime]
  );

  const modelFor = useCallback(
    (source: InferenceSource) =>
      source === "ON_DEVICE"
        ? "Gemini Nano 4"
        : runtime?.cloudModel ?? "gemini-3.5-flash-lite",
    [runtime]
  );

  const handleRouteChange = useCallback(
    (next: RoutingMode) => {
      setRoute(next);
      try {
        localStorage.setItem("nanostudy:route", next);
      } catch {
        // localStorage is optional; the in-memory mode still works.
      }
      notify(
        next === "auto"
          ? "Routing: Auto Hybrid — Gemini Nano first, Cloud fallback."
          : next === "local"
            ? "Routing: Force Local — Gemini Nano 4 only."
            : "Routing: Force Cloud — Firebase AI Logic only.",
        "info"
      );
    },
    [notify]
  );

  const handleSelectNote = useCallback((id: string) => {
    setActiveNoteId(id);
    setActiveInsightId(null);
    setSaveState("saved");
    setMobilePane("editor");
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
  }, []);

  const handleClearSelection = useCallback(() => setSelectedIds([]), []);

  const handleNewNote = useCallback(async () => {
    const now = Date.now();
    const note: StudyNote = {
      id: crypto.randomUUID(),
      uid: userRef.current?.uid ?? LOCAL_UID,
      title: "Untitled note",
      content: "",
      createdAt: now,
      updatedAt: now,
      source: "manual",
      syncState: userRef.current ? "pending" : "local-only",
    };

    try {
      await putNote(note);
      setNotes((current) => [note, ...current]);
      setActiveNoteId(note.id);
      setActiveInsightId(null);
      setSaveState("saved");
      setMobilePane("editor");
      await refreshPendingCount();
      scheduleSync();
      notify("New note created locally.", "success");
    } catch (error) {
      notify(friendlyError(error), "error");
    }
  }, [notify, refreshPendingCount, scheduleSync]);

  const handleUploadPdf = useCallback(
    async (file: File) => {
      if (uploadInFlight.current) return;
      uploadInFlight.current = true;
      setUploading({ fileName: file.name, percent: 0, page: 0, totalPages: 0 });

      try {
        const result = await extractPdfText(file, (progress) =>
          setUploading({
            fileName: file.name,
            percent: progress.percent,
            page: progress.page,
            totalPages: progress.totalPages,
          })
        );

        const now = Date.now();
        const note: StudyNote = {
          id: crypto.randomUUID(),
          uid: userRef.current?.uid ?? LOCAL_UID,
          title: result.title,
          content: result.text,
          createdAt: now,
          updatedAt: now,
          source: `pdf:${file.name}`,
          pageCount: result.pageCount,
          syncState: userRef.current ? "pending" : "local-only",
        };

        await putNote(note);
        setNotes((current) => [note, ...current]);
        setActiveNoteId(note.id);
        setActiveInsightId(null);
        setStudyTab("flashcards");
        setSaveState("saved");
        setMobilePane("editor");
        await refreshPendingCount();
        scheduleSync();
        notify(
          `Extracted ${result.pageCount} page${result.pageCount === 1 ? "" : "s"} from ${file.name}. Saved locally.`,
          "success"
        );
      } catch (error) {
        notify(friendlyError(error), "error");
      } finally {
        uploadInFlight.current = false;
        setUploading(null);
      }
    },
    [notify, refreshPendingCount, scheduleSync]
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      const target = notes.find((note) => note.id === id);
      if (!target) return;

      setConfirm({
        title: "Delete this note?",
        description: `"${target.title}" and its generated flashcards and insights will be removed from this device${
          userRef.current ? " and from your cloud account when online" : ""
        }. This cannot be undone.`,
        confirmLabel: "Delete note",
        tone: "danger",
        action: async () => {
          const remaining = notes.filter((note) => note.id !== id);
          const relatedDeckIds = decks.filter((deck) => deck.noteId === id).map((deck) => deck.id);

          try {
            if (userRef.current) {
              await addTombstone("note", id).catch(() => undefined);
              await Promise.all(
                relatedDeckIds.map((deckId) => addTombstone("deck", deckId).catch(() => undefined))
              );
            }
            await deleteNoteCascade(id);
            setNotes(remaining);
            setDecks((current) => current.filter((deck) => deck.noteId !== id));
            setInsights((current) => current.filter((insight) => insight.noteId !== id));
            setSelectedIds((current) => current.filter((candidate) => candidate !== id));
            if (activeNoteId === id) {
              setActiveNoteId(remaining[0]?.id ?? null);
              setActiveInsightId(null);
            }
            await refreshPendingCount();
            scheduleSync();
            notify("Note deleted from this device.", "success");
          } catch (error) {
            notify(friendlyError(error), "error");
          }
        },
      });
    },
    [activeNoteId, decks, notes, notify, refreshPendingCount, scheduleSync]
  );

  const handleResetSamples = useCallback(() => {
    setConfirm({
      title: "Reset sample lecture notes?",
      description:
        "Fresh copies of the two demo lectures will replace the current sample notes. Your own notes, flashcards, and insights are kept.",
      confirmLabel: "Reset samples",
      tone: "primary",
      action: async () => {
        try {
          await resetSampleNotes();
          await refreshFromLocal();
          setSelectedIds([]);
          setActiveInsightId(null);
          setStudyTab("flashcards");
          notify("Sample lecture notes restored.", "success");
        } catch (error) {
          notify(friendlyError(error), "error");
        }
      },
    });
  }, [notify, refreshFromLocal]);

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!activeNote) return;
      const updated: StudyNote = {
        ...activeNote,
        title,
        updatedAt: Date.now(),
        syncState: userRef.current ? "pending" : "local-only",
      };
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));
      queueNoteSave(updated);
    },
    [activeNote, queueNoteSave]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeNote) return;
      const updated: StudyNote = {
        ...activeNote,
        content,
        updatedAt: Date.now(),
        syncState: userRef.current ? "pending" : "local-only",
      };
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));
      queueNoteSave(updated);
    },
    [activeNote, queueNoteSave]
  );

  const handlePrepareLocal = useCallback(async () => {
    if (downloadProgress !== null) return;
    setDownloadProgress(0);
    try {
      const status = await prepareLocalModel(setDownloadProgress);
      setLocalStatus(status);
      if (status === "available") {
        notify("Gemini Nano 4 is ready for on-device inference.", "success");
      } else if (status === "unavailable") {
        notify(
          "Gemini Nano is not available in this browser. Use Chrome 139+ desktop with the Prompt API flag enabled.",
          "error"
        );
      } else {
        notify("Gemini Nano download started. Keep this tab open.", "info");
      }
    } catch (error) {
      notify(friendlyError(error), "error");
    } finally {
      setDownloadProgress(null);
    }
  }, [downloadProgress, notify]);

  const handleGuest = useCallback(async () => {
    if (!firebaseConfigured) {
      notify(
        "Firebase is not configured. Add .env.local to enable cloud sign-in; the local workspace is active.",
        "info"
      );
      return;
    }
    setAuthBusy("guest");
    try {
      const signedIn = await signInAnonymouslyToApp();
      userRef.current = signedIn;
      setUser(signedIn);
      notify("Signed in as guest. Local notes will sync to Firestore.", "success");
    } catch (error) {
      notify(friendlyError(error), "error");
    } finally {
      setAuthBusy(null);
    }
  }, [notify]);

  const handleGoogle = useCallback(async () => {
    if (!firebaseConfigured) {
      notify(
        "Firebase is not configured. Add .env.local to enable Google sign-in; the local workspace is active.",
        "info"
      );
      return;
    }
    setAuthBusy("google");
    try {
      const signedIn = await signInWithGoogle();
      userRef.current = signedIn;
      setUser(signedIn);
      notify("Signed in with Google. Your workspace will sync to Firestore.", "success");
    } catch (error) {
      notify(friendlyError(error), "error");
    } finally {
      setAuthBusy(null);
    }
  }, [notify]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOutFromApp();
      userRef.current = null;
      setUser(null);
      notify("Signed out. Your workspace remains available offline.", "info");
    } catch (error) {
      notify(friendlyError(error), "error");
    }
  }, [notify]);

  const runExamGuide = useCallback(
    async (
      text: string,
      noteId: string | null,
      title: string
    ): Promise<StudyInsight | null> => {
      if (busy !== null) return null;
      setBusy("exam-guide");
      setStudyTab("insights");
      const started = performance.now();

      try {
        const result = await generateExamGuide(text, "cloud");
        const latency = Math.round(performance.now() - started);
        recordTelemetry(result.source, result.selection, latency);

        const insight: StudyInsight = {
          id: crypto.randomUUID(),
          uid: userRef.current?.uid ?? LOCAL_UID,
          noteId,
          kind: "exam-guide",
          title,
          markdown: result.markdown,
          source: result.source,
          model: modelFor(result.source),
          route: result.selection.routing,
          createdAt: Date.now(),
          syncState: "local-only",
        };

        await putInsight(insight);
        setInsights((current) => [insight, ...current]);
        setActiveInsightId(insight.id);
        setStudyTab("insights");
        setMobilePane("study");
        notify(`Exam guide ready via ${inferenceLabel(result.source)}.`, "success");
        return insight;
      } catch (error) {
        notify(friendlyError(error), "error");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [busy, modelFor, notify, recordTelemetry]
  );

  const handleSynthesize = useCallback(async () => {
    if (selectedNotes.length < 2 || busy !== null) return;
    if (!online) {
      notify("Cloud AI needs a connection. Reconnect to synthesize the selected notes.", "error");
      return;
    }

    const combined = selectedNotes
      .map((note, index) => `## Source ${index + 1}: ${note.title}\n\n${note.content}`)
      .join("\n\n---\n\n");

    const text = [
      "# Multi-Document Synthesis",
      "",
      `Combine the following ${selectedNotes.length} notes into one comprehensive exam guide.`,
      "Prioritise connections, contrasts, and likely exam questions across the sources.",
      "",
      combined,
    ].join("\n");

    const insight = await runExamGuide(
      text,
      null,
      `Comprehensive Exam Guide · ${selectedNotes.length} notes`
    );

    if (insight) {
      setSelectedIds([]);
      setMobilePane("study");
    }
  }, [busy, notify, online, runExamGuide, selectedNotes]);

  const handleEditorAction = useCallback(
    async (action: EditorAction, text: string) => {
      if (!activeNote || busy !== null) return;
      if (!text.trim()) {
        notify("Select or write some study text first.", "info");
        return;
      }

      setBusy(action);
      if (action === "flashcards") setStudyTab("flashcards");
      else setStudyTab("insights");

      const started = performance.now();

      try {
        if (action === "flashcards") {
          const result = await generateFlashcards(text, route);
          const latency = Math.round(performance.now() - started);
          recordTelemetry(result.source, result.selection, latency);

          const now = Date.now();
          const deck: StudyDeck = {
            id: crypto.randomUUID(),
            uid: userRef.current?.uid ?? LOCAL_UID,
            title: activeNote.title || "Study deck",
            source: `note:${activeNote.id}`,
            cards: result.cards,
            noteId: activeNote.id,
            createdAt: now,
            updatedAt: now,
            syncState: userRef.current ? "pending" : "local-only",
            inferenceSource: result.source,
            model: modelFor(result.source),
          };

          await putDeck(deck);
          setDecks((current) => [deck, ...current]);
          setStudyTab("flashcards");
          setMobilePane("study");
          await refreshPendingCount();
          scheduleSync();
          notify(
            `${result.cards.length} flashcards created with ${inferenceLabel(result.source)}.`,
            "success"
          );
        } else {
          const result = await generateStudyInsight(action, text, route);
          const latency = Math.round(performance.now() - started);
          recordTelemetry(result.source, result.selection, latency);

          const insight: StudyInsight = {
            id: crypto.randomUUID(),
            uid: userRef.current?.uid ?? LOCAL_UID,
            noteId: activeNote.id,
            kind: action,
            title:
              action === "explain"
                ? `Explanation · ${activeNote.title}`
                : `Summary · ${activeNote.title}`,
            markdown: result.markdown,
            source: result.source,
            model: modelFor(result.source),
            route: result.selection.routing,
            createdAt: Date.now(),
            syncState: "local-only",
          };

          await putInsight(insight);
          setInsights((current) => [insight, ...current]);
          setActiveInsightId(insight.id);
          setStudyTab("insights");
          setMobilePane("study");
          notify(
            `${action === "explain" ? "Explanation" : "Summary"} ready with ${inferenceLabel(result.source)}.`,
            "success"
          );
        }
      } catch (error) {
        notify(friendlyError(error), "error");
      } finally {
        setBusy(null);
      }
    },
    [activeNote, busy, modelFor, notify, recordTelemetry, refreshPendingCount, route, scheduleSync]
  );

  const handleGenerateFlashcards = useCallback(() => {
    if (!activeNote) return;
    void handleEditorAction("flashcards", activeNote.content);
  }, [activeNote, handleEditorAction]);

  const handleGenerateInsight = useCallback(
    (kind: InsightKind) => {
      if (!activeNote) return;
      if (kind === "exam-guide") {
        if (!online) {
          notify("Cloud AI needs a connection. Reconnect to generate an exam guide.", "error");
          return;
        }
        void runExamGuide(activeNote.content, activeNote.id, `Exam Guide · ${activeNote.title}`);
        return;
      }
      void handleEditorAction(kind, activeNote.content);
    },
    [activeNote, handleEditorAction, notify, online, runExamGuide]
  );

  const handleToggleMastered = useCallback(
    async (index: number) => {
      if (!activeDeck) return;
      const mastered = activeDeck.mastered ?? [];
      const nextMastered = mastered.includes(index)
        ? mastered.filter((candidate) => candidate !== index)
        : [...mastered, index];

      const updated: StudyDeck = {
        ...activeDeck,
        mastered: nextMastered,
        updatedAt: Date.now(),
        syncState: userRef.current ? "pending" : "local-only",
      };

      try {
        await putDeck(updated);
        setDecks((current) => current.map((deck) => (deck.id === updated.id ? updated : deck)));
        await refreshPendingCount();
        scheduleSync();
      } catch (error) {
        notify(friendlyError(error), "error");
      }
    },
    [activeDeck, notify, refreshPendingCount, scheduleSync]
  );

  const handleCopyDeck = useCallback(async () => {
    if (!activeDeck) return;
    const payload = JSON.stringify(
      {
        title: activeDeck.title,
        source: activeDeck.source,
        cards: activeDeck.cards,
        mastered: activeDeck.mastered ?? [],
      },
      null,
      2
    );
    const copied = await copyToClipboard(payload);
    notify(
      copied ? "Flashcard deck copied as JSON." : "Could not access the clipboard.",
      copied ? "success" : "error"
    );
  }, [activeDeck, notify]);

  const handleExportDeck = useCallback(() => {
    if (!activeDeck) return;
    downloadTextFile(
      `${safeFilename(activeDeck.title, "nanostudy-deck")}.json`,
      JSON.stringify(activeDeck, null, 2)
    );
    notify("Flashcard deck exported as JSON.", "success");
  }, [activeDeck, notify]);

  const handleCopyMarkdown = useCallback(
    async (markdown: string) => {
      const copied = await copyToClipboard(markdown);
      notify(
        copied ? "Markdown copied to clipboard." : "Could not access the clipboard.",
        copied ? "success" : "error"
      );
    },
    [notify]
  );

  const handleAppendToNote = useCallback(
    (markdown: string) => {
      if (!activeNote) return;
      const separator = activeNote.content.trim().length > 0 ? "\n\n---\n\n" : "";
      const updated: StudyNote = {
        ...activeNote,
        content: `${activeNote.content}${separator}${markdown}`,
        updatedAt: Date.now(),
        syncState: userRef.current ? "pending" : "local-only",
      };
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));
      queueNoteSave(updated);
      setMobilePane("editor");
      notify("AI result appended to the current note.", "success");
    },
    [activeNote, notify, queueNoteSave]
  );

  const handleSelectInsight = useCallback((id: string) => {
    setActiveInsightId(id);
    setStudyTab("insights");
  }, []);

  const handleTabChange = useCallback((tab: StudyTab) => setStudyTab(tab), []);

  const localCharLimit = runtime?.maxLocalChars ?? 24_000;
  const editorBusy: EditorAction | null =
    busy === "flashcards" || busy === "explain" || busy === "summarize" ? busy : null;
  const studyBadge = activeDeck?.cards.length || visibleInsights.length;

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-slate-900 xl:h-screen xl:overflow-hidden">
      <HybridTelemetryBar
        online={online}
        user={user}
        firebaseConfigured={firebaseConfigured}
        appCheckEnabled={runtime?.appCheckEnabled ?? false}
        authBusy={authBusy}
        route={route}
        telemetry={telemetry}
        running={busy !== null}
        localStatus={localStatus}
        downloadProgress={downloadProgress}
        syncing={syncing}
        pendingCount={pendingCount}
        onRouteChange={handleRouteChange}
        onPrepareLocal={() => void handlePrepareLocal()}
        onGuest={() => void handleGuest()}
        onGoogle={() => void handleGoogle()}
        onSignOut={() => void handleSignOut()}
      />

      {!firebaseConfigured && <SetupBanner missingKeys={missingFirebaseKeys} />}

      <main className="mx-auto min-h-0 w-full max-w-[1800px] flex-1 px-3 pb-24 pt-3 sm:px-5 lg:px-6 xl:pb-3">
        {booting ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading your local workspace…
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 gap-3 xl:h-full xl:grid-cols-[300px_minmax(0,1fr)_400px] xl:items-stretch">
            <div
              className={`${mobilePane === "library" ? "block" : "hidden"} min-h-0 xl:block xl:h-full`}
            >
              <SidebarLibrary
                notes={notes}
                activeNoteId={activeNoteId}
                selectedIds={selectedIds}
                userSignedIn={Boolean(user)}
                online={online}
                uploading={uploading}
                synthesizing={busy === "exam-guide"}
                onSelectNote={handleSelectNote}
                onToggleSelect={handleToggleSelect}
                onClearSelection={handleClearSelection}
                onNewNote={() => void handleNewNote()}
                onUploadPdf={(file) => void handleUploadPdf(file)}
                onDeleteNote={handleDeleteNote}
                onResetSamples={handleResetSamples}
                onSynthesize={() => void handleSynthesize()}
              />
            </div>

            <div
              className={`${mobilePane === "editor" ? "block" : "hidden"} min-h-0 xl:block xl:h-full`}
            >
              <NoteEditor
                note={activeNote}
                busy={editorBusy}
                online={online}
                localCharLimit={localCharLimit}
                saveState={saveState}
                onTitleChange={handleTitleChange}
                onContentChange={handleContentChange}
                onAction={(action, text) => void handleEditorAction(action, text)}
                onNewNote={() => void handleNewNote()}
                onOpenLibrary={() => setMobilePane("library")}
              />
            </div>

            <div
              className={`${mobilePane === "study" ? "block" : "hidden"} min-h-0 xl:block xl:h-full`}
            >
              <StudyDeckPanel
                note={activeNote}
                deck={activeDeck}
                insights={visibleInsights}
                activeInsightId={activeInsightId}
                tab={studyTab}
                busy={busy}
                online={online}
                onTabChange={handleTabChange}
                onSelectInsight={handleSelectInsight}
                onGenerateFlashcards={handleGenerateFlashcards}
                onGenerateInsight={handleGenerateInsight}
                onToggleMastered={(index) => void handleToggleMastered(index)}
                onCopyDeck={() => void handleCopyDeck()}
                onExportDeck={handleExportDeck}
                onCopyMarkdown={(markdown) => void handleCopyMarkdown(markdown)}
                onAppendToNote={handleAppendToNote}
              />
            </div>
          </div>
        )}
      </main>

      <nav
        aria-label="Workspace sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur xl:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
          {(
            [
              { id: "library" as const, label: "Library", icon: Library, badge: notes.length },
              { id: "editor" as const, label: "Editor", icon: PenLine, badge: 0 },
              { id: "study" as const, label: "Study", icon: GraduationCap, badge: studyBadge },
            ] satisfies Array<{
              id: MobilePane;
              label: string;
              icon: typeof Library;
              badge: number;
            }>
          ).map(({ id, label, icon: Icon, badge }) => {
            const active = mobilePane === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMobilePane(id)}
                aria-pressed={active}
                className={`relative flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
                  active ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {badge > 0 && (
                  <span className="absolute right-2 top-0.5 rounded-full bg-slate-900 px-1 py-0.5 text-[8px] font-bold leading-none text-white">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <Toast toast={toast} onDismiss={dismissToast} />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
