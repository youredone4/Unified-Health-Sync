import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "healthsync_selected_barangay";

interface BarangayContextValue {
  selectedBarangay: string | null;
  setSelectedBarangay: (b: string) => void;
}

const BarangayContext = createContext<BarangayContextValue>({
  selectedBarangay: null,
  setSelectedBarangay: () => {},
});

export function BarangayProvider({ children }: { children: React.ReactNode }) {
  const { isTL, assignedBarangays } = useAuth();

  const [selectedBarangay, setSelectedBarangayState] = useState<string | null>(null);

  // Sync with auth state: when TL's assigned barangays are known, set default
  useEffect(() => {
    if (!isTL || assignedBarangays.length === 0) {
      setSelectedBarangayState(null);
      return;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const valid = stored && assignedBarangays.includes(stored) ? stored : assignedBarangays[0];
    setSelectedBarangayState(valid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTL, assignedBarangays.join(",")]);

  const setSelectedBarangay = (b: string) => {
    sessionStorage.setItem(STORAGE_KEY, b);
    setSelectedBarangayState(b);
  };

  return (
    <BarangayContext.Provider value={{ selectedBarangay: isTL ? selectedBarangay : null, setSelectedBarangay }}>
      {children}
    </BarangayContext.Provider>
  );
}

export function useBarangay() {
  return useContext(BarangayContext);
}
