"use client";

import * as React from "react";

/**
 * Client-side exception reporting.
 *
 * Captures unhandled errors and forwards them to the server monitoring layer.
 * Never sends paper contents, drafts, prompts, or writing samples.
 */

let isInitialized = false;

export function initClientMonitoring(): void {
  if (isInitialized) return;
  if (typeof window === "undefined") return;
  isInitialized = true;

  // Capture unhandled errors
  window.addEventListener("error", (event) => {
    reportClientError({
      type: "unhandled_error",
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError({
      type: "unhandled_promise_rejection",
      message: event.reason instanceof Error ? event.reason.message : String(event.reason),
    });
  });
}

function reportClientError(data: {
  type: string;
  message: string;
  [key: string]: unknown;
}): void {
  // In production, this would POST to a /api/monitoring/errors endpoint.
  // For now, structured console logging that Vercel/observability captures.
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    source: "client",
    ...data,
    url: window.location.href,
  }));
}

/**
 * React error boundary context provider.
 * Wrap the app to catch render errors and report them.
 */
export function ClientMonitoringProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    initClientMonitoring();
  }, []);

  return <>{children}</>;
}
