/**
 * Shared data contracts for NanoStudy.
 *
 * The fields added by Role B are optional on purpose: documents written by
 * earlier versions of the app (and by Role A's Firestore layer) stay valid.
 */

export interface Flashcard {
  front: string;
  back: string;
  tag?: string;
}

/** Where an inference actually ran, mirroring Firebase AI Logic's response. */
export type InferenceSource = "ON_DEVICE" | "IN_CLOUD" | "UNKNOWN";

/** Demo routing override exposed in the telemetry bar. */
export type RoutingMode = "auto" | "local" | "cloud";

/** Local/cloud state of a document in the offline-first workspace. */
export type SyncState = "synced" | "pending" | "local-only";

/** The three AI artefacts the study panel can render. */
export type InsightKind = "explain" | "summarize" | "exam-guide";

export interface StudyDeck {
  id: string;
  uid: string;
  title: string;
  source: string;
  cards: Flashcard[];
  createdAt?: number;
  updatedAt?: number;
  /** Note this deck was generated from, when known. */
  noteId?: string;
  syncState?: SyncState;
  /** Card indexes the student marked as mastered (local-first). */
  mastered?: number[];
  inferenceSource?: InferenceSource;
  model?: string;
}

export interface StudyNote {
  id: string;
  uid: string;
  title: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
  /** "manual", "sample", or "pdf:<filename>". */
  source?: string;
  pageCount?: number;
  isSample?: boolean;
  syncState?: SyncState;
}

/** A generated explanation, summary, or exam guide saved locally. */
export interface StudyInsight {
  id: string;
  uid: string;
  /** null for cross-document syntheses. */
  noteId: string | null;
  kind: InsightKind;
  title: string;
  markdown: string;
  source: InferenceSource;
  model: string;
  route: RoutingMode;
  createdAt: number;
  syncState?: SyncState;
}

/** Last inference shown in the hybrid telemetry bar. */
export interface TelemetrySnapshot {
  source: InferenceSource;
  model: string;
  latencyMs: number;
  reason: string;
  route: RoutingMode;
  estimatedTokens: number;
  createdAt: number;
}

/** Result of a two-way local <-> Firestore synchronisation pass. */
export interface SyncSummary {
  pushed: number;
  pulled: number;
  failed: number;
  skipped: boolean;
}
