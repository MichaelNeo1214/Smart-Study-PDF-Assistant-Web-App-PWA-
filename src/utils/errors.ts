function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function codeOf(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }
  return "";
}

/**
 * Converts SDK/network failures into short, actionable English messages.
 * Never returns an empty string, so the UI can always show something useful.
 */
export function friendlyError(error: unknown): string {
  const raw = messageOf(error);
  const code = codeOf(error);
  const normalized = `${code} ${raw}`.toLowerCase();
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (normalized.includes("app check") || normalized.includes("app-check") || normalized.includes("attestation")) {
    return "Firebase App Check rejected this request. In development, register the debug token from the browser console in Firebase Console → App Check → Manage debug tokens.";
  }

  if (normalized.includes("permission-denied") || normalized.includes("missing or insufficient permissions")) {
    return "Firestore denied this write. Make sure you are signed in and that firestore.rules has been deployed.";
  }

  if (
    normalized.includes("api_key_invalid") ||
    normalized.includes("api key not valid") ||
    normalized.includes("firebasevertexai") ||
    normalized.includes("ai/fetch-error")
  ) {
    return "Cloud AI could not authenticate. Check the Firebase project values and App Check setup, then reload. Force Local still works with Gemini Nano.";
  }

  if (normalized.includes("auth/invalid-api-key") || normalized.includes("api-key-not-valid")) {
    return "Firebase Authentication is not configured. Copy .env.example to .env.local and add the web app values from the Firebase Console.";
  }

  if (normalized.includes("auth/operation-not-allowed")) {
    return "This sign-in method is disabled. Enable Anonymous and Google sign-in in Firebase Console → Authentication → Sign-in method.";
  }

  if (normalized.includes("auth/popup-closed-by-user") || normalized.includes("auth/cancelled-popup-request")) {
    return "Google sign-in was cancelled before it completed.";
  }

  if (normalized.includes("auth/unauthorized-domain")) {
    return "This domain is not authorized for sign-in. Add localhost (and your live domain) under Authentication → Settings → Authorized domains.";
  }

  if (normalized.includes("quota") || normalized.includes("resource-exhausted") || normalized.includes("429")) {
    return "The AI quota was reached. Wait a moment, or switch Routing to Force Local to use Gemini Nano on this device.";
  }

  if (offline && (normalized.includes("network") || normalized.includes("offline") || normalized.includes("failed to fetch") || normalized.includes("unavailable"))) {
    return "You are offline. Gemini Nano still works on this device — switch Routing to Force Local, or reconnect for Cloud AI.";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("network-request-failed") || normalized.includes("unavailable")) {
    return "Could not reach Firebase. Check your connection; your notes remain safe in IndexedDB.";
  }

  return raw || "Something went wrong. Please try again.";
}
