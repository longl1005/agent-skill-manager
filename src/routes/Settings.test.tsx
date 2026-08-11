import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import Settings from "./Settings";
import { useThemeStore } from "../stores/themeStore";
import { useI18nStore } from "../stores/i18nStore";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { useScanStore } from "../stores/scanStore";
import { usePerformanceDiagnosticsStore } from "../stores/performanceDiagnosticsStore";
import {
  clearPerformanceDiagnostics,
  exportPerformanceDiagnostics,
  getPerformanceDiagnosticsSummary,
  setPerformanceDiagnosticsEnabled,
} from "../ipc/commands";

const { saveMock } = vi.hoisted(() => ({ saveMock: vi.fn() }));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveMock }));

vi.mock("../ipc/commands", () => ({
  migrateAgentSkillsDir: vi.fn(),
  resetAgentSkillsDir: vi.fn(),
  setAgentSortOrder: vi.fn().mockResolvedValue(undefined),
  getPerformanceDiagnosticsEnabled: vi.fn(),
  setPerformanceDiagnosticsEnabled: vi.fn(),
  getPerformanceDiagnosticsSummary: vi.fn(),
  exportPerformanceDiagnostics: vi.fn(),
  clearPerformanceDiagnostics: vi.fn(),
}));

const reportSummaryFixture = {
  enabled: true,
  report_count: 2,
  newest_event_at_ms: 1_725_000_000_000,
  report_directory_label: "~/.asm/diagnostics",
};

describe("Settings route & i18n / Theme Switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    usePerformanceDiagnosticsStore.setState({ enabled: false, summary: reportSummaryFixture });
    vi.mocked(getPerformanceDiagnosticsSummary).mockResolvedValue(reportSummaryFixture);
    saveMock.mockResolvedValue(null);
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

  it("renders a manual update-check control", () => {
    render(<Settings />);
    expect(screen.getByRole("button", { name: "检查更新" })).toBeInTheDocument();
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

  it("shows diagnostics as disabled by default and enables it", async () => {
    render(<Settings />);

    const toggle = screen.getByRole("switch", { name: "性能诊断" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);

    await waitFor(() => expect(setPerformanceDiagnosticsEnabled).toHaveBeenCalledWith(true));
  });

  it("requires confirmation before clearing diagnostic reports", () => {
    usePerformanceDiagnosticsStore.setState({ enabled: true });
    render(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: "清除诊断报告" }));

    expect(screen.getByRole("dialog", { name: "清除诊断报告" })).toBeInTheDocument();
    expect(clearPerformanceDiagnostics).not.toHaveBeenCalled();
  });

  it("does not export when the save dialog is cancelled", async () => {
    usePerformanceDiagnosticsStore.setState({ enabled: true });
    render(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: "导出诊断报告" }));

    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(exportPerformanceDiagnostics).not.toHaveBeenCalled();
    expect(usePerformanceDiagnosticsStore.getState().summary).toEqual(reportSummaryFixture);
  });

  it("shows the generic error when exporting diagnostics fails", async () => {
    usePerformanceDiagnosticsStore.setState({ enabled: true });
    saveMock.mockResolvedValueOnce("/tmp/diagnostics.jsonl");
    vi.mocked(exportPerformanceDiagnostics).mockRejectedValueOnce(new Error("backend detail"));
    render(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: "导出诊断报告" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法完成性能诊断操作，请重试。");
    expect(screen.queryByText("backend detail")).not.toBeInTheDocument();
  });

  it("hides report actions after diagnostics is disabled", async () => {
    usePerformanceDiagnosticsStore.setState({ enabled: true, summary: reportSummaryFixture });
    render(<Settings />);

    fireEvent.click(screen.getByRole("switch", { name: "性能诊断" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "导出诊断报告" })).not.toBeInTheDocument());
  });
});
