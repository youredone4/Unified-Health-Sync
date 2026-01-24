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

function applyThemeColors(hue: number, saturation: number, lightness: number) {
  const root = document.documentElement;
  
  root.style.setProperty('--primary', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--ring', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--chart-1', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--sidebar-primary', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--sidebar-ring', `${hue} ${saturation}% ${lightness}%`);
  
  const bgHue = hue;
  const bgSat = Math.max(20, saturation - 40);
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
  
  const darkLightness = Math.max(35, lightness + 5);
  root.style.setProperty('--primary-dark', `${hue} ${Math.min(70, saturation + 5)}% ${darkLightness}%`);
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
      const hue = settings.primaryHue ?? 152;
      const saturation = settings.primarySaturation ?? 60;
      const lightness = settings.primaryLightness ?? 40;
      applyThemeColors(hue, saturation, lightness);
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
