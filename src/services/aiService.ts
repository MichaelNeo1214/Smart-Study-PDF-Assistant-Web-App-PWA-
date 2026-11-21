import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  Schema,
} from "firebase/ai";
import { app, appCheckEnabled } from "../lib/firebase";
import { parseFlashcards, renderSafeMarkdown } from "./parser";
import { buildExamGuidePrompt, buildFlashcardPrompt, buildFlashcardRepairPrompt } from "./prompts";
import { rcNumber, rcString } from "./remoteConfig";
import type { Flashcard } from "../types/models";

/**
 * Firebase AI Logic is imported and used at runtime here. The Gemini Developer
 * API backend is used so no API key is shipped in the client bundle.
 */
const ai = getAI(app, { backend: new GoogleAIBackend() });

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
export type InferenceSource = "ON_DEVICE" | "IN_CLOUD" | "UNKNOWN";
export type Mode = InferenceMode;

export interface ModeSelection {
  mode: Mode;
  reason: string;
  localStatus: LocalModelStatus;
  estimatedTokens: number;
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

  const model = getGenerativeModel(ai, { mode: InferenceMode.ONLY_ON_DEVICE });
  await model.initializeDeviceModel((fraction) => onProgress?.(Math.round(fraction * 100)));

  return getLocalModelStatus();
}

async function selectMode(text: string): Promise<ModeSelection> {
  const localStatus = await getLocalModelStatus();
  const estimatedTokens = estimateTokens(text);
  const preferred = configuredPreferredMode();

  // Long text and PDF-sized documents must go to the cloud. On-device
  // inference also cannot handle PDF input directly.
  const tooLong = text.length > localCharLimit() || estimatedTokens > ON_DEVICE_TOKEN_LIMIT;
  const localUsable = localStatus === "available" || localStatus === "downloadable";

  if (tooLong) {
    return {
      mode: InferenceMode.ONLY_IN_CLOUD,
      reason: localStatus === "unavailable"
        ? "On-device model unavailable; using cloud."
        : "Input exceeds the on-device token limit; handing off to cloud.",
      localStatus,
      estimatedTokens,
    };
  }

  if (!localUsable) {
    return {
      mode: InferenceMode.ONLY_IN_CLOUD,
      reason: "On-device model unavailable; using cloud.",
      localStatus,
      estimatedTokens,
    };
  }

  return {
    mode: preferred,
    reason:
      preferred === InferenceMode.PREFER_ON_DEVICE
        ? "On-device first, automatic cloud fallback."
        : "Remote Config selected this inference mode.",
    localStatus,
    estimatedTokens,
  };
}

function readInferenceSource(response: unknown): InferenceSource {
  const value = (response as { inferenceSource?: string } | null)?.inferenceSource;
  return value === "ON_DEVICE" || value === "IN_CLOUD" ? value : "UNKNOWN";
}

function flashcardModel(mode: Mode) {
  return getGenerativeModel(ai, {
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

function examGuideModel(mode: Mode) {
  return getGenerativeModel(ai, {
    mode,
    inCloudParams: {
      model: rcString("cloud_model"),
    },
  });
}

/** Generates schema-validated flashcards, with one JSON repair retry. */
export async function generateFlashcards(text: string): Promise<FlashcardGeneration> {
  const selection = await selectMode(text);
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
export async function generateExamGuide(text: string): Promise<ExamGuideGeneration> {
  const selection = await selectMode(text);
  const model = examGuideModel(selection.mode);
  const result = await model.generateContent(buildExamGuidePrompt(text));
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
  };
}
