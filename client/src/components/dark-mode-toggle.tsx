import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import {
  type DarkModePref,
  effectiveDarkMode,
  getStoredDarkMode,
  setDarkMode,
} from "@/lib/dark-mode";

const ORDER: DarkModePref[] = ["light", "dark", "system"];
const LABEL: Record<DarkModePref, string> = {
  light:  "Light",
  dark:   "Dark",
  system: "System",
};
const ICON: Record<DarkModePref, React.ElementType> = {
  light:  Sun,
  dark:   Moon,
  system: Monitor,
};

/**
 * Sidebar footer toggle. Clicks cycle Light → Dark → System → Light…
 * No dropdown — keeps the trigger reliable inside the sidebar layout
 * and avoids the Radix asChild + SidebarMenuButton interaction that
 * was swallowing the click in the previous impl.
 */
export function DarkModeToggle() {
  const [pref, setPref] = useState<DarkModePref>(() => getStoredDarkMode());

  // Re-read on mount so the icon matches whatever initDarkMode applied.
  useEffect(() => { setPref(getStoredDarkMode()); }, []);

  const cycle = () => {
    const idx = ORDER.indexOf(pref);
    const next = ORDER[(idx + 1) % ORDER.length];
    setDarkMode(next);
    setPref(next);
  };

  const Icon = ICON[pref];
  const isDark = effectiveDarkMode(pref);

  return (
    <SidebarMenuButton
      onClick={cycle}
      tooltip={`Theme: ${LABEL[pref]} (click to cycle)`}
      aria-label={`Theme: ${LABEL[pref]}. Click to switch.`}
      data-testid="dark-mode-toggle"
    >
      <Icon className={`w-4 h-4 ${isDark ? "text-amber-400" : ""}`} aria-hidden />
      <span>Theme</span>
      <span className="ml-auto text-xs text-muted-foreground">{LABEL[pref]}</span>
    </SidebarMenuButton>
  );
}
