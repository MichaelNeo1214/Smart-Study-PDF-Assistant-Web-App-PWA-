export {};

type LanguageModelAvailability = "unavailable" | "downloadable" | "downloading" | "available";

// Chrome's built-in Prompt API is not part of lib.dom yet.
// Firebase AI Logic uses this API internally for on-device inference.
declare global {
  const LanguageModel:
    | {
        availability(): Promise<LanguageModelAvailability>;
        create(options?: Record<string, unknown>): Promise<unknown>;
      }
    | undefined;
}
