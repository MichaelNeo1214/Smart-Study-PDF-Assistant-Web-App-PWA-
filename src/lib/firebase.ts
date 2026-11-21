import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
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

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
  throw new Error(
    "[Firebase] Missing configuration. Copy .env.example to .env.local and fill in the Firebase web app values."
  );
}

export const app = initializeApp(firebaseConfig);

type DebugWindow = Window & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
};

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const configuredDebugToken = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN;

// In dev builds App Check uses the debug provider. The token appears in the
// browser console; register it in Firebase Console -> App Check -> Apps ->
// Manage debug tokens. Never commit a real debug token.
const useDebugProvider = import.meta.env.DEV || Boolean(configuredDebugToken);

if (useDebugProvider) {
  (self as unknown as DebugWindow).FIREBASE_APPCHECK_DEBUG_TOKEN = configuredDebugToken || true;
}

export const appCheckEnabled = Boolean(recaptchaSiteKey) || useDebugProvider;

if (appCheckEnabled) {
  initializeAppCheck(app, {
    // With a debug token set, the SDK uses the debug provider instead of this
    // attestation provider. The placeholder is never sent in debug mode.
    provider: new ReCaptchaV3Provider(recaptchaSiteKey || "debug-only-placeholder"),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.error(
    "[App Check] Not initialized. Set VITE_RECAPTCHA_SITE_KEY for the live domain, " +
      "or run in dev mode to use a debug token. Firebase AI Logic calls will be rejected while App Check is enforced."
  );
}

// Offline persistence: writes made offline are queued and flushed when online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
