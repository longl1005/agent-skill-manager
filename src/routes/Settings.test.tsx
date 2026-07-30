import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import Settings from "./Settings";
import { useThemeStore } from "../stores/themeStore";
import { useI18nStore } from "../stores/i18nStore";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { useScanStore } from "../stores/scanStore";

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
    useAgentConfigStore.setState({ customPaths: {}, disabledAgentIds: [], agentOrder: [] });
    useScanStore.setState({ report: null, scanning: false, error: null });
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

  it("keeps undetected Agents collapsed and read-only until they are detected", () => {
    render(<Settings />);

    expect(screen.queryByText("TRAE")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /更多 Agent/ }));
    expect(screen.getByRole("heading", { level: 3, name: "TRAE" })).toBeInTheDocument();

    expect(screen.getAllByText("安装并扫描到后，将自动显示在上方。")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "启用并配置" })).not.toBeInTheDocument();
  });

  it("does not show a disabled state for an undetected Agent", () => {
    useAgentConfigStore.setState({ disabledAgentIds: ["trae", "trae-cn"] });
    render(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: /更多 Agent/ }));

    expect(screen.getAllByText("安装并扫描到后，将自动显示在上方。")).not.toHaveLength(0);
    expect(screen.queryByText("已关闭，重新开启后不会自动恢复 Skills 链接。")).not.toBeInTheDocument();
  });

  it("reorders cards through pointer dragging", () => {
    useScanStore.setState({ report: {
      scan_id: "test", started_at: 0, completed_at: 0, total_skills: 0, total_issues: 0,
      agents: [
        { agent_id: "claude-code", display_name: "Claude Code", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" },
        { agent_id: "droid", display_name: "Droid", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" },
      ],
    } });
    render(<Settings />);
    const handles = screen.getAllByTitle("拖动排序");
    const droidCard = screen.getByRole("heading", { name: "Droid" }).closest("article")!;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => droidCard) });

    fireEvent.pointerDown(handles[0], { pointerId: 1 });
    fireEvent.pointerMove(handles[0], { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(handles[0], { pointerId: 1 });

    expect(useAgentConfigStore.getState().agentOrder.slice(0, 2)).toEqual(["droid", "claude-code"]);
  });
});
