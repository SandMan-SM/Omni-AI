// Hook for syncing a sub-page's selected business with the global
// business switcher on /assets. The switcher writes localStorage key
// 'omni_active_business_id' (or 'all'); every embedded sub-page
// (Leads / Pipeline / Meetings / Outreach / Inbox / Companies) reads
// it on mount and listens for changes via the storage event.

"use client";

import { useEffect } from "react";

export const ACTIVE_BIZ_KEY = "omni_active_business_id";

/** Read the current active business id from localStorage, or null for "all". */
export function readActiveBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(ACTIVE_BIZ_KEY);
  if (!v || v === "all") return null;
  return v;
}

/**
 * Subscribes to changes on the active business localStorage key. Calls
 * `onChange(newId | null)` whenever the /assets switcher fires. Returns
 * a cleanup fn.
 */
export function useActiveBusinessSync(onChange: (id: string | null) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handler(ev: StorageEvent) {
      if (ev.key !== ACTIVE_BIZ_KEY) return;
      const v = ev.newValue;
      onChange(!v || v === "all" ? null : v);
    }
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [onChange]);
}
