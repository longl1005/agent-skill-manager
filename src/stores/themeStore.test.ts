import { beforeEach, describe, expect, it, vi } from "vitest";

type MatchMediaHarness = {
  setDark: (matches: boolean) => void;
  emitChange: () => void;
};

function installMatchMedia(initiallyDark: boolean): MatchMediaHarness {
  let matches = initiallyDark;
  let changeListener: (() => void) | undefined;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addListener: (listener: () => void) => {
        changeListener = listener;
      },
      removeListener: () => {},
      addEventListener: (_event: string, listener: () => void) => {
        changeListener = listener;
      },
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  });

  return {
    setDark: (next) => {
      matches = next;
    },
    emitChange: () => changeListener?.(),
  };
}

async function loadThemeStore() {
  vi.resetModules();
  return import("./themeStore");
}

describe("themeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-style");
  });

  it("falls back to system Graphite when persisted values are invalid", async () => {
    localStorage.setItem("asm_theme_mode", "sepia");
    localStorage.setItem("asm_theme_style", "neon");
    installMatchMedia(false);

    const { useThemeStore } = await loadThemeStore();
    useThemeStore.getState().initTheme();

    expect(useThemeStore.getState().themeMode).toBe("system");
    expect(useThemeStore.getState().themeStyle).toBe("graphite");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement).toHaveAttribute("data-theme-style", "graphite");
  });

  it("switches to Aura without changing the selected color scheme", async () => {
    localStorage.setItem("asm_theme_mode", "dark");
    localStorage.setItem("asm_theme_style", "graphite");
    installMatchMedia(false);

    const { useThemeStore } = await loadThemeStore();
    useThemeStore.getState().setThemeStyle("aura");

    expect(useThemeStore.getState().themeMode).toBe("dark");
    expect(useThemeStore.getState().themeStyle).toBe("aura");
    expect(localStorage.getItem("asm_theme_style")).toBe("aura");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-theme-style", "aura");
  });

  it("preserves Jade when the operating system color scheme changes", async () => {
    localStorage.setItem("asm_theme_mode", "system");
    localStorage.setItem("asm_theme_style", "jade");
    const media = installMatchMedia(false);

    const { useThemeStore } = await loadThemeStore();
    useThemeStore.getState().initTheme();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    media.setDark(true);
    media.emitChange();

    expect(useThemeStore.getState().themeStyle).toBe("jade");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-theme-style", "jade");
  });
});
