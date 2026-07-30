import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { useScanStore } from "../stores/scanStore";
import { useI18nStore } from "../stores/i18nStore";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { useUiStore } from "../stores/uiStore";
import AppSidebar from "./AppSidebar";

const reportFixture = {
  scan_id: "scan-1", started_at: 0, completed_at: 1, total_skills: 14, total_issues: 0,
  agents: [
    { agent_id: "codex", display_name: "Codex", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "Success" },
    { agent_id: "claude", display_name: "Claude Code", detection_status: "Partial", roots: [], skills: [], issues: [], outcome: "Success" },
    { agent_id: "unavailable", display_name: "Unavailable Agent", detection_status: "Unavailable", roots: [], skills: [], issues: [], outcome: "Failure" },
    { agent_id: "unsupported", display_name: "Unsupported Agent", detection_status: "Unsupported", roots: [], skills: [], issues: [], outcome: "Failure" },
    { agent_id: "failed", display_name: "Failed Agent", detection_status: "Failed", roots: [], skills: [], issues: [], outcome: "Failure" },
  ],
};

beforeEach(() => {
  useScanStore.setState({ report: reportFixture, scanning: false, error: null });
  useI18nStore.getState().setLanguage("zh");
  useAgentConfigStore.setState({ disabledAgentIds: [] });
  useUiStore.setState({ sidebarCollapsed: false });
});

describe("AppSidebar", () => {
  it("selects only the matching detected Agent on its detail route", () => {
    render(
      <MemoryRouter initialEntries={["/agents/codex"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /^Agents$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Codex/i })).toHaveClass("is-selected");
    expect(screen.getByRole("link", { name: /所有智能体|All Agents/i })).not.toHaveClass("is-selected");
  });

  it("selects All Agents on the agents index route", () => {
    render(
      <MemoryRouter initialEntries={["/agents"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /所有智能体|All Agents/i })).toHaveClass("is-selected");
  });

  it("shows only detected and partial Agents in the discovered group", () => {
    render(
      <MemoryRouter initialEntries={["/agents"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Codex/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /Claude Code/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Unavailable Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unsupported Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Failed Agent" })).not.toBeInTheDocument();
  });

  it("hides disabled Agents from the discovered menu", () => {
    useAgentConfigStore.setState({ disabledAgentIds: ["codex"] });
    render(<MemoryRouter initialEntries={["/agents"]}><AppSidebar /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /Codex/i })).not.toBeInTheDocument();
  });

  it("keeps the settings navigation outside the scrollable Agent list", () => {
    render(<MemoryRouter initialEntries={["/agents"]}><AppSidebar /></MemoryRouter>);

    expect(screen.getByRole("navigation", { name: "设置" })).toHaveClass("sidebar-settings-navigation");
    const agentNavigation = screen.getByRole("navigation", { name: "所有智能体" });
    expect(agentNavigation).toHaveClass("sidebar-agent-navigation");
    expect(agentNavigation.parentElement).toHaveClass("sidebar-agent-scroll-shell");
  });

  it("updates sidebar labels when language changes", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "仪表盘" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "技能库" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "安装技能" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "所有智能体" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toBeInTheDocument();
    expect(screen.queryByText("已发现智能体")).not.toBeInTheDocument();

    act(() => {
      useI18nStore.getState().setLanguage("en");
    });

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skill Library" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Install Skills" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All Agents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByText("Discovered Agents")).not.toBeInTheDocument();
  });

  it("hides the full navigation when the sidebar is collapsed", () => {
    useUiStore.setState({ sidebarCollapsed: true });
    render(<MemoryRouter initialEntries={["/"]}><AppSidebar /></MemoryRouter>);

    const sidebar = screen.getByRole("complementary");
    expect(sidebar).toHaveClass("is-collapsed");
    expect(screen.queryByRole("link", { name: "仪表盘" })).not.toBeInTheDocument();
  });
});
