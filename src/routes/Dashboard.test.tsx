import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { useScanStore } from "../stores/scanStore";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useI18nStore } from "../stores/i18nStore";
import { useAgentConfigStore } from "../stores/agentConfigStore";

vi.mock("../stores/scanStore", () => ({
  useScanStore: vi.fn(),
}));

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: vi.fn(),
}));

const mockReport = {
  scan_id: "test-scan",
  started_at: Date.now() - 1000,
  completed_at: Date.now(),
  total_skills: 12,
  total_issues: 0,
  agents: [
    {
      agent_id: "claude-code",
      display_name: "Claude Code",
      detection_status: "Detected",
      outcome: "Completed",
      roots: [],
      skills: [{ name: "free-search", description: "Search", location: "/path", file_count: 5, fingerprint_short: "abc" }],
      issues: [],
    },
  ],
};

describe("Dashboard Route Redesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useI18nStore.setState({ lang: "en" });
    useAgentConfigStore.setState({ disabledAgentIds: [] });

    vi.mocked(useScanStore).mockReturnValue({
      report: mockReport,
      scanning: false,
      error: null,
      scan: vi.fn(),
    } as any);

    vi.mocked(useMasterRepoStore).mockReturnValue({
      skills: [
        { name: "free-search", description: "Search", path: "/asm", linked_agents: { "claude-code": true } },
      ],
      loading: false,
      fetchMasterSkills: vi.fn(),
    } as any);
  });

  it("renders metric cards and auto-sync status without manual Scan now button", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /scan now/i })).not.toBeInTheDocument();
    expect(screen.getByText("Auto-Sync Active")).toBeInTheDocument();
  });

  it("uses the application bootstrap data without triggering another master skills refresh", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(vi.mocked(useMasterRepoStore).mock.results[0]?.value.fetchMasterSkills).not.toHaveBeenCalled();
  });

  it("renders metric card counts correctly", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Master Skills")).toBeInTheDocument();
    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    expect(screen.getByText("Symlink Coverage")).toBeInTheDocument();
    expect(screen.getByText("Sync Status")).toBeInTheDocument();
  });

  it("renders Agent Health Cards for detected agents", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText(/1\s+skills/i)).toBeInTheDocument();
  });

  it("omits disabled Agents from dashboard metrics and cards", () => {
    useAgentConfigStore.setState({ disabledAgentIds: ["claude-code"] });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.queryByText("Claude Code")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders navigation shortcuts and supports Chinese language switching", () => {
    useI18nStore.setState({ lang: "zh" });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "仪表盘" })).toBeInTheDocument();
    expect(screen.getByText("主库技能总数")).toBeInTheDocument();
    expect(screen.getByText("已连接 Agent")).toBeInTheDocument();
    expect(screen.getByText("后台自动同步中")).toBeInTheDocument();

    const libraryLink = screen.getByRole("link", { name: "主技能仓库" });
    const agentsLink = screen.getByRole("link", { name: "智能体管理" });

    expect(libraryLink).toHaveAttribute("href", "/library");
    expect(agentsLink).toHaveAttribute("href", "/agents");
  });
});
