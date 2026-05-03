import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "healthsync_glossary_inline";

/**
 * Per-user preference for the glossary <Term> component.
 *
 * Inline mode renders "MAM (Moderate Acute Malnutrition)" for every term.
 * Off mode renders "MAM" + a ? icon that opens a popup tip on click.
 *
 * Defaults:
 *   - Viewer roles (MAYOR, HEALTH_COMMITTEE) → ON. Discovery without
 *     hunting for the ? icon.
 *   - Power roles (Admin, MHO, SHA, TL) → OFF. Keep dense worklists
 *     scannable.
 *
 * Any user can flip in Account → Display. Stored in localStorage so the
 * preference survives across sessions on the same device.
 */
export function useGlossaryPreference() {
  const { isViewOnly, isLoading } = useAuth();

  const [override, setOverride] = useState<"on" | "off" | null>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === "on" || v === "off" ? v : null;
    } catch {
      return null;
    }
  });

  // Default depends on role; user override wins when set.
  const inlineMode = override === "on" || (override === null && isViewOnly);

  const setPreference = (value: "on" | "off" | "default") => {
    if (value === "default") {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setOverride(null);
    } else {
      try { localStorage.setItem(STORAGE_KEY, value); } catch {}
      setOverride(value);
    }
  };

  return {
    inlineMode,
    /** Whether the user has explicitly chosen, vs falling back to role default. */
    isExplicit: override !== null,
    /** Effective default for this role if no override is set. */
    roleDefault: isViewOnly ? "on" : "off" as "on" | "off",
    isLoading,
    setPreference,
  };
}
