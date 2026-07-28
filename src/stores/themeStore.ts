import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  initTheme: () => void;
}

function applyTheme(mode: ThemeMode) {
  let effectiveTheme: "light" | "dark" = "dark";

  if (mode === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    effectiveTheme = isDark ? "dark" : "light";
  } else {
    effectiveTheme = mode;
  }

  document.documentElement.setAttribute("data-theme", effectiveTheme);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: (localStorage.getItem("asm_theme_mode") as ThemeMode) || "system",
  setThemeMode: (mode: ThemeMode) => {
    localStorage.setItem("asm_theme_mode", mode);
    set({ themeMode: mode });
    applyTheme(mode);
  },
  initTheme: () => {
    const mode = get().themeMode;
    applyTheme(mode);

    // Listen for system theme changes when mode is "system"
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (get().themeMode === "system") {
        applyTheme("system");
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
