import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ThemeSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface ThemeContextType {
  settings: ThemeSettings | undefined;
  isLoading: boolean;
  updateSettings: (updates: Partial<ThemeSettings>) => void;
  isPending: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const colorSchemePresets: Record<string, { hue: number; saturation: number; lightness: number; name: string }> = {
  "healthsync": { hue: 172, saturation: 53, lightness: 49, name: "HealthSync (Teal · Blue)" },
  "placer-brand": { hue: 142, saturation: 60, lightness: 38, name: "Placer Brand (Green · Gold · Blue)" },
  "healthcare-green": { hue: 152, saturation: 60, lightness: 40, name: "Healthcare Green" },
  "government-blue": { hue: 210, saturation: 65, lightness: 45, name: "Government Blue" },
  "community-red": { hue: 0, saturation: 70, lightness: 50, name: "Community Red" },
  "ocean-teal": { hue: 180, saturation: 55, lightness: 40, name: "Ocean Teal" },
  "royal-purple": { hue: 270, saturation: 50, lightness: 45, name: "Royal Purple" },
  "sunset-orange": { hue: 25, saturation: 85, lightness: 50, name: "Sunset Orange" },
  "forest-green": { hue: 135, saturation: 45, lightness: 35, name: "Forest Green" },
  "custom": { hue: 152, saturation: 60, lightness: 40, name: "Custom" },
};

export { colorSchemePresets };

// Placer Municipality's brand is a tri-color of Green + Gold + Blue. The
// single-hue pipeline takes Green as primary; we inject Gold into the accent
// slot and Blue into the chart-2 slot so the trio shows up across cards,
// focus rings, and dashboard charts.
const PLACER_BRAND_OVERRIDES = {
  goldHsl: "45 92% 50%",
  goldFgHsl: "40 90% 15%",
  blueHsl: "210 75% 45%",
} as const;

function applyPlacerBrandOverrides() {
  const root = document.documentElement;
  root.style.setProperty('--accent', PLACER_BRAND_OVERRIDES.goldHsl);
  root.style.setProperty('--accent-foreground', PLACER_BRAND_OVERRIDES.goldFgHsl);
  root.style.setProperty('--secondary', PLACER_BRAND_OVERRIDES.goldHsl);
  root.style.setProperty('--secondary-foreground', PLACER_BRAND_OVERRIDES.goldFgHsl);
  root.style.setProperty('--chart-2', PLACER_BRAND_OVERRIDES.blueHsl);
}

// HealthSync brand: teal primary (#3CBFAE) + blue secondary (#2B6CB0).
// Single-hue pipeline takes teal as primary; we inject blue as the accent
// + secondary slot and chart-2 so the gradient pair surfaces across the
// app. Light tints (#6EE7D8, #63B3ED) are used for soft chips. Semantic
// success/warning/error/info match the spec.
const HEALTHSYNC_BRAND_OVERRIDES = {
  blueHsl: "211 61% 43%",        // #2B6CB0
  blueFgHsl: "0 0% 100%",
  softBlueHsl: "210 79% 66%",    // #63B3ED
  successHsl: "139 49% 43%",     // #38A169
  warningHsl: "39 67% 51%",      // #D69E2E
  errorHsl: "0 75% 57%",         // #E53E3E
  infoHsl: "210 67% 51%",        // #3182CE
} as const;

function applyHealthSyncBrandOverrides() {
  const root = document.documentElement;
  root.style.setProperty('--accent', HEALTHSYNC_BRAND_OVERRIDES.blueHsl);
  root.style.setProperty('--accent-foreground', HEALTHSYNC_BRAND_OVERRIDES.blueFgHsl);
  root.style.setProperty('--secondary', HEALTHSYNC_BRAND_OVERRIDES.blueHsl);
  root.style.setProperty('--secondary-foreground', HEALTHSYNC_BRAND_OVERRIDES.blueFgHsl);
  root.style.setProperty('--chart-2', HEALTHSYNC_BRAND_OVERRIDES.blueHsl);
  root.style.setProperty('--chart-3', HEALTHSYNC_BRAND_OVERRIDES.softBlueHsl);
  // Status-color slots used by .status-* utility classes.
  root.style.setProperty('--status-available', HEALTHSYNC_BRAND_OVERRIDES.successHsl);
  root.style.setProperty('--status-completed', HEALTHSYNC_BRAND_OVERRIDES.successHsl);
  root.style.setProperty('--status-due-soon', HEALTHSYNC_BRAND_OVERRIDES.warningHsl);
  root.style.setProperty('--status-overdue', HEALTHSYNC_BRAND_OVERRIDES.errorHsl);
  root.style.setProperty('--destructive', HEALTHSYNC_BRAND_OVERRIDES.errorHsl);
}

function applyThemeColors(hue: number, saturation: number, lightness: number) {
  const root = document.documentElement;
  const bgHue = hue;
  const bgSat = Math.max(20, saturation - 40);
  
  root.style.setProperty('--primary', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--ring', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--chart-1', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--sidebar-primary', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--sidebar-ring', `${hue} ${saturation}% ${lightness}%`);
  
  root.style.setProperty('--background', `${bgHue} ${bgSat}% 98%`);
  root.style.setProperty('--foreground', `${bgHue + 10} ${Math.min(saturation, 40)}% 10%`);
  root.style.setProperty('--border', `${bgHue + 5} ${Math.max(15, saturation - 40)}% 88%`);
  root.style.setProperty('--sidebar', `${bgHue + 5} ${Math.max(25, saturation - 25)}% 95%`);
  root.style.setProperty('--sidebar-foreground', `${bgHue + 10} ${Math.min(saturation, 40)}% 15%`);
  root.style.setProperty('--sidebar-border', `${bgHue + 5} ${Math.max(20, saturation - 35)}% 88%`);
  root.style.setProperty('--sidebar-accent', `${bgHue + 5} ${Math.max(20, saturation - 40)}% 90%`);
  root.style.setProperty('--sidebar-accent-foreground', `${bgHue + 10} ${Math.min(saturation, 40)}% 15%`);
  root.style.setProperty('--secondary', `${bgHue + 5} ${Math.max(20, saturation - 40)}% 92%`);
  root.style.setProperty('--secondary-foreground', `${bgHue + 10} ${Math.min(saturation, 40)}% 15%`);
  root.style.setProperty('--muted', `${bgHue + 5} ${Math.max(15, saturation - 40)}% 94%`);
  root.style.setProperty('--muted-foreground', `${bgHue + 10} 15% 45%`);
  root.style.setProperty('--accent', `${bgHue + 5} ${Math.max(20, saturation - 40)}% 90%`);
  root.style.setProperty('--accent-foreground', `${bgHue + 10} ${Math.min(saturation, 40)}% 15%`);
  root.style.setProperty('--input', `${bgHue + 5} ${Math.max(15, saturation - 40)}% 92%`);
  
  const darkLightness = Math.min(65, lightness + 15);
  root.style.setProperty('--primary-dark', `${hue} ${Math.min(70, saturation + 5)}% ${darkLightness}%`);
  root.style.setProperty('--background-dark', `${bgHue} ${Math.max(10, bgSat - 10)}% 8%`);
  root.style.setProperty('--foreground-dark', `${bgHue} ${Math.max(5, bgSat - 15)}% 95%`);
  root.style.setProperty('--border-dark', `${bgHue + 5} ${Math.max(10, saturation - 45)}% 18%`);
  root.style.setProperty('--sidebar-dark', `${bgHue + 5} ${Math.max(15, saturation - 35)}% 12%`);
  root.style.setProperty('--sidebar-foreground-dark', `${bgHue} ${Math.max(5, saturation - 45)}% 90%`);
  root.style.setProperty('--sidebar-border-dark', `${bgHue + 5} ${Math.max(10, saturation - 45)}% 18%`);
  root.style.setProperty('--sidebar-accent-dark', `${bgHue + 5} ${Math.max(15, saturation - 40)}% 18%`);
  root.style.setProperty('--secondary-dark', `${bgHue + 5} ${Math.max(15, saturation - 40)}% 15%`);
  root.style.setProperty('--secondary-foreground-dark', `${bgHue} ${Math.max(5, saturation - 45)}% 90%`);
  root.style.setProperty('--muted-dark', `${bgHue + 5} ${Math.max(10, saturation - 45)}% 18%`);
  root.style.setProperty('--muted-foreground-dark', `${bgHue + 10} 10% 60%`);
  root.style.setProperty('--accent-dark', `${bgHue + 5} ${Math.max(15, saturation - 40)}% 18%`);
  root.style.setProperty('--accent-foreground-dark', `${bgHue} ${Math.max(5, saturation - 45)}% 90%`);
  root.style.setProperty('--input-dark', `${bgHue + 5} ${Math.max(10, saturation - 45)}% 15%`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<ThemeSettings>({
    queryKey: ['/api/theme-settings'],
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<ThemeSettings>) => {
      const response = await apiRequest('PUT', '/api/theme-settings', updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/theme-settings'] });
    },
  });

  useEffect(() => {
    if (settings) {
      const hue = settings.primaryHue ?? 172;
      const saturation = settings.primarySaturation ?? 53;
      const lightness = settings.primaryLightness ?? 49;
      applyThemeColors(hue, saturation, lightness);
      if (settings.colorScheme === "placer-brand") {
        applyPlacerBrandOverrides();
      } else if (settings.colorScheme === "healthsync") {
        applyHealthSyncBrandOverrides();
      }
    }
  }, [settings]);

  const updateSettings = (updates: Partial<ThemeSettings>) => {
    mutation.mutate(updates);
  };

  return (
    <ThemeContext.Provider value={{ settings, isLoading, updateSettings, isPending: mutation.isPending }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
