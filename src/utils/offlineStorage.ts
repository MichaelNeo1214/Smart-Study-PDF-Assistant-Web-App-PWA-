import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import { SAMPLE_NOTES } from "../data/sampleNotes";
import type { StudyDeck, StudyInsight, StudyNote } from "../types/models";

/**
 * IndexedDB is the source of truth for the workspace. Firestore is an optional
 * synchronisation target, never a prerequisite for reading or editing notes.
 */

export const LOCAL_UID = "local";

const DB_NAME = "nanostudy-workspace";
const DB_VERSION = 1;
const SAMPLE_SEEDED_KEY = "sampleSeeded";

export interface Tombstone {
  id: string;
  kind: "note" | "deck";
  targetId: string;
  deletedAt: number;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

interface NanoStudyDB extends DBSchema {
  notes: {
    key: string;
    value: StudyNote;
    indexes: { "by-updated": number };
  };
  decks: {
    key: string;
    value: StudyDeck;
    indexes: { "by-updated": number; "by-note": string };
  };
  insights: {
    key: string;
    value: StudyInsight;
    indexes: { "by-created": number; "by-note": string };
  };
  tombstones: {
    key: string;
    value: Tombstone;
    indexes: { "by-deleted": number };
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

let databasePromise: Promise<IDBPDatabase<NanoStudyDB>> | null = null;

function getDb(): Promise<IDBPDatabase<NanoStudyDB>> {
  if (!databasePromise) {
    databasePromise = openDB<NanoStudyDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("notes")) {
          const notes = database.createObjectStore("notes", { keyPath: "id" });
          notes.createIndex("by-updated", "updatedAt");
        }
        if (!database.objectStoreNames.contains("decks")) {
          const decks = database.createObjectStore("decks", { keyPath: "id" });
          decks.createIndex("by-updated", "updatedAt");
          decks.createIndex("by-note", "noteId");
        }
        if (!database.objectStoreNames.contains("insights")) {
          const insights = database.createObjectStore("insights", { keyPath: "id" });
          insights.createIndex("by-created", "createdAt");
          insights.createIndex("by-note", "noteId");
        }
        if (!database.objectStoreNames.contains("tombstones")) {
          const tombstones = database.createObjectStore("tombstones", { keyPath: "id" });
          tombstones.createIndex("by-deleted", "deletedAt");
        }
        if (!database.objectStoreNames.contains("meta")) {
          database.createObjectStore("meta", { keyPath: "key" });
        }
      },
      blocked() {
        console.warn("[IndexedDB] Another NanoStudy tab is holding an older database version.");
      },
      blocking() {
        console.warn("[IndexedDB] Closing the database so another tab can upgrade.");
        databasePromise?.then((database) => database.close()).catch(() => undefined);
        databasePromise = null;
      },
      terminated() {
        databasePromise = null;
      },
    });
  }
  return databasePromise;
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export async function listNotes(): Promise<StudyNote[]> {
  const database = await getDb();
  const notes = await database.getAllFromIndex("notes", "by-updated");
  return notes.reverse();
}

export async function getNote(id: string): Promise<StudyNote | undefined> {
  const database = await getDb();
  return database.get("notes", id);
}

export async function putNote(note: StudyNote): Promise<StudyNote> {
  const now = Date.now();
  const record: StudyNote = {
    ...note,
    createdAt: note.createdAt ?? now,
    updatedAt: note.updatedAt ?? now,
  };
  const database = await getDb();
  await database.put("notes", record);
  return record;
}

/** Deletes a note plus the decks and insights generated from it. */
export async function deleteNoteCascade(noteId: string): Promise<void> {
  const database = await getDb();
  const [deckIds, insightIds] = await Promise.all([
    database.getAllKeysFromIndex("decks", "by-note", noteId),
    database.getAllKeysFromIndex("insights", "by-note", noteId),
  ]);

  const transaction = database.transaction(["notes", "decks", "insights"], "readwrite");
  await Promise.all([
    transaction.objectStore("notes").delete(noteId),
    ...deckIds.map((deckId) => transaction.objectStore("decks").delete(deckId)),
    ...insightIds.map((insightId) => transaction.objectStore("insights").delete(insightId)),
  ]);
  await transaction.done;
}

/* -------------------------------------------------------------------------- */
/* Decks                                                                      */
/* -------------------------------------------------------------------------- */

export async function listDecks(): Promise<StudyDeck[]> {
  const database = await getDb();
  const decks = await database.getAllFromIndex("decks", "by-updated");
  return decks.reverse();
}

export async function listDecksForNote(noteId: string): Promise<StudyDeck[]> {
  const database = await getDb();
  const decks = await database.getAllFromIndex("decks", "by-note", noteId);
  return decks.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function getDeck(id: string): Promise<StudyDeck | undefined> {
  const database = await getDb();
  return database.get("decks", id);
}

export async function putDeck(deck: StudyDeck): Promise<StudyDeck> {
  const now = Date.now();
  const record: StudyDeck = {
    ...deck,
    createdAt: deck.createdAt ?? now,
    updatedAt: deck.updatedAt ?? now,
  };
  const database = await getDb();
  await database.put("decks", record);
  return record;
}

export async function deleteDeckLocal(deckId: string): Promise<void> {
  const database = await getDb();
  await database.delete("decks", deckId);
}

/* -------------------------------------------------------------------------- */
/* Insights                                                                   */
/* -------------------------------------------------------------------------- */

export async function listInsights(): Promise<StudyInsight[]> {
  const database = await getDb();
  const insights = await database.getAllFromIndex("insights", "by-created");
  return insights.reverse();
}

export async function listInsightsForNote(noteId: string): Promise<StudyInsight[]> {
  const database = await getDb();
  const insights = await database.getAllFromIndex("insights", "by-note", noteId);
  return insights.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putInsight(insight: StudyInsight): Promise<StudyInsight> {
  const database = await getDb();
  await database.put("insights", insight);
  return insight;
}

export async function deleteInsight(insightId: string): Promise<void> {
  const database = await getDb();
  await database.delete("insights", insightId);
}

/* -------------------------------------------------------------------------- */
/* Sync tombstones                                                            */
/* -------------------------------------------------------------------------- */

export async function addTombstone(kind: Tombstone["kind"], targetId: string): Promise<void> {
  const database = await getDb();
  await database.put("tombstones", {
    id: `${kind}:${targetId}`,
    kind,
    targetId,
    deletedAt: Date.now(),
  });
}

export async function listTombstones(): Promise<Tombstone[]> {
  const database = await getDb();
  return database.getAllFromIndex("tombstones", "by-deleted");
}

export async function clearTombstone(kind: Tombstone["kind"], targetId: string): Promise<void> {
  const database = await getDb();
  await database.delete("tombstones", `${kind}:${targetId}`);
}

/* -------------------------------------------------------------------------- */
/* Metadata and seeding                                                       */
/* -------------------------------------------------------------------------- */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const database = await getDb();
  const record = await database.get("meta", key);
  return record?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const database = await getDb();
  await database.put("meta", { key, value });
}

async function seedSampleNotesInternal(): Promise<void> {
  const database = await getDb();
  const now = Date.now();

  for (const [index, sample] of SAMPLE_NOTES.entries()) {
    const timestamp = now - index * 1_000;
    const note: StudyNote = {
      id: `sample-${sample.slug}`,
      uid: LOCAL_UID,
      title: sample.title,
      content: sample.content,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "sample",
      isSample: true,
      syncState: "local-only",
    };
    await database.put("notes", note);
  }

  await setMeta(SAMPLE_SEEDED_KEY, true);
}

/** Seeds the two demo lectures only on a genuinely empty first launch. */
export async function ensureSeedData(): Promise<void> {
  const alreadySeeded = await getMeta<boolean>(SAMPLE_SEEDED_KEY);
  if (alreadySeeded) return;

  const database = await getDb();
  const noteCount = await database.count("notes");
  if (noteCount === 0) {
    await seedSampleNotesInternal();
    return;
  }

  await setMeta(SAMPLE_SEEDED_KEY, true);
}

/** Replaces only the built-in sample notes; user notes are left untouched. */
export async function resetSampleNotes(): Promise<void> {
  const notes = await listNotes();
  for (const note of notes.filter((candidate) => candidate.isSample)) {
    await deleteNoteCascade(note.id);
  }
  await seedSampleNotesInternal();
}

export async function countPendingChanges(): Promise<number> {
  const database = await getDb();
  const [notes, decks] = await Promise.all([database.getAll("notes"), database.getAll("decks")]);
  const pendingNotes = notes.filter((note) => note.syncState !== "synced").length;
  const pendingDecks = decks.filter((deck) => deck.syncState !== "synced").length;
  return pendingNotes + pendingDecks;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Used by the crash screen as a last-resort recovery action. */
export async function clearAllLocalData(): Promise<void> {
  if (databasePromise) {
    const database = await databasePromise.catch(() => null);
    database?.close();
    databasePromise = null;
  }
  await deleteDB(DB_NAME);
}
