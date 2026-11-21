import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";

interface SetupBannerProps {
  missingKeys: string[];
}

export function SetupBanner({ missingKeys }: SetupBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <section
      aria-label="Firebase setup notice"
      className="shrink-0 border-b border-amber-200 bg-amber-50/90 px-4 py-2.5 text-amber-950 sm:px-6"
    >
      <div className="mx-auto flex max-w-[1800px] items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-5 sm:text-sm">
            <span className="font-semibold">Firebase is not configured — local workspace mode is active.</span>{" "}
            Notes, PDF import, IndexedDB, and Gemini Nano still work. Cloud sync, Google sign-in, and Cloud AI
            are paused until the variables below are added.
          </p>

          {expanded && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-white/70 p-3 text-xs text-amber-900">
              <p className="font-medium">Create .env.local from .env.example and fill in:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missingKeys.map((key) => (
                  <code key={key} className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px]">
                    {key}
                  </code>
                ))}
              </div>
              <p className="mt-2 leading-5">
                Restart <code className="font-mono">npm run dev</code> afterwards. In development, App Check
                uses a debug token printed in the browser console; register it under Firebase Console →
                App Check → Manage debug tokens.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 underline-offset-2 hover:underline"
          >
            {expanded ? "Hide setup steps" : "Show setup steps"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Dismiss Firebase setup notice"
          className="rounded-md p-1 text-amber-600 transition hover:bg-amber-100 hover:text-amber-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
