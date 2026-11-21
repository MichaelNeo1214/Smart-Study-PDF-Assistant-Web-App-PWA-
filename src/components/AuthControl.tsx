import type { User } from "firebase/auth";
import { CloudOff, Loader2, LogOut, UserRound } from "lucide-react";
import { initials } from "../utils/format";

interface AuthControlProps {
  user: User | null;
  firebaseConfigured: boolean;
  busy: "guest" | "google" | null;
  onGuest: () => void;
  onGoogle: () => void;
  onSignOut: () => void;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.29V6.62H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AuthControl({
  user,
  firebaseConfigured,
  busy,
  onGuest,
  onGoogle,
  onSignOut,
}: AuthControlProps) {
  if (user) {
    const name = user.displayName ?? user.email ?? "Guest";
    return (
      <div className="flex items-center gap-2">
        <div className="hidden text-right sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {user.isAnonymous ? "Guest session" : "Google account"}
          </p>
          <p className="max-w-[170px] truncate text-xs font-semibold text-slate-700">{name}</p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-600 text-xs font-bold text-white shadow-sm"
          aria-hidden="true"
        >
          {initials(name)}
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const disabled = !firebaseConfigured || busy !== null;
  const disabledReason = !firebaseConfigured
    ? "Add Firebase environment variables to enable cloud sign-in. The local workspace works without an account."
    : undefined;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!firebaseConfigured && (
        <span className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 sm:inline-flex">
          <CloudOff className="h-3 w-3" aria-hidden="true" />
          Local workspace
        </span>
      )}

      <button
        type="button"
        onClick={onGuest}
        disabled={disabled}
        title={disabledReason}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === "guest" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Continue as Guest
      </button>

      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled}
        title={disabledReason}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === "google" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleMark />
        )}
        Google
      </button>
    </div>
  );
}
