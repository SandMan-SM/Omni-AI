"use client";

import { useEffect } from "react";

type BrowserErrorInput = {
  source: string;
  name?: string;
  message?: string;
  stack?: string;
  digest?: string;
  details?: Record<string, unknown>;
};

const recentErrors = new Map<string, number>();

function compactRecentErrors(now = Date.now()) {
  for (const [key, ts] of Array.from(recentErrors.entries())) {
    if (now - ts > 60_000) recentErrors.delete(key);
  }
}

function sendError(body: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    action: "runtime_error",
    category: "website",
    severity: "error",
    path: window.location.href,
    ts: new Date().toISOString(),
    ...body,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/admin/log-error", blob)) return;
  }

  void fetch("/api/admin/log-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function reportBrowserError(input: BrowserErrorInput) {
  const message = input.message || "Unknown browser error";
  const key = `${input.source}:${message}:${input.digest || ""}`;
  const now = Date.now();
  compactRecentErrors(now);
  if ((recentErrors.get(key) ?? 0) > now - 10_000) return;
  recentErrors.set(key, now);

  sendError({
    source: input.source,
    name: input.name,
    message,
    stack: input.stack,
    digest: input.digest,
    details: input.details,
  });
}

export function ErrorTelemetry() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportBrowserError({
        source: "window-error",
        name: event.error?.name || "Error",
        message: event.message,
        stack: event.error?.stack,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportBrowserError({
        source: "unhandled-rejection",
        name: reason?.name || "UnhandledRejection",
        message: reason?.message || String(reason || "Unhandled promise rejection"),
        stack: reason?.stack,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
