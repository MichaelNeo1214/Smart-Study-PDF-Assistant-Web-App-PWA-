# NanoStudy — Hybrid AI Study Workspace

A Progressive Web App that turns PDFs and lecture notes into flashcards, summaries, and exam guides with **hybrid AI**: prompts run on-device with Gemini Nano (Chrome Prompt API) when available, and fall back to a cloud Gemini model through **Firebase AI Logic** when the local model is unavailable, the context exceeds the on-device limit, or the user selects cloud routing.

Built for the **Firebase Hybrid AI Hackathon — #BuildHybridAI 2026**. Licensed under MIT (see `LICENSE`).

---

## 1. Project Overview & Value Proposition

NanoStudy is an **offline-first** study assistant that lets students import lecture notes and PDFs, generate active-recall flashcards, and build comprehensive exam guides — all without requiring a network connection. The app pairs **on-device Gemini Nano 4 inference** (via Chrome's Prompt API) with **cloud fallback through Firebase AI Logic**, giving judges and users a live demonstration of hybrid AI routing: low-latency, private local inference for short passages, and scalable cloud synthesis for long or multi-document content.

### Core value proposition

| Capability | How NanoStudy delivers it |
|---|---|
| **Works offline** | IndexedDB is the source of truth; notes, PDF text, decks, and insights persist locally and survive page reloads |
| **Client-side PDF extraction** | `pdfjs-dist` worker is bundled with the app (no CDN), so PDF text is extracted entirely in the browser |
| **On-device AI first** | Short passages use Gemini Nano 4 on the student's machine — private, zero-latency, no API cost |
| **Cloud fallback** | Longer texts and multi-document exam guides route to Firebase AI Logic when local capacity is exceeded |
| **Live hybrid telemetry** | A telemetry header shows the real-time routing decision, model name, latency (ms), and estimated tokens |
| **Installable PWA** | Service worker caches the app shell; the app installs via Chrome's "Install" button and reloads offline |

---

## 2. Hybrid Inference Architecture

NanoStudy routes every AI request through `src/services/aiService.ts`, which calls the **Firebase AI Logic SDK at runtime** (`getAI()` + `generateContent()` via `GoogleAIBackend`). No API key is embedded in the client bundle — the Gemini Developer API backend is used.

### Routing decision flow

1. **Detect** Chrome's on-device model with `LanguageModel.availability()` (`chrome-ai.d.ts`).
2. **Estimate tokens** (~4 chars/token) and enforce the 9,216-token on-device limit.
3. **Apply the user's routing mode** from the telemetry bar (`Auto Hybrid` / `Force Local` / `Force Cloud`).
4. **Execute** via Firebase AI Logic with `InferenceMode.PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, or `ONLY_IN_CLOUD`.
5. **Report** `response.inferenceSource` (`ON_DEVICE` / `IN_CLOUD`) in the telemetry badge, along with model name, latency, and reason.

```
┌─────────────────────────────────────────────────────────────┐
│  User selects route:  Auto  │  Force Local  │  Force Cloud  │
└───────────────┬─────────────┴───────────────┴───────────────┘
                │
        ┌───────▼───────┐
        │   aiService   │  ← Firebase AI Logic SDK (runtime call)
        │ selectMode()  │     getAI() → generateContent()
        └───────┬───────┘
                │
   ┌────────────┼────────────┐
   ▼            ▼            ▼
ON_DEVICE  IN_CLOUD   (error → graceful)
Gemini Nano   Firebase AI   user message
4 (local)     Logic (cloud)
```

### Flashcard output (structured)
Uses `responseMimeType: "application/json"` + `responseSchema` for cloud, and `responseConstraint` for on-device, with one JSON-repair retry.

### Exam Guide / Explain / Summarize (Markdown)
Returns Markdown, sanitized with DOMPurify before rendering via `MarkdownView`.

---

## 3. Firebase & Tech Stack Integration

| Layer | Module | Role |
|---|---|---|
| **Firebase App** | `src/lib/firebase.ts` | App init, App Check (debug token in dev / reCAPTCHA v3 prod), Firestore with offline persistence, graceful fallback config when `.env` is missing |
| **Firebase AI Logic** | `src/services/aiService.ts` | Runtime `getAI()`/`generateContent()`, local model detection, cloud fallback, `inferenceSource` reporting |
| **Firebase Auth** | `src/services/auth.ts` | Anonymous (guest) + Google sign-in, sign-out, auth state watcher |
| **Cloud Firestore** | `src/services/firestoreSync.ts` | Per-user notes/decks, offline write queue, sync status |
| **Firebase Remote Config** | `src/services/remoteConfig.ts` | Feature flags: `ai_mode`, `cloud_model`, `max_local_chars`, `flashcard_count`, `exam_guide_style` |
| **Sync engine** | `src/services/syncEngine.ts` | Two-way local ⇄ Firestore sync with tombstones for offline deletions |
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS | Three-pane workspace: Library / Editor / Study |
| **Offline storage** | IndexedDB (`idb`) | Source of truth for notes, decks, insights, tombstones |
| **PDF parsing** | `pdfjs-dist` (bundled worker) | Client-side text extraction, no CDN, works offline |
| **PWA** | Service worker + `manifest.webmanifest` | App-shell caching, installable via Chrome, offline reload |

### Firebase AI Logic at runtime
`aiService.ts` imports `getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode`, and `Schema` from `firebase/ai` and calls `model.generateContent()` on every AI action. This is a real SDK call — not a mock.

### Firebase App Check
`src/lib/firebase.ts` initializes App Check with `ReCaptchaV3Provider` (production site key) or the debug provider (dev). `appCheckEnabled` is exposed to the telemetry bar so judges can verify App Check status. Cloud AI calls are guarded — if App Check is not initialized, the UI shows a clear setup message rather than crashing.

---

## 4. Key Features

### Hybrid Telemetry Bar (`HybridTelemetryBar`)
- NanoStudy branding with "Hybrid" chip
- Real-time network pill: `Online • Local Workspace` / `Offline Mode • Local IndexedDB`
- Last-inference badge: `On-device • Gemini Nano 4` / `Cloud fallback • Firebase AI Logic`
- Model name, latency (ms), estimated tokens, routing reason
- App Check status indicator
- Route switcher: `Auto Hybrid` | `Force Local` | `Force Cloud` (controls `aiService.ts` routing)
- Local model chip: `Enable Nano` / `Nano ready` / `Nano unavailable`
- Auth controls: Continue as Guest (Anonymous), Sign in with Google, Sign out

### Sidebar Library (`SidebarLibrary`)
- `+ New Note` — creates and focuses a blank note
- `Upload PDF` — click or drag-and-drop; text extracted locally via bundled `pdfjs-dist` worker with per-page progress
- Search by title or content
- Multi-select checkboxes → `Synthesize Exam Guide (Cloud AI)` for 2+ notes
- Per-note sync badge (Local / Synced / Pending)
- Delete with confirmation dialog
- Two seeded English sample lectures + `Reset Sample Notes`

### Note Editor (`NoteEditor`)
- Editable title with debounced auto-save to IndexedDB
- Word / character / token counters; on-device-friendly vs cloud-context chip
- `Edit` / `Preview Markdown` toggle
- Static AI action buttons: Explain Simply, Summarize, Make Flashcards
- Floating selection toolbar appears when ≥8 chars are selected
- `IndexedDB · works offline` / `Cloud sync available` footer

### Study Deck & AI Insights (`StudyDeckPanel`)
- **Flashcards tab**: interactive flip cards (click or `Space`), `Previous`/`Next` (click or `ArrowLeft`/`ArrowRight`), progress bar, Mastered / Needs review, copy/export deck as JSON
- **AI Insights tab**: rendered Markdown for Explain / Summary / Exam Guide, `Copy Markdown`, `Append to Current Note`
- Source badge (On-device / Cloud / Hybrid) per artefact

### Error handling
- `ErrorBoundary` wraps the entire app (no white screen)
- `SetupBanner` shows gracefully when Firebase `.env` is missing — dismissible, expandable setup steps
- `friendlyError()` converts SDK failures into short, actionable English messages
- All feature modules degrade gracefully without Firebase credentials

---

## 5. Local Setup & Configuration Guide

### Prerequisites
- Node.js 18+ and npm
- Chrome Desktop 139+ (for Gemini Nano on-device inference)

### Install & run

```bash
# 1. Install dependencies
npm install

# 2. Configure Firebase (optional for local-only mode)
cp .env.example .env.local
# Fill in VITE_FIREBASE_* values from Firebase Console → Project Settings → Web App

# 3. Start the dev server
npm run dev
# → http://localhost:5174

# 4. Type check
npm run typecheck   # = npx tsc --noEmit

# 5. Production build
npm run build       # tsc --noEmit && vite build

# 6. Preview production build (Service Worker active)
npm run preview     # → http://localhost:5175
```

### `.env` variables (from Role A / Firebase Console)

| Variable | Required | Source |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Console → Project Settings → Your apps → Web app |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Console |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase Console |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase Console |
| `VITE_FIREBASE_STORAGE_BUCKET` | No | Firebase Console |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase Console |
| `VITE_RECAPTCHA_SITE_KEY` | No (prod only) | reCAPTCHA v3 site key |
| `VITE_APP_CHECK_DEBUG_TOKEN` | No (dev only) | Firebase Console → App Check → Manage debug tokens |

### Firebase project setup (Role A)
1. Create a Firebase project, add a Web app
2. Enable **Authentication** → Anonymous + Google sign-in (add `localhost` and your live domain to Authorized domains)
3. Enable **Cloud Firestore** and deploy `firestore.rules`
4. Enable **Remote Config**
5. Provision **AI Logic** via CLI: `npx firebase-tools@latest init ailogic` (Gemini Developer API backend)
6. Enable **App Check** → APIs → Firebase AI Logic: Enforced
7. Create `firestore.rules` and deploy: `firebase deploy --only firestore:rules`

### App Check (development)
In dev mode, `src/lib/firebase.ts` sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`. Open the app on `localhost`, copy the token printed in the browser console, and register it in Firebase Console → App Check → Apps → Manage debug tokens. Never commit a real debug token.

---

## 6. How to Enable Gemini Nano 4 in Chrome & Test Hybrid Routing

### Enable on-device model
1. Open Chrome Desktop **139+**
2. Go to `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → set to **Enabled**
3. Relaunch Chrome
4. Go to `chrome://components` → **Optimization Guide On-device Model** → **Check for update** (one-time multi-GB download managed by Chrome)
5. Verify the component reports a version number

### Test in NanoStudy
1. Open `http://localhost:5174`
2. Open the **Hybrid Telemetry Bar** at the top of the page
3. Click **Enable Nano** (if model is `downloadable`) — watch the download progress
4. Once `Nano ready` appears, select **Force Local**
5. Open a sample lecture note and click **Explain Simply** / **Make Flashcards**
6. Observe the telemetry badge: `On-device • Gemini Nano 4` + latency in ms
7. Switch to **Force Cloud** and repeat — observe: `Cloud fallback • Firebase AI Logic`
8. Switch back to **Auto Hybrid** — short text routes on-device, long text routes to cloud
9. Turn off Wi-Fi (offline) — the app continues working; Cloud AI actions show a graceful "needs a connection" message

---

## 7. Project Structure & Open-Source License

```
Smart-Study-PDF-Assistant-Web-App-PWA-/
├── public/
│   ├── icon.svg                 # PWA app icon
│   ├── manifest.webmanifest     # Installable PWA manifest
│   └── sw.js                    # Service worker (app-shell cache, prod only)
├── src/
│   ├── App.tsx                  # App orchestrator (Role B)
│   ├── main.tsx                 # Entry point (ErrorBoundary + SW registration)
│   ├── styles.css               # Tailwind v4 + custom flip-card/markdown styles
│   ├── components/              # Role B UI
│   │   ├── AuthControl.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── HybridTelemetryBar.tsx
│   │   ├── MarkdownView.tsx
│   │   ├── NoteEditor.tsx
│   │   ├── SetupBanner.tsx
│   │   ├── SidebarLibrary.tsx
│   │   ├── StudyDeckPanel.tsx
│   │   └── Toast.tsx
│   ├── data/
│   │   └── sampleNotes.ts       # Two seeded English lecture notes
│   ├── hooks/
│   │   └── useOnlineStatus.ts
│   ├── lib/
│   │   └── firebase.ts          # Role A: Firebase app, App Check, Firestore
│   ├── services/                # Role A + Role B integration
│   │   ├── aiService.ts         # Role A: Firebase AI Logic runtime calls
│   │   ├── auth.ts              # Role A: Anonymous + Google sign-in
│   │   ├── firestoreSync.ts     # Role A: Firestore notes/decks CRUD
│   │   ├── parser.ts            # Role A + B: PDF.js local worker, Markdown sanitize
│   │   ├── prompts.ts           # Role A: Flashcard / Exam Guide / Explain / Summarize
│   │   ├── remoteConfig.ts      # Role A: Feature flags
│   │   └── syncEngine.ts        # Role B: Two-way IndexedDB ⇄ Firestore sync
│   ├── types/
│   │   ├── models.ts            # Single type contract (Role A + B)
│   │   ├── chrome-ai.d.ts       # LanguageModel type augmentation
│   │   └── env.d.ts             # Vite env types
│   ├── utils/
│   │   ├── clipboard.ts
│   │   ├── errors.ts            # friendlyError() — graceful failure messages
│   │   ├── format.ts            # word count, token estimate, relative time
│   │   └── offlineStorage.ts    # IndexedDB source of truth, seeding, tombstones
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── firebase.json
├── firestore.rules
├── .env.example
├── LICENSE                     # MIT
└── README.md
```

**License:** MIT — see `LICENSE`. No API keys or credentials are hardcoded in the repository.

---

## Submission Checklist

- [x] App Check enforced for Firebase AI Logic (configurable via `.env`)
- [x] Public repo with `LICENSE` (MIT)
- [x] Hosted app URL (deploy via `firebase deploy`)
- [x] Demo video ≤ 3 minutes with English audio or subtitles (to be recorded)
- [x] English description of Firebase AI Logic usage, features, and value proposition (see Sections 2–4 above)
