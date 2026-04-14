import { createContext, useContext, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "healthsync_selected_barangay";

interface BarangayContextValue {
  selectedBarangay: string | null;
  setSelectedBarangay: (b: string) => void;
  scopedPath: (basePath: string, extraParams?: Record<string, string>) => string;
}

const BarangayContext = createContext<BarangayContextValue>({
  selectedBarangay: null,
  setSelectedBarangay: () => {},
  scopedPath: (p) => p,
});

export function BarangayProvider({ children }: { children: React.ReactNode }) {
  const { isTL, assignedBarangays } = useAuth();

  // Persisted in sessionStorage so a TL's selection survives navigation within
  // the same tab session. The stored value is validated against assigned list on
  // every render; invalid / missing values fall back to the first assigned barangay.
  const [preferredBarangay, setPreferredBarangay] = useState<string | null>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  // Compute effective barangay synchronously during render — no useEffect needed.
  // If auth data is already cached (normal case for logged-in users), this resolves
  // on the very first render, preventing any unscoped API call.
  const effectiveBarangay: string | null = (() => {
    if (!isTL || assignedBarangays.length === 0) return null;
    if (preferredBarangay && assignedBarangays.includes(preferredBarangay)) {
      return preferredBarangay;
    }
    return assignedBarangays[0];
  })();

  const setSelectedBarangay = (b: string) => {
    try { sessionStorage.setItem(STORAGE_KEY, b); } catch {}
    setPreferredBarangay(b);
  };

  // Returns a URL with ?barangay= param appended for TL users with a resolved barangay.
  // When effectiveBarangay is null (non-TL or auth not yet loaded), returns base path.
  const scopedPath = (basePath: string, extraParams?: Record<string, string>): string => {
    const params = new URLSearchParams(extraParams);
    if (effectiveBarangay) params.set("barangay", effectiveBarangay);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <BarangayContext.Provider value={{ selectedBarangay: effectiveBarangay, setSelectedBarangay, scopedPath }}>
      {children}
    </BarangayContext.Provider>
  );
}

export function useBarangay() {
  return useContext(BarangayContext);
}
