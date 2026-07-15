"use client";

import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb", padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: "24rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1a1a2e", marginBottom: "0.5rem" }}>
              Application error
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", marginBottom: "1.5rem" }}>
              A critical error occurred. Please try reloading the page.
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.6875rem", fontFamily: "monospace", color: "#9ca3af", marginBottom: "1rem" }}>
                Reference: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ borderRadius: "0.75rem", backgroundColor: "#1a1a2e", color: "white", padding: "0.625rem 1rem", fontSize: "0.8125rem", fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
