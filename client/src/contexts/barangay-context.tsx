import { createContext, useContext, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

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

  // In-memory only — intentionally not persisted. A full page refresh or new login
  // resets to the first assigned barangay, matching the acceptance criteria.
  const [preferredBarangay, setPreferredBarangay] = useState<string | null>(null);

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
    setPreferredBarangay(b);
  };

  // Returns a URL with ?barangay= param appended for TL users with a resolved barangay.
  // When effectiveBarangay is null (non-TL), returns base path unchanged.
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
