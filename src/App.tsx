import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  generateExamGuide,
  generateFlashcards,
  getLocalModelStatus,
  getRuntimeInfo,
  prepareLocalModel,
  type InferenceSource,
  type LocalModelStatus,
  type ModeSelection,
} from "./services/aiService";
import { signInAnonymouslyToApp, signInWithGoogle, watchAuth } from "./services/auth";
import { loadDecks, saveDeck, saveNote, subscribeSyncStatus } from "./services/firestoreSync";
import { initializeRemoteConfig } from "./services/remoteConfig";
import type { Flashcard, StudyDeck } from "./types/models";

type RuntimeInfo = Awaited<ReturnType<typeof getRuntimeInfo>>;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalModelStatus | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"flashcards" | "guide" | null>(null);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [guideHtml, setGuideHtml] = useState("");
  const [guideMarkdown, setGuideMarkdown] = useState("");
  const [source, setSource] = useState<InferenceSource | null>(null);
  const [selection, setSelection] = useState<ModeSelection | null>(null);
  const [syncStatus, setSyncStatus] = useState<"unknown" | "pending" | "synced">("unknown");
  const [decks, setDecks] = useState<StudyDeck[]>([]);

  useEffect(() => {
    const unsubscribeAuth = watchAuth(setUser);
    const unsubscribeSync = subscribeSyncStatus(() => setSyncStatus("synced"));

    void initializeRemoteConfig()
      .then(() => getRuntimeInfo())
      .then((info) => {
        setRuntime(info);
        setLocalStatus(info.localModelStatus);
      })
      .catch((failure) => setError(messageOf(failure)));

    return () => {
      unsubscribeAuth();
      unsubscribeSync();
    };
  }, []);

  async function handlePrepareLocal() {
    setError("");
    setDownloadProgress(0);
    try {
      const status = await prepareLocalModel(setDownloadProgress);
      setLocalStatus(status);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setDownloadProgress(null);
    }
  }

  async function handleFlashcards() {
    if (!text.trim()) {
      setError("Paste or type study text first.");
      return;
    }
    setBusy("flashcards");
    setError("");
    try {
      const result = await generateFlashcards(text);
      setCards(result.cards);
      setSource(result.source);
      setSelection(result.selection);
      setGuideHtml("");
      setGuideMarkdown("");
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(null);
    }
  }

  async function handleExamGuide() {
    if (!text.trim()) {
      setError("Paste or type study text first.");
      return;
    }
    setBusy("guide");
    setError("");
    try {
      const result = await generateExamGuide(text);
      setGuideHtml(result.html);
      setGuideMarkdown(result.markdown);
      setSource(result.source);
      setSelection(result.selection);
      setCards([]);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveDeck() {
    if (!user) {
      setError("Sign in before saving to Firestore.");
      return;
    }
    if (cards.length === 0) {
      setError("Generate flashcards first.");
      return;
    }
    setSyncStatus("pending");
    setError("");
    try {
      await saveDeck({
        id: crypto.randomUUID(),
        uid: user.uid,
        title: text.trim().split("\n")[0]?.slice(0, 80) || "Study deck",
        source: "pasted-text",
        cards,
      });
      setDecks(await loadDecks());
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  async function handleSaveGuide() {
    if (!user) {
      setError("Sign in before saving to Firestore.");
      return;
    }
    if (!guideMarkdown) {
      setError("Generate an exam guide first.");
      return;
    }
    setSyncStatus("pending");
    setError("");
    try {
      await saveNote({
        id: crypto.randomUUID(),
        uid: user.uid,
        title: "Exam guide",
        content: guideMarkdown,
      });
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Smart Study PDF Assistant</h1>
          <p>Hybrid AI: on-device Gemini Nano with Firebase AI Logic cloud fallback.</p>
        </div>
        <div className="auth">
          {user ? (
            <span className="pill">Signed in · {user.isAnonymous ? "Anonymous" : "Google"}</span>
          ) : (
            <>
              <button onClick={() => void signInAnonymouslyToApp().catch((e) => setError(messageOf(e)))}>
                Anonymous sign-in
              </button>
              <button onClick={() => void signInWithGoogle().catch((e) => setError(messageOf(e)))}>
                Google sign-in
              </button>
            </>
          )}
        </div>
      </header>

      <section className="panel diagnostics">
        <h2>Runtime diagnostics</h2>
        <div className="badges">
          <span className={`pill ${runtime?.appCheckEnabled ? "good" : "bad"}`}>
            App Check: {runtime?.appCheckEnabled ? "active" : "missing"}
          </span>
          <span className="pill">Local model: {localStatus ?? "checking…"}</span>
          <span className="pill">Mode: {runtime?.configuredMode ?? "…"}</span>
          <span className="pill">Cloud: {runtime?.cloudModel ?? "…"}</span>
          <span className="pill">Sync: {syncStatus}</span>
        </div>
        {downloadProgress !== null && <p>Downloading on-device model: {downloadProgress}%</p>}
        <button onClick={() => void handlePrepareLocal()} disabled={downloadProgress !== null}>
          Prepare local model
        </button>
        <button
          onClick={() => void getLocalModelStatus().then(setLocalStatus)}
          disabled={downloadProgress !== null}
        >
          Refresh status
        </button>
      </section>

      <section className="panel">
        <h2>Study text</h2>
        <textarea
          aria-label="Study text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste text extracted from your PDF…"
          rows={8}
        />
        <div className="actions">
          <button onClick={() => void handleFlashcards()} disabled={busy !== null}>
            {busy === "flashcards" ? "Generating…" : "Generate flashcards (JSON)"}
          </button>
          <button onClick={() => void handleExamGuide()} disabled={busy !== null}>
            {busy === "guide" ? "Generating…" : "Generate exam guide (Markdown)"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {source && (
        <section className="panel">
          <h2>Inference used</h2>
          <p>
            <span className={`pill ${source === "IN_CLOUD" ? "cloud" : "good"}`}>{source}</span>
            {selection && <span className="muted"> · {selection.reason}</span>}
          </p>
          {selection && (
            <p className="muted">
              Estimated {selection.estimatedTokens} tokens · max local {runtime?.maxLocalChars ?? "…"} chars
            </p>
          )}
        </section>
      )}

      {cards.length > 0 && (
        <section className="panel">
          <h2>Flashcards ({cards.length})</h2>
          <div className="cards">
            {cards.map((card, index) => (
              <article className="card" key={`${card.front}-${index}`}>
                <strong>{card.front}</strong>
                <p>{card.back}</p>
                {card.tag && <span className="pill">{card.tag}</span>}
              </article>
            ))}
          </div>
          <button onClick={() => void handleSaveDeck()}>Save deck to Firestore</button>
        </section>
      )}

      {guideHtml && (
        <section className="panel">
          <h2>Exam guide</h2>
          <div className="markdown" dangerouslySetInnerHTML={{ __html: guideHtml }} />
          <button onClick={() => void handleSaveGuide()}>Save guide as note</button>
        </section>
      )}

      <section className="panel">
        <h2>Cloud decks ({decks.length})</h2>
        <button
          onClick={() => void loadDecks().then(setDecks).catch((e) => setError(messageOf(e)))}
          disabled={!user}
        >
          Refresh from Firestore
        </button>
        <ul>
          {decks.map((deck) => (
            <li key={deck.id}>
              {deck.title} — {deck.cards.length} cards
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
