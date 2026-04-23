"use client";

/**
 * Last-resort error boundary. Fires when the root layout itself throws
 * — at that point no provider, no navbar, no font is safe to use, so
 * we render the fallback inline with no dependencies on the layout
 * chain. Must declare its own `<html>` and `<body>`.
 *
 * This file should be boring — any fancy component it imports is a
 * liability if the error came from one of those components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#050508",
          color: "#fff",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            borderRadius: 16,
            border: "1px solid rgba(245, 158, 11, 0.2)",
            background: "rgba(255,255,255,0.03)",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#fcd34d",
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
              margin: "0 0 12px",
            }}
          >
            Omni AI
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
            The site crashed.
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
            Something in the layout failed. Refresh to retry. If it keeps
            happening, email alfred@omnileadsagi.com with this code:{" "}
            <code
              style={{
                display: "inline-block",
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                color: "#fcd34d",
                fontSize: 12,
              }}
            >
              {error.digest || "no-digest"}
            </code>
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              height: 40,
              padding: "0 20px",
              borderRadius: 12,
              border: "2px solid #ffd700",
              background: "rgba(10,10,10,0.55)",
              color: "#ffd700",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
