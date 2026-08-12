import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type ThemeStyle = "graphite" | "aura" | "jade";

const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];
const THEME_STYLES: readonly ThemeStyle[] = ["graphite", "aura", "jade"];

interface ThemeState {
  themeMode: ThemeMode;
  themeStyle: ThemeStyle;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeStyle: (style: ThemeStyle) => void;
  initTheme: () => void;
}

function readSetting<T extends string>(key: string, allowedValues: readonly T[], fallback: T): T {
  const storedValue = localStorage.getItem(key) as T | null;
  return storedValue && allowedValues.includes(storedValue) ? storedValue : fallback;
}

function applyTheme(mode: ThemeMode, style: ThemeStyle) {
  let effectiveTheme: "light" | "dark" = "dark";

  if (mode === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    effectiveTheme = isDark ? "dark" : "light";
  } else {
    effectiveTheme = mode;
  }

  document.documentElement.setAttribute("data-theme", effectiveTheme);
  document.documentElement.setAttribute("data-theme-style", style);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: readSetting("asm_theme_mode", THEME_MODES, "system"),
  themeStyle: readSetting("asm_theme_style", THEME_STYLES, "graphite"),
  setThemeMode: (mode: ThemeMode) => {
    localStorage.setItem("asm_theme_mode", mode);
    set({ themeMode: mode });
    applyTheme(mode, get().themeStyle);
  },
  setThemeStyle: (style: ThemeStyle) => {
    localStorage.setItem("asm_theme_style", style);
    set({ themeStyle: style });
    applyTheme(get().themeMode, style);
  },
  initTheme: () => {
    const { themeMode, themeStyle } = get();
    applyTheme(themeMode, themeStyle);

    // Listen for system theme changes when mode is "system"
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (get().themeMode === "system") {
        applyTheme("system", get().themeStyle);
      }
    };

    try {
      mediaQuery.addEventListener("change", handleChange);
    } catch {
      // Fallback for older Safari/browsers
      mediaQuery.addListener(handleChange);
    }
  },
}));
