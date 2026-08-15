import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import Settings from "./Settings";
import { useThemeStore } from "../stores/themeStore";
import { useI18nStore } from "../stores/i18nStore";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { useScanStore } from "../stores/scanStore";
import { usePerformanceDiagnosticsStore } from "../stores/performanceDiagnosticsStore";
import { useGeneralSettingsStore } from "../stores/generalSettingsStore";
import { useProxyStore } from "../stores/proxyStore";
import {
  clearPerformanceDiagnostics,
  exportPerformanceDiagnostics,
  getPerformanceDiagnosticsSummary,
  openExternalUrl,
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
  setTrayVisible: vi.fn().mockResolvedValue(undefined),
  hideMainWindow: vi.fn().mockResolvedValue(undefined),
  exitApp: vi.fn().mockResolvedValue(undefined),
  getNetworkProxy: vi.fn().mockResolvedValue(null),
  setNetworkProxy: vi.fn().mockResolvedValue(undefined),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}));

const reportSummaryFixture = {
  enabled: true,
  reportCount: 2,
  newestEventAtMs: 1_725_000_000_000,
  reportDirectoryLabel: "~/.asm/diagnostics",
};

const defaultRefreshDiagnosticsSummary = usePerformanceDiagnosticsStore.getState().refreshSummary;

const openSection = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
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
    useThemeStore.getState().setThemeStyle("graphite");
    useAgentConfigStore.setState({ customPaths: {}, disabledAgentIds: [], agentOrder: [] });
    useScanStore.setState({ report: null, scanning: false, error: null });
    usePerformanceDiagnosticsStore.setState({
      enabled: false,
      summary: reportSummaryFixture,
      refreshSummary: defaultRefreshDiagnosticsSummary,
    });
    vi.mocked(getPerformanceDiagnosticsSummary).mockResolvedValue(reportSummaryFixture);
    saveMock.mockResolvedValue(null);
  });

  it("changes color scheme and theme style independently from dropdowns", () => {
    render(<Settings />);

    const schemeSelect = screen.getByRole("combobox", { name: "配色方案" });
    const styleSelect = screen.getByRole("combobox", { name: "主题" });

    expect(within(schemeSelect).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["跟随系统", "浅色模式", "深色模式"]);
    expect(within(styleSelect).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["Graphite", "Aura", "Jade"]);

    fireEvent.change(schemeSelect, { target: { value: "dark" } });
    fireEvent.change(styleSelect, { target: { value: "aura" } });

    expect(useThemeStore.getState().themeMode).toBe("dark");
    expect(useThemeStore.getState().themeStyle).toBe("aura");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-theme-style", "aura");
  });

  it("uses category navigation and displays one settings panel at a time", () => {
    render(<Settings />);

    expect(screen.getByRole("navigation", { name: "设置分类" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "通用设置" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("配色方案")).toBeVisible();
    expect(screen.queryByText("Agent 技能目录配置")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agent 管理" }));

    expect(screen.getByRole("button", { name: "Agent 管理" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Agent 技能目录配置")).toBeVisible();
    expect(screen.queryByText("配色方案")).not.toBeInTheDocument();
  });

  it("keeps an Agent path editor collapsed until requested", () => {
    useScanStore.setState({ report: {
      scan_id: "test", started_at: 0, completed_at: 0, total_skills: 0, total_issues: 0,
      agents: [{ agent_id: "codex", display_name: "Codex", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" }],
    } });
    render(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: "Agent 管理" }));
    expect(screen.queryByLabelText("Codex Skills 目录")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "修改 Codex 目录" }));

    expect(screen.getByLabelText("Codex Skills 目录")).toBeVisible();
  });

  it("offers only Chinese and English in a language dropdown and switches immediately", () => {
    render(<Settings />);

    // Defaults to Chinese
    expect(screen.getByRole("heading", { level: 1, name: "设置" })).toBeInTheDocument();
    expect(screen.getByText("语言 / Language")).toBeInTheDocument();
    expect(screen.getByText("配色方案")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agent 管理" })).toBeInTheDocument();

    const languageSelect = screen.getByRole("combobox", { name: "语言 / Language" });
    expect(within(languageSelect).getAllByRole("option").map((option) => option.textContent)).toEqual(["简体中文", "English"]);
    fireEvent.change(languageSelect, { target: { value: "en" } });

    // Verify Zustand state updated
    expect(useI18nStore.getState().lang).toBe("en");

    // Verify UI re-rendered in English
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Color scheme")).toBeInTheDocument();
    expect(screen.getByText("Light Mode")).toBeInTheDocument();
    openSection("Agent management");
    expect(screen.getByText("Agent Skills Directory Configurations")).toBeInTheDocument();
  });

  it("allows selecting close behavior from segmented control", () => {
    useGeneralSettingsStore.setState({ closeAction: "ask" });
    render(<Settings />);

    expect(screen.getByText("关闭行为")).toBeInTheDocument();
    expect(screen.getByText("选择点击窗口关闭按钮后的应用行为。")).toBeInTheDocument();

    const askBtn = screen.getByRole("radio", { name: "每次询问" });
    const minimizeBtn = screen.getByRole("radio", { name: "最小化到托盘" });
    const quitBtn = screen.getByRole("radio", { name: "退出应用" });

    expect(askBtn).toHaveAttribute("aria-checked", "true");
    expect(minimizeBtn).toHaveAttribute("aria-checked", "false");
    expect(quitBtn).toHaveAttribute("aria-checked", "false");

    fireEvent.click(minimizeBtn);
    expect(useGeneralSettingsStore.getState().closeAction).toBe("minimize");
    expect(minimizeBtn).toHaveAttribute("aria-checked", "true");

    fireEvent.click(quitBtn);
    expect(useGeneralSettingsStore.getState().closeAction).toBe("quit");
    expect(quitBtn).toHaveAttribute("aria-checked", "true");
  });

  it("allows selecting tray icon visibility from segmented control", () => {
    useGeneralSettingsStore.setState({ showTrayIcon: true });
    render(<Settings />);

    expect(screen.getByText("托盘图标")).toBeInTheDocument();
    expect(screen.getByText("在系统托盘中显示图标，便于快速执行显示和退出操作。")).toBeInTheDocument();

    const showBtn = screen.getByRole("radio", { name: "显示" });
    const hideBtn = screen.getByRole("radio", { name: "隐藏" });

    expect(showBtn).toHaveAttribute("aria-checked", "true");
    expect(hideBtn).toHaveAttribute("aria-checked", "false");

    fireEvent.click(hideBtn);
    expect(useGeneralSettingsStore.getState().showTrayIcon).toBe(false);
    expect(hideBtn).toHaveAttribute("aria-checked", "true");
  });

  it("allows selecting font size from segmented control", () => {
    useGeneralSettingsStore.setState({ fontSize: "medium" });
    render(<Settings />);

    expect(screen.getByText("文字大小")).toBeInTheDocument();
    expect(screen.getByText("调整应用的基础字号。")).toBeInTheDocument();

    const smallBtn = screen.getByRole("radio", { name: "小" });
    const mediumBtn = screen.getByRole("radio", { name: "默认" });
    const largeBtn = screen.getByRole("radio", { name: "大" });
    const xlargeBtn = screen.getByRole("radio", { name: "特大" });

    expect(smallBtn).toHaveAttribute("aria-checked", "false");
    expect(mediumBtn).toHaveAttribute("aria-checked", "true");
    expect(largeBtn).toHaveAttribute("aria-checked", "false");
    expect(xlargeBtn).toHaveAttribute("aria-checked", "false");

    fireEvent.click(largeBtn);
    expect(useGeneralSettingsStore.getState().fontSize).toBe("large");
    expect(largeBtn).toHaveAttribute("aria-checked", "true");

    fireEvent.click(xlargeBtn);
    expect(useGeneralSettingsStore.getState().fontSize).toBe("xlarge");
    expect(xlargeBtn).toHaveAttribute("aria-checked", "true");
  });

  it("allows configuring and saving network proxy", async () => {
    useProxyStore.setState({ proxy: "http://127.0.0.1:7890", loading: false, saving: false, error: null });
    render(<Settings />);

    openSection("网络代理");

    expect(screen.getByRole("heading", { level: 2, name: "网络代理" })).toBeInTheDocument();
    expect(screen.getByText("代理地址")).toBeInTheDocument();
    expect(screen.getByText("设置后，所有 Git 拉取和网络请求均通过此代理出口。留空则直连。")).toBeInTheDocument();

    const proxyInput = screen.getByRole("textbox", { name: "代理地址" });
    expect(proxyInput).toHaveValue("http://127.0.0.1:7890");

    fireEvent.change(proxyInput, { target: { value: "http://127.0.0.1:8888" } });
    expect(proxyInput).toHaveValue("http://127.0.0.1:8888");

    const saveBtn = screen.getByRole("button", { name: /保存/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(useProxyStore.getState().proxy).toBe("http://127.0.0.1:8888");
    });
  });

  it("renders a manual update-check control", () => {
    render(<Settings />);
    openSection("更新与关于");
    expect(screen.getByRole("button", { name: "检查更新" })).toBeInTheDocument();
  });

  it("renders GitHub repository link button and allows opening it", () => {
    render(<Settings />);
    openSection("更新与关于");

    const viewRepoBtn = screen.getByRole("button", { name: "访问仓库" });
    expect(viewRepoBtn).toBeInTheDocument();

    fireEvent.click(viewRepoBtn);
    expect(openExternalUrl).toHaveBeenCalledWith("https://github.com/longl1005/agent-skill-manager");
  });

  it("keeps undetected Agents collapsed and read-only until they are detected", () => {
    render(<Settings />);
    openSection("Agent 管理");

    expect(screen.queryByText("TRAE")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /更多 Agent/ }));
    expect(screen.getByRole("heading", { level: 3, name: "TRAE" })).toBeInTheDocument();

    expect(screen.getAllByText("安装并扫描到后，将自动显示在上方。")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "启用并配置" })).not.toBeInTheDocument();
  });

  it("does not show a disabled state for an undetected Agent", () => {
    useAgentConfigStore.setState({ disabledAgentIds: ["trae", "trae-cn"] });
    render(<Settings />);
    openSection("Agent 管理");

    fireEvent.click(screen.getByRole("button", { name: /更多 Agent/ }));

    expect(screen.getAllByText("安装并扫描到后，将自动显示在上方。")).not.toHaveLength(0);
    expect(screen.queryByText("已关闭，重新开启后不会自动恢复 Skills 链接。")).not.toBeInTheDocument();
  });

  it("uses Antigravity's writable configuration directory as the settings default", () => {
    useScanStore.setState({ report: {
      scan_id: "test", started_at: 0, completed_at: 0, total_skills: 0, total_issues: 0,
      agents: [{ agent_id: "antigravity", display_name: "Antigravity", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" }],
    } });

    render(<Settings />);
    openSection("Agent 管理");

    expect(screen.getByText("~/.gemini/config/skills")).toBeVisible();
    expect(screen.getByText("配置目录会用于分发；内置目录仅扫描，不会写入 Skills。")).toBeVisible();
  });

  it("reorders cards through pointer dragging", () => {
    useScanStore.setState({ report: {
      scan_id: "test", started_at: 0, completed_at: 0, total_skills: 0, total_issues: 0,
      agents: [
        { agent_id: "claude-code", display_name: "Claude Code", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" },
        { agent_id: "droid", display_name: "Droid", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" },
      ],
    } });
    const { container } = render(<Settings />);
    openSection("Agent 管理");
    const handles = screen.getAllByTitle("拖动排序");
    const droidCard = screen.getByRole("heading", { name: "Droid" }).closest("article")!;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => droidCard) });

    fireEvent.pointerDown(handles[0], { pointerId: 1 });
    expect(container.querySelector<HTMLElement>(".settings-agent-drag-preview")?.style.left).toBe("14px");
    fireEvent.pointerMove(handles[0], { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(handles[0], { pointerId: 1 });

    expect(useAgentConfigStore.getState().agentOrder.slice(0, 2)).toEqual(["droid", "claude-code"]);
  });

  it("renders every detected Agent without search or aggregate summary", () => {
    useScanStore.setState({ report: {
      scan_id: "test", started_at: 0, completed_at: 0, total_skills: 0, total_issues: 0,
      agents: [
        { agent_id: "claude-code", display_name: "Claude Code", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" },
        { agent_id: "droid", display_name: "Droid", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" },
      ],
    } });
    render(<Settings />);
    openSection("Agent 管理");

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByText("2 个已启用 · 2 个已检测")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Claude Code" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Droid" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "已检测到的 Agent" })).toBeVisible();
    expect(screen.getByText("2", { selector: ".settings-agent-group-header > span" })).toBeVisible();
  });

  it("supports keyboard reordering from the drag handle", () => {
    useScanStore.setState({ report: {
      scan_id: "test", started_at: 0, completed_at: 0, total_skills: 0, total_issues: 0,
      agents: [
        { agent_id: "claude-code", display_name: "Claude Code", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" },
        { agent_id: "droid", display_name: "Droid", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "success" },
      ],
    } });
    render(<Settings />);
    openSection("Agent 管理");

    fireEvent.keyDown(screen.getByRole("button", { name: "拖动 Claude Code 排序" }), { key: "ArrowDown" });

    expect(useAgentConfigStore.getState().agentOrder.slice(0, 2)).toEqual(["droid", "claude-code"]);
  });

  it("shows diagnostics as disabled by default and enables it", async () => {
    render(<Settings />);
    openSection("性能诊断");

    const toggle = screen.getByRole("switch", { name: "性能诊断" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);

    await waitFor(() => expect(setPerformanceDiagnosticsEnabled).toHaveBeenCalledWith(true));
  });

  it("renders the camel-case report summary returned by the Tauri command", () => {
    render(<Settings />);
    openSection("性能诊断");

    expect(screen.getByText("诊断报告：2 份")).toBeInTheDocument();
  });

  it("refreshes the persisted diagnostics summary when the settings page opens", async () => {
    const refreshSummary = vi.fn().mockResolvedValue(undefined);
    usePerformanceDiagnosticsStore.setState({ refreshSummary });

    render(<Settings />);

    await waitFor(() => expect(refreshSummary).toHaveBeenCalled());
  });

  it("requires confirmation before clearing diagnostic reports", () => {
    usePerformanceDiagnosticsStore.setState({ enabled: true });
    render(<Settings />);
    openSection("性能诊断");

    fireEvent.click(screen.getByRole("button", { name: "清除诊断报告" }));

    expect(screen.getByRole("dialog", { name: "清除诊断报告" })).toBeInTheDocument();
    expect(clearPerformanceDiagnostics).not.toHaveBeenCalled();
  });

  it("does not export when the save dialog is cancelled", async () => {
    usePerformanceDiagnosticsStore.setState({ enabled: true });
    render(<Settings />);
    openSection("性能诊断");

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
    openSection("性能诊断");

    fireEvent.click(screen.getByRole("button", { name: "导出诊断报告" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法完成性能诊断操作，请重试。");
    expect(screen.queryByText("backend detail")).not.toBeInTheDocument();
  });

  it("hides report actions after diagnostics is disabled", async () => {
    usePerformanceDiagnosticsStore.setState({ enabled: true, summary: reportSummaryFixture });
    render(<Settings />);
    openSection("性能诊断");

    fireEvent.click(screen.getByRole("switch", { name: "性能诊断" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "导出诊断报告" })).not.toBeInTheDocument());
  });
});
