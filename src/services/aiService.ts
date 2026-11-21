import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  Schema,
} from "firebase/ai";
import { app, appCheckEnabled, firebaseConfigured } from "../lib/firebase";
import { parseFlashcards, renderSafeMarkdown } from "./parser";
import {
  buildExamGuidePrompt,
  buildExplainPrompt,
  buildFlashcardPrompt,
  buildFlashcardRepairPrompt,
  buildSummaryPrompt,
} from "./prompts";
import { rcNumber, rcString } from "./remoteConfig";
import type { Flashcard, InferenceSource, RoutingMode } from "../types/models";

export type { InferenceSource } from "../types/models";

/**
 * Firebase AI Logic is imported and used at runtime here. The Gemini Developer
 * API backend is used so no API key is shipped in the client bundle.
 */
function createAi() {
  try {
    return getAI(app, { backend: new GoogleAIBackend() });
  } catch (error) {
    // A missing/invalid Firebase config must not take down the offline editor.
    console.error("[AI Logic] Initialization failed:", error);
    return null;
  }
}

const ai = createAi();

function requireAi() {
  if (!ai) {
    throw new Error(
      "Firebase AI Logic could not initialize. Add the Firebase web app values to .env.local and reload."
    );
  }
  return ai;
}

// Firebase AI Logic on-device inference limit (Chrome Prompt API): 9216 tokens.
const ON_DEVICE_TOKEN_LIMIT = 9216;
const CHARS_PER_TOKEN = 4;

const flashcardSchema = Schema.object({
  properties: {
    cards: Schema.array({
      items: Schema.object({
        properties: {
          front: Schema.string(),
          back: Schema.string(),
          tag: Schema.string(),
        },
        optionalProperties: ["tag"],
      }),
    }),
  },
});

export type LocalModelStatus = "available" | "downloadable" | "downloading" | "unavailable";
export type Mode = InferenceMode;

export interface ModeSelection {
  mode: Mode;
  reason: string;
  localStatus: LocalModelStatus;
  estimatedTokens: number;
  routing: RoutingMode;
}

export interface FlashcardGeneration {
  cards: Flashcard[];
  source: InferenceSource;
  selection: ModeSelection;
  raw: string;
}

export interface ExamGuideGeneration {
  markdown: string;
  html: string;
  source: InferenceSource;
  selection: ModeSelection;
}

export interface StudyInsightGeneration {
  markdown: string;
  html: string;
  source: InferenceSource;
  selection: ModeSelection;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function localCharLimit(): number {
  const configured = rcNumber("max_local_chars") || 24000;
  return Math.max(1000, Math.min(configured, ON_DEVICE_TOKEN_LIMIT * CHARS_PER_TOKEN));
}

function configuredPreferredMode(): Mode {
  const raw = rcString("ai_mode").toUpperCase();
  if (raw === "ONLY_IN_CLOUD") return InferenceMode.ONLY_IN_CLOUD;
  if (raw === "PREFER_IN_CLOUD") return InferenceMode.PREFER_IN_CLOUD;
  if (raw === "ONLY_ON_DEVICE") return InferenceMode.ONLY_ON_DEVICE;
  return InferenceMode.PREFER_ON_DEVICE;
}

/** Detects whether Chrome's on-device Gemini Nano can be used. */
export async function getLocalModelStatus(): Promise<LocalModelStatus> {
  if (typeof LanguageModel === "undefined") return "unavailable";

  try {
    const availability = await LanguageModel.availability();
    if (availability === "available" || availability === "downloadable" || availability === "downloading") {
      return availability;
    }
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

/**
 * Starts the on-device model download. Must be called from a user gesture
 * (a button click) and before the first prompt.
 */
export async function prepareLocalModel(
  onProgress?: (percent: number) => void
): Promise<LocalModelStatus> {
  const status = await getLocalModelStatus();
  if (status === "unavailable" || status === "available") return status;

  const model = getGenerativeModel(requireAi(), { mode: InferenceMode.ONLY_ON_DEVICE });
  await model.initializeDeviceModel((fraction) => onProgress?.(Math.round(fraction * 100)));

  return getLocalModelStatus();
}

async function selectMode(text: string, routing: RoutingMode = "auto"): Promise<ModeSelection> {
  const localStatus = await getLocalModelStatus();
  const estimatedTokens = estimateTokens(text);
  const preferred = configuredPreferredMode();
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  // Deterministic demo override: always on-device.
  if (routing === "local") {
    if (localStatus === "unavailable") {
      throw new Error(
        "Gemini Nano 4 is not available in this browser. Use Auto Hybrid or Force Cloud, or enable Chrome's Prompt API for Gemini Nano."
      );
    }
    if (localStatus !== "available") {
      throw new Error(
        online
          ? "Gemini Nano is not ready yet. Click Enable Nano in the telemetry bar, wait for the download to finish, then retry."
          : "Gemini Nano is not downloaded yet and you are offline. Reconnect once to download the model, then retry."
      );
    }
    return {
      mode: InferenceMode.ONLY_ON_DEVICE,
      reason: "Demo override: on-device only (Gemini Nano 4).",
      localStatus,
      estimatedTokens,
      routing,
    };
  }

  // Deterministic demo override: always cloud.
  if (routing === "cloud") {
    if (!firebaseConfigured) {
      throw new Error(
        "Cloud AI is not configured. Add the Firebase web app values to .env.local, or switch Routing to Force Local to use Gemini Nano."
      );
    }
    if (!online) {
      throw new Error(
        "Cloud AI needs a connection. Switch Routing to Force Local to keep studying offline with Gemini Nano."
      );
    }
    return {
      mode: InferenceMode.ONLY_IN_CLOUD,
      reason: "Demo override: Cloud fallback via Firebase AI Logic.",
      localStatus,
      estimatedTokens,
      routing,
    };
  }

  // Long text and PDF-sized documents must go to the cloud. On-device
  // inference also cannot handle PDF input directly.
  const tooLong = text.length > localCharLimit() || estimatedTokens > ON_DEVICE_TOKEN_LIMIT;
  // Only an already-installed model is safe to route to. A "downloadable"
  // model must be prepared explicitly from the telemetry bar first, otherwise
  // the SDK can sit waiting on a multi-gigabyte download mid-action.
  const localUsable = localStatus === "available";

  if (tooLong) {
    if (!firebaseConfigured) {
      throw new Error(
        "This passage is too long for on-device AI, and Cloud AI is not configured. Add the Firebase web app values to .env.local, or select a shorter passage."
      );
    }
    if (!online) {
      throw new Error(
        "This passage is too long for on-device AI and you are offline. Select a shorter passage, or reconnect for Cloud AI."
      );
    }
    return {
      mode: InferenceMode.ONLY_IN_CLOUD,
      reason:
        localStatus === "unavailable"
          ? "On-device model unavailable; routed to Cloud."
          : "Multi-document synthesis routed to Cloud (context exceeds on-device limit).",
      localStatus,
      estimatedTokens,
      routing,
    };
  }

  if (!localUsable) {
    if (!firebaseConfigured) {
      throw new Error(
        "Gemini Nano is not ready on this device, and Cloud AI is not configured. Enable Chrome's Prompt API and download the model, or add the Firebase web app values to .env.local."
      );
    }
    if (!online) {
      throw new Error(
        "You are offline and Gemini Nano is not ready on this device. Reconnect once to download it, or enable the local model in Chrome."
      );
    }
    return {
      mode: InferenceMode.ONLY_IN_CLOUD,
      reason: "On-device model not installed; routed to Cloud.",
      localStatus,
      estimatedTokens,
      routing,
    };
  }

  // Without Firebase credentials there is no cloud fallback to prefer, so pin
  // the request to the on-device model instead of letting the SDK try cloud.
  if (!firebaseConfigured) {
    return {
      mode: InferenceMode.ONLY_ON_DEVICE,
      reason: "Local-only mode: Gemini Nano 4 on this device.",
      localStatus,
      estimatedTokens,
      routing,
    };
  }

  return {
    mode: preferred,
    reason:
      preferred === InferenceMode.PREFER_ON_DEVICE
        ? localStatus === "available"
          ? "Local model ready & short context."
          : "Gemini Nano can be enabled; attempting on-device first."
        : "Remote Config selected Cloud-first routing.",
    localStatus,
    estimatedTokens,
    routing,
  };
}

function readInferenceSource(response: unknown): InferenceSource {
  const value = (response as { inferenceSource?: string } | null)?.inferenceSource;
  return value === "ON_DEVICE" || value === "IN_CLOUD" ? value : "UNKNOWN";
}

function flashcardModel(mode: Mode) {
  return getGenerativeModel(requireAi(), {
    mode,
    inCloudParams: {
      model: rcString("cloud_model"),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: flashcardSchema,
      },
    },
    onDeviceParams: {
      promptOptions: {
        responseConstraint: flashcardSchema,
      },
    },
  });
}

function textModel(mode: Mode) {
  return getGenerativeModel(requireAi(), {
    mode,
    inCloudParams: {
      model: rcString("cloud_model"),
    },
  });
}

/** Generates schema-validated flashcards, with one JSON repair retry. */
export async function generateFlashcards(
  text: string,
  routing: RoutingMode = "auto"
): Promise<FlashcardGeneration> {
  const selection = await selectMode(text, routing);
  const model = flashcardModel(selection.mode);

  const first = await model.generateContent(buildFlashcardPrompt(text));
  const raw = first.response.text();
  const source = readInferenceSource(first.response);

  try {
    return { cards: parseFlashcards(raw), source, selection, raw };
  } catch {
    const repair = await model.generateContent(buildFlashcardRepairPrompt(raw));
    const repairedRaw = repair.response.text();
    return {
      cards: parseFlashcards(repairedRaw),
      source: readInferenceSource(repair.response),
      selection,
      raw: repairedRaw,
    };
  }
}

/** Generates an exam guide as sanitized, ready-to-render Markdown. */
export async function generateExamGuide(
  text: string,
  routing: RoutingMode = "auto"
): Promise<ExamGuideGeneration> {
  const selection = await selectMode(text, routing);
  const model = textModel(selection.mode);
  const result = await model.generateContent(buildExamGuidePrompt(text));
  const markdown = result.response.text();

  return {
    markdown,
    html: renderSafeMarkdown(markdown),
    source: readInferenceSource(result.response),
    selection,
  };
}

/** Generates a plain-language explanation or a revision summary. */
export async function generateStudyInsight(
  kind: "explain" | "summarize",
  text: string,
  routing: RoutingMode = "auto"
): Promise<StudyInsightGeneration> {
  const selection = await selectMode(text, routing);
  const model = textModel(selection.mode);
  const prompt = kind === "explain" ? buildExplainPrompt(text) : buildSummaryPrompt(text);
  const result = await model.generateContent(prompt);
  const markdown = result.response.text();

  return {
    markdown,
    html: renderSafeMarkdown(markdown),
    source: readInferenceSource(result.response),
    selection,
  };
}

/** Runtime diagnostics for the demo and for judge verification. */
export async function getRuntimeInfo() {
  return {
    appCheckEnabled,
    localModelStatus: await getLocalModelStatus(),
    configuredMode: rcString("ai_mode"),
    cloudModel: rcString("cloud_model"),
    maxLocalChars: localCharLimit(),
    onDeviceModelName: "Gemini Nano 4",
  };
}
