import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// The service worker is production-only so Vite HMR and local development are
// never intercepted. It caches the app shell and hashed build assets.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch((error) => console.warn("[PWA] Service worker registration failed:", error));
  });
}
