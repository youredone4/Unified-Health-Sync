import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Per-user mark-as-read state for DOH updates.
 *
 * Stored in localStorage keyed on the authenticated user id, so the same
 * device can host multiple users without cross-pollution. Falls back to
 * an unscoped key for the brief window before useAuth resolves so the
 * UI never crashes; that key gets ignored once the user id is known.
 *
 * Server-side persistence would be nicer (especially for users on
 * multiple devices) but localStorage is good enough for the common case
 * of a TL on one personal phone. Upgrade is a follow-up if needed.
 */
export function useReadUpdates() {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const storageKey = `healthsync_doh_read_${userId}`;

  const [readIds, setReadIds] = useState<Set<number>>(() => loadFromStorage(storageKey));

  // Re-load whenever the active user changes (login / logout / switch).
  useEffect(() => {
    setReadIds(loadFromStorage(storageKey));
  }, [storageKey]);

  const isRead = useCallback((id: number) => readIds.has(id), [readIds]);

  const markRead = useCallback((id: number) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveToStorage(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const markAllRead = useCallback((ids: number[]) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) { next.add(id); changed = true; }
      }
      if (!changed) return prev;
      saveToStorage(storageKey, next);
      return next;
    });
  }, [storageKey]);

  /** Count of unread items from a given list. */
  const unreadCount = useCallback(
    (allIds: number[]) => allIds.filter((id) => !readIds.has(id)).length,
    [readIds],
  );

  return { isRead, markRead, markAllRead, unreadCount };
}

function loadFromStorage(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n: unknown): n is number => typeof n === "number"));
  } catch {
    return new Set();
  }
}

function saveToStorage(key: string, ids: Set<number>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage full or disabled — silent no-op; state still works in-memory.
  }
}
