# Smart Study PDF Assistant

A Progressive Web App that turns study notes into flashcards and exam guides with **hybrid AI**: prompts run on-device with Gemini Nano (Chrome Prompt API) when available, and fall back to a cloud Gemini model through **Firebase AI Logic** when the local model is unavailable or the text is too long.

Built for the `#BuildHybridAI 2026` Firebase Hybrid AI Hackathon. Licensed under MIT (see `LICENSE`).

## Architecture (Role A — AI & Firebase)

| Module | Responsibility |
|---|---|
| `src/lib/firebase.ts` | Firebase app, App Check (debug token in dev, reCAPTCHA v3 in production), Firestore with offline persistence |
| `src/services/aiService.ts` | Runtime Firebase AI Logic calls, local model detection, cloud fallback, `inferenceSource` reporting |
| `src/services/prompts.ts` | Flashcard (JSON) and Exam Guide (Markdown) prompts |
| `src/services/parser.ts` | JSON extraction/repair + Zod validation; Markdown sanitization with DOMPurify |
| `src/services/firestoreSync.ts` | Per-user notes and decks, offline write queue, sync status |
| `src/services/auth.ts` | Anonymous and Google sign-in |
| `src/services/remoteConfig.ts` | Feature flags for inference mode, cloud model, input limit, card count |

Firebase AI Logic is **imported and called at runtime** in `aiService.ts` via `getAI()` and `generateContent()`. No API key is embedded in the client: the Gemini Developer API backend is used.

### Hybrid decision logic

1. Detect Chrome's on-device model with `LanguageModel.availability()`.
2. Estimate tokens (`~4 chars/token`) and enforce the 9216-token on-device limit.
3. If the model is available and the text is short, use `InferenceMode.PREFER_ON_DEVICE` — the SDK falls back to cloud automatically if the local model is not ready.
4. Otherwise use `InferenceMode.ONLY_IN_CLOUD`.
5. Expose `response.inferenceSource` (`ON_DEVICE` / `IN_CLOUD`) in the UI as a badge.

Structured flashcard output uses `responseMimeType: "application/json"` plus `responseSchema` for cloud and `responseConstraint` for on-device. Exam Guide output is Markdown, sanitized before rendering.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the Firebase project in the Firebase Console, add a Web app, and enable:
   - Authentication → Anonymous + Google (add `localhost` and your live domain to Authorized domains)
   - Cloud Firestore
   - Remote Config
   - AI Logic (choose the Gemini Developer API backend; no billing required to start)

3. Provision AI Logic from the CLI (this enables the required Google APIs):

   ```bash
   npx firebase-tools@latest init ailogic
   ```

4. Copy `.env.example` to `.env.local` and fill in the Firebase web config values.

5. Deploy the Firestore rules:

   ```bash
   firebase deploy --only firestore:rules
   ```

6. Make sure App Check → APIs shows **Firebase AI Logic: Enforced**.

## App Check

- **Development:** `src/lib/firebase.ts` sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in dev builds. Open the app on `localhost`, copy the token printed in the browser console, and register it in Firebase Console → App Check → Apps → Manage debug tokens. Debug tokens are accepted by the hackathon; never commit a real token.
- **Production:** create a reCAPTCHA v3 site key, put the public site key in `VITE_RECAPTCHA_SITE_KEY`, keep the secret key in the Firebase console, and register the live domain. Do **not** add `localhost` to reCAPTCHA's allowed domains.

## On-device model (Chrome)

On-device inference requires Chrome Desktop 139+ with `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` enabled. To pre-download the model, open DevTools and run `await LanguageModel.availability()` then `await LanguageModel.create()`, or click **Prepare local model** in the app (called from a user gesture). If the model is not installed, the app still works through the cloud fallback.

## Scripts

```bash
npm run dev        # local dev server
npm run typecheck  # TypeScript check
npm run build      # typecheck + production build
npm run preview    # preview the production build
firebase deploy    # deploy hosting + Firestore rules
```

## Submission checklist

- [ ] App Check enforced for Firebase AI Logic
- [ ] Public repo with this `LICENSE`
- [ ] Hosted app URL
- [ ] Demo video ≤ 3 minutes with English audio or subtitles
- [ ] English description of Firebase AI Logic usage, features, and value proposition
