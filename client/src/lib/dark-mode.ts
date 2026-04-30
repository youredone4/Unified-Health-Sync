// Dark-mode controller. Reads a saved preference from localStorage, falls
// back to the OS-level prefers-color-scheme query, and exposes a toggle.
// The actual styling is driven by Tailwind's `dark:` variants + the .dark
// CSS block already defined in index.css — this file just toggles the
// class on <html>.

const STORAGE_KEY = "healthsync.dark-mode";

export type DarkModePref = "light" | "dark" | "system";

export function getStoredDarkMode(): DarkModePref {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function isSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function effectiveDarkMode(pref: DarkModePref = getStoredDarkMode()): boolean {
  return pref === "dark" || (pref === "system" && isSystemDark());
}

export function applyDarkMode(pref: DarkModePref): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (effectiveDarkMode(pref)) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function setDarkMode(pref: DarkModePref): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, pref);
  }
  applyDarkMode(pref);
}

export function initDarkMode(): void {
  applyDarkMode(getStoredDarkMode());
  // Live-track OS-level preference changes when user has opted into "system".
  if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", () => {
      if (getStoredDarkMode() === "system") applyDarkMode("system");
    });
  }
}
