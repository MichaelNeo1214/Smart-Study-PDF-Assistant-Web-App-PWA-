import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const requiredConfig = [
  ["VITE_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["VITE_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
  ["VITE_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["VITE_FIREBASE_APP_ID", firebaseConfig.appId],
] as const;

export const missingFirebaseKeys = requiredConfig
  .filter(([, value]) => !value)
  .map(([key]) => key);

/**
 * The app must boot even when .env.local is missing. Without real Firebase
 * credentials the local workspace still works; cloud sync and cloud AI surface
 * a clear setup banner instead of crashing the whole React tree.
 */
export const firebaseConfigured = missingFirebaseKeys.length === 0;
export const firebaseConfigError = firebaseConfigured
  ? null
  : `Missing Firebase environment variables: ${missingFirebaseKeys.join(", ")}.`;

const offlineFallbackConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-nanostudy.firebaseapp.com",
  projectId: "demo-nanostudy",
  appId: "1:000000000000:web:0000000000000000000000",
  storageBucket: "demo-nanostudy.appspot.com",
  messagingSenderId: "000000000000",
};

export const app = initializeApp(firebaseConfigured ? firebaseConfig : offlineFallbackConfig);

if (!firebaseConfigured) {
  console.warn(
    `[Firebase] ${firebaseConfigError} NanoStudy is running in local-only workspace mode.`
  );
}

type DebugWindow = Window & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
};

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const configuredDebugToken = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN;

// In dev builds App Check uses the debug provider. The token appears in the
// browser console; register it in Firebase Console -> App Check -> Apps ->
// Manage debug tokens. Never commit a real debug token.
const useDebugProvider = firebaseConfigured && (import.meta.env.DEV || Boolean(configuredDebugToken));

if (useDebugProvider) {
  (self as unknown as DebugWindow).FIREBASE_APPCHECK_DEBUG_TOKEN = configuredDebugToken || true;
}

export let appCheckEnabled = false;

if (firebaseConfigured && (recaptchaSiteKey || useDebugProvider)) {
  try {
    initializeAppCheck(app, {
      // With a debug token set, the SDK uses the debug provider instead of this
      // attestation provider. The placeholder is never sent in debug mode.
      provider: new ReCaptchaV3Provider(recaptchaSiteKey || "debug-only-placeholder"),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckEnabled = true;
  } catch (error) {
    console.error("[App Check] Initialization failed; cloud AI may be rejected:", error);
  }
} else if (firebaseConfigured) {
  console.error(
    "[App Check] Not initialized. Set VITE_RECAPTCHA_SITE_KEY for the live domain, " +
      "or run in dev mode to use a debug token. Firebase AI Logic calls will be rejected while App Check is enforced."
  );
}

function createFirestore() {
  try {
    // Offline persistence: writes made offline are queued and flushed when online.
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (error) {
    // Private browsing and some embedded webviews reject persistent caches.
    console.warn("[Firestore] Persistent cache unavailable; using memory cache:", error);
    return getFirestore(app);
  }
}

export const db = createFirestore();
