import * as Sentry from "@sentry/react";
import {
  reactRouterV6BrowserTracingIntegration,
} from "@sentry/react";
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from "react-router-dom";
import { useEffect } from "react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
  sendDefaultPii: true,
  ignoreErrors: [
    /Failed to fetch dynamically imported module/i,
  ],

  integrations: [
    Sentry.browserTracingIntegration(),
    reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserProfilingIntegration(),
  ],

  // Tracing
  tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/dockerdash\.app/],

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Logging
  enableLogs: true,

  // Debug in development
  debug: import.meta.env.DEV,
});
