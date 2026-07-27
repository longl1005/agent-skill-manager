import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import Settings from "./Settings";
import { useThemeStore } from "../stores/themeStore";
import { useI18nStore } from "../stores/i18nStore";

describe("Settings route & i18n / Theme Switcher", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    useI18nStore.getState().setLanguage("zh");
    useThemeStore.getState().setThemeMode("system");
  });

  it("renders theme options and allows changing theme mode", () => {
    render(<Settings />);

    expect(screen.getByText("浅色模式")).toBeInTheDocument();
    expect(screen.getByText("深色模式")).toBeInTheDocument();
    expect(screen.getByText("跟随系统")).toBeInTheDocument();

    const lightBtn = screen.getByText("浅色模式").closest("button");
    expect(lightBtn).not.toBeNull();
    fireEvent.click(lightBtn!);

    expect(useThemeStore.getState().themeMode).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("switches language from Chinese to English and updates active badge and section labels", () => {
    render(<Settings />);

    // Defaults to Chinese
    expect(screen.getByRole("heading", { level: 1, name: "设置" })).toBeInTheDocument();
    expect(screen.getByText("语言 / Language")).toBeInTheDocument();
    expect(screen.getByText("外观主题")).toBeInTheDocument();
    expect(screen.getByText("Agent 技能目录配置")).toBeInTheDocument();

    // Find and click the English language card button
    const enOption = screen.getByText("English").closest("button");
    expect(enOption).not.toBeNull();
    fireEvent.click(enOption!);

    // Verify Zustand state updated
    expect(useI18nStore.getState().lang).toBe("en");

    // Verify UI re-rendered in English
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Light Mode")).toBeInTheDocument();
    expect(screen.getByText("Agent Skills Directory Configurations")).toBeInTheDocument();
  });
});
