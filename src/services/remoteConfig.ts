import { fetchAndActivate, getRemoteConfig, getValue } from "firebase/remote-config";
import { app, firebaseConfigured } from "../lib/firebase";

export type ConfigKey =
  | "ai_mode"
  | "cloud_model"
  | "max_local_chars"
  | "flashcard_count"
  | "exam_guide_style";

export const remoteConfig = getRemoteConfig(app);

remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 0 : 3_600_000;

remoteConfig.defaultConfig = {
  ai_mode: "PREFER_ON_DEVICE",
  cloud_model: "gemini-3.5-flash-lite",
  max_local_chars: 24000,
  flashcard_count: 10,
  exam_guide_style: "study-guide",
};

export async function initializeRemoteConfig(): Promise<void> {
  // Without Firebase credentials the SDK would retry installation requests and
  // pollute the console. The local defaults above are already the right values.
  if (!firebaseConfigured) return;

  try {
    await fetchAndActivate(remoteConfig);
  } catch (error) {
    console.warn("[Remote Config] Falling back to local defaults:", error);
  }
}

export function rcString(key: ConfigKey): string {
  return getValue(remoteConfig, key).asString();
}

export function rcNumber(key: ConfigKey): number {
  return getValue(remoteConfig, key).asNumber();
}
