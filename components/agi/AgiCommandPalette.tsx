"use client";

// Cmd-K command palette — fuzzy search across leads, businesses, meetings.
// Triggered by ⌘K / Ctrl+K from anywhere on the dashboard. Uses
// /api/agi/search/quick for results.

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth";
import { Search, Target, Building2, Calendar, X, Loader2 } from "lucide-react";

interface QuickResult {
  type: "lead" | "business" | "meeting";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  score: number;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  lead: Target,
  business: Building2,
  meeting: Calendar,
};

const TYPE_COLOR: Record<string, string> = {
  lead: "#818cf8",
  business: "#10b981",
  meeting: "#a78bfa",
};

export function AgiCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-focus input when opening
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        // authFetch forwards the omni_token bearer so the gated
        // search/quick endpoint accepts the call when cookies fail.
        const r = await authFetch(`/api/agi/search/quick?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        if (!r.ok) {
          setResults([]);
          return;
        }
        const d = await r.json().catch(() => ({}));
        setResults(Array.isArray(d?.results) ? d.results : []);
        setActiveIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const close = useCallback(() => { setOpen(false); setQuery(""); }, []);

  // Arrow key nav
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      window.location.href = results[activeIdx].href;
    }
  }

  if (!open) {
    // Floating "⌘K" hint badge in the corner
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 18, right: 18, zIndex: 40,
          background: "rgba(0,0,0,0.85)", border: "1px solid #2a2a2a",
          color: "#94a3b8",
          padding: "8px 14px", borderRadius: 10,
          fontSize: 12, fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 8,
          backdropFilter: "blur(8px)",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
        aria-label="Open quick search (⌘K)"
      >
        <Search size={13} />
        Search
        <kbd style={{
          background: "#1a1a1a", border: "1px solid #2a2a2a",
          padding: "1px 6px", borderRadius: 4, fontSize: 10, fontFamily: "ui-monospace, monospace",
          color: "#666",
        }}>⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "10vh 16px",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 600, maxWidth: "100%",
          background: "#0c0c0c", border: "1px solid #2a2a2a",
          borderRadius: 14, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid #1e1e1e" }}>
          <Search size={16} color="#666" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search leads, businesses, meetings…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#e8e8e8", fontSize: 16, fontFamily: "inherit",
            }}
          />
          {loading && <Loader2 size={14} className="animate-spin" color="#666" />}
          <kbd style={{
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            padding: "2px 8px", borderRadius: 4, fontSize: 10, color: "#666", fontFamily: "ui-monospace, monospace",
          }}>esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: "auto", padding: 6 }}>
          {query.trim() === "" ? (
            <div style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 13 }}>
              Type to search across all your data.<br />
              <span style={{ color: "#444", fontSize: 11 }}>↑↓ to navigate · ↵ to open · esc to close</span>
            </div>
          ) : !loading && results.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 13 }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((r, i) => {
              const Icon = TYPE_ICON[r.type] ?? Target;
              const color = TYPE_COLOR[r.type] ?? "#666";
              const active = i === activeIdx;
              return (
                <Link
                  key={`${r.type}-${r.id}`}
                  href={r.href}
                  onClick={close}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px",
                    background: active ? "#1a1a1a" : "transparent",
                    borderRadius: 8,
                    textDecoration: "none", color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${color}18`, border: `1px solid ${color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon size={14} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.title}
                    </div>
                    {r.subtitle && (
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.subtitle}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color, background: `${color}18`,
                    padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 0.6,
                    flexShrink: 0,
                  }}>{r.type}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
