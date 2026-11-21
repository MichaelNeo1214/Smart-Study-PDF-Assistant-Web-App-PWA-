import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshotsInSync,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  waitForPendingWrites,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { currentUser } from "./auth";
import type { Flashcard, StudyDeck, StudyNote } from "../types/models";

function millis(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const candidate = value as { toMillis?: () => number };
    if (typeof candidate.toMillis === "function") return candidate.toMillis();
  }
  return undefined;
}

function deckRef(uid: string, deckId: string) {
  return doc(db, "users", uid, "decks", deckId);
}

function noteRef(uid: string, noteId: string) {
  return doc(db, "users", uid, "notes", noteId);
}

export async function saveDeck(deck: StudyDeck): Promise<void> {
  const user = currentUser();
  const existing = await getDoc(deckRef(user.uid, deck.id));

  const payload = {
    uid: user.uid,
    title: deck.title,
    source: deck.source,
    cards: deck.cards,
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await updateDoc(deckRef(user.uid, deck.id), payload);
    return;
  }

  await setDoc(deckRef(user.uid, deck.id), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function loadDeck(deckId: string): Promise<StudyDeck | null> {
  const user = currentUser();
  const snapshot = await getDoc(deckRef(user.uid, deckId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    id: snapshot.id,
    uid: user.uid,
    title: String(data.title ?? "Untitled deck"),
    source: String(data.source ?? ""),
    cards: Array.isArray(data.cards) ? (data.cards as Flashcard[]) : [],
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
  };
}

export async function loadDecks(): Promise<StudyDeck[]> {
  const user = currentUser();
  const decksQuery = query(collection(db, "users", user.uid, "decks"), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(decksQuery);

  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      uid: user.uid,
      title: String(data.title ?? "Untitled deck"),
      source: String(data.source ?? ""),
      cards: Array.isArray(data.cards) ? (data.cards as Flashcard[]) : [],
      createdAt: millis(data.createdAt),
      updatedAt: millis(data.updatedAt),
    };
  });
}

export async function deleteDeck(deckId: string): Promise<void> {
  const user = currentUser();
  await deleteDoc(deckRef(user.uid, deckId));
}

export async function saveNote(note: StudyNote): Promise<void> {
  const user = currentUser();
  const existing = await getDoc(noteRef(user.uid, note.id));

  const payload = {
    uid: user.uid,
    title: note.title,
    content: note.content,
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await updateDoc(noteRef(user.uid, note.id), payload);
    return;
  }

  await setDoc(noteRef(user.uid, note.id), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function loadNotes(): Promise<StudyNote[]> {
  const user = currentUser();
  const notesQuery = query(collection(db, "users", user.uid, "notes"), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(notesQuery);

  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      uid: user.uid,
      title: String(data.title ?? "Untitled note"),
      content: String(data.content ?? ""),
      createdAt: millis(data.createdAt),
      updatedAt: millis(data.updatedAt),
    };
  });
}

/** Reports when offline writes have been acknowledged by Firestore. */
export function subscribeSyncStatus(callback: (synced: boolean) => void): () => void {
  return onSnapshotsInSync(db, () => {
    void waitForPendingWrites(db).then(() => callback(true));
  });
}
