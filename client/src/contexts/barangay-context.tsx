import { createContext, useContext, useState, useEffect } from "react";
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

  // Initialize synchronously from sessionStorage to avoid unscoped first render
  const [selectedBarangay, setSelectedBarangayState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Validate stored value against assignedBarangays when auth loads
  useEffect(() => {
    if (!isTL || assignedBarangays.length === 0) {
      setSelectedBarangayState(null);
      return;
    }
    setSelectedBarangayState(prev => {
      if (prev && assignedBarangays.includes(prev)) return prev;
      const fallback = assignedBarangays[0];
      try { sessionStorage.setItem(STORAGE_KEY, fallback); } catch {}
      return fallback;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTL, assignedBarangays.join(",")]);

  const setSelectedBarangay = (b: string) => {
    try { sessionStorage.setItem(STORAGE_KEY, b); } catch {}
    setSelectedBarangayState(b);
  };

  const effectiveBarangay = isTL ? selectedBarangay : null;

  // Returns a URL with ?barangay= param appended for TL users
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
