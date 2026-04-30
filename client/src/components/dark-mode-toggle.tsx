import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import {
  type DarkModePref,
  effectiveDarkMode,
  getStoredDarkMode,
  setDarkMode,
} from "@/lib/dark-mode";

const LABEL: Record<DarkModePref, string> = {
  light:  "Light",
  dark:   "Dark",
  system: "System",
};

export function DarkModeToggle() {
  const [pref, setPref] = useState<DarkModePref>(() => getStoredDarkMode());
  const [isDark, setIsDark] = useState<boolean>(() => effectiveDarkMode(getStoredDarkMode()));

  useEffect(() => {
    setIsDark(effectiveDarkMode(pref));
  }, [pref]);

  const choose = (next: DarkModePref) => {
    setDarkMode(next);
    setPref(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Theme" data-testid="dark-mode-toggle" aria-label={`Theme: ${LABEL[pref]}`}>
          {isDark ? <Moon className="w-4 h-4" aria-hidden /> : <Sun className="w-4 h-4" aria-hidden />}
          <span>Theme</span>
          <span className="ml-auto text-xs text-muted-foreground">{LABEL[pref]}</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end">
        <DropdownMenuItem onClick={() => choose("light")} data-testid="theme-light">
          <Sun className="w-4 h-4 mr-2" aria-hidden /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose("dark")} data-testid="theme-dark">
          <Moon className="w-4 h-4 mr-2" aria-hidden /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose("system")} data-testid="theme-system">
          <Monitor className="w-4 h-4 mr-2" aria-hidden /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
