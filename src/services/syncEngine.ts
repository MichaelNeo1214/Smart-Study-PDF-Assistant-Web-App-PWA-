import type { SyncSummary } from "../types/models";
import {
  clearTombstone,
  getDeck,
  getNote,
  listDecks,
  listNotes,
  listTombstones,
  putDeck,
  putNote,
  setMeta,
} from "../utils/offlineStorage";
import { deleteDeck, deleteNote, loadDecks, loadNotes, saveDeck, saveNote } from "./firestoreSync";

function logSyncFailure(scope: string, error: unknown): void {
  console.warn(`[Sync] ${scope} failed:`, error);
}

/**
 * Pushes local-only/pending documents, then merges remote documents by
 * updatedAt. IndexedDB stays authoritative; a failed item is never discarded.
 */
export async function syncWorkspace(uid: string): Promise<SyncSummary> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { pushed: 0, pulled: 0, failed: 0, skipped: true };
  }

  let pushed = 0;
  let pulled = 0;
  let failed = 0;

  // 1. Apply offline deletions first so deleted documents cannot be resurrected
  //    by the pull phase.
  const tombstones = await listTombstones();
  for (const tombstone of tombstones) {
    try {
      if (tombstone.kind === "note") {
        await deleteNote(tombstone.targetId);
      } else {
        await deleteDeck(tombstone.targetId);
      }
      await clearTombstone(tombstone.kind, tombstone.targetId);
    } catch (error) {
      failed += 1;
      logSyncFailure(`delete ${tombstone.kind} ${tombstone.targetId}`, error);
    }
  }

  // 2. Push notes edited locally (including samples created before sign-in).
  const localNotes = await listNotes();
  for (const note of localNotes) {
    if (note.syncState === "synced") continue;
    try {
      const outgoing = { ...note, uid };
      await saveNote(outgoing);
      await putNote({ ...outgoing, syncState: "synced" });
      pushed += 1;
    } catch (error) {
      failed += 1;
      logSyncFailure(`note ${note.id}`, error);
    }
  }

  // 3. Push decks generated locally.
  const localDecks = await listDecks();
  for (const deck of localDecks) {
    if (deck.syncState === "synced") continue;
    try {
      const outgoing = { ...deck, uid };
      await saveDeck(outgoing);
      await putDeck({ ...outgoing, syncState: "synced" });
      pushed += 1;
    } catch (error) {
      failed += 1;
      logSyncFailure(`deck ${deck.id}`, error);
    }
  }

  // 4. Pull remote notes, keeping the newer version.
  try {
    const remoteNotes = await loadNotes();
    for (const remote of remoteNotes) {
      const local = await getNote(remote.id);
      if (!local || (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
        await putNote({
          ...remote,
          source: remote.source ?? local?.source,
          pageCount: remote.pageCount ?? local?.pageCount,
          isSample: remote.isSample || local?.isSample,
          syncState: "synced",
        });
        pulled += 1;
      }
    }
  } catch (error) {
    failed += 1;
    logSyncFailure("pull notes", error);
  }

  // 5. Pull remote decks. Mastery marks are intentionally local-first.
  try {
    const remoteDecks = await loadDecks();
    for (const remote of remoteDecks) {
      const local = await getDeck(remote.id);
      if (!local || (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
        await putDeck({
          ...remote,
          mastered: local?.mastered ?? remote.mastered,
          syncState: "synced",
        });
        pulled += 1;
      }
    }
  } catch (error) {
    failed += 1;
    logSyncFailure("pull decks", error);
  }

  await setMeta("lastSyncAt", Date.now());
  return { pushed, pulled, failed, skipped: false };
}
