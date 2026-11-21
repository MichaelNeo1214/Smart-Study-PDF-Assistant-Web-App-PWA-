import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Last line of defence against a white screen. The recovery UI is intentionally
 * dependency-light so it still renders if a feature module crashes.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[NanoStudy] Unhandled render error:", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearLocalData = async (): Promise<void> => {
    const confirmed = window.confirm(
      "This deletes all notes and study decks stored on this device. Continue?"
    );
    if (!confirmed) return;

    try {
      const { clearAllLocalData } = await import("../utils/offlineStorage");
      await clearAllLocalData();
    } catch (error) {
      console.error("[NanoStudy] Could not clear local data:", error);
    } finally {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message ?? "An unexpected error occurred.";

    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10 text-slate-900">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">NanoStudy recovery mode</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Something unexpected happened</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your notes are stored locally in IndexedDB and should still be on this device. Try again first,
            then reload the app. Clearing local data is a last resort.
          </p>

          <pre className="mt-4 max-h-32 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {message}
          </pre>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Reload app
            </button>
            <button
              type="button"
              onClick={() => void this.handleClearLocalData()}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              Clear local data
            </button>
          </div>
        </section>
      </main>
    );
  }
}
