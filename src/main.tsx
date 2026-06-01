import "./instrument";

import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Force reload on module fetch failure (e.g. after a deployment with new hashes)
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.name === "ChunkLoadError" ||
    event.reason?.message?.includes("Failed to fetch dynamically imported module") ||
    event.reason?.message?.includes("Importing a module script failed")
  ) {
    console.warn("Module loading error detected, forcing reload...", event.reason);
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong</p>} showDialog>
    <App />
  </Sentry.ErrorBoundary>,
);
