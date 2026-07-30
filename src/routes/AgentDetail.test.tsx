import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ScanReport } from "../ipc/types";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useScanStore } from "../stores/scanStore";
import AgentDetail from "./AgentDetail";

const reportFixture: ScanReport = {
  scan_id: "scan-1",
  started_at: 0,
  completed_at: 1,
  total_skills: 1,
  total_issues: 0,
  agents: [
    {
      agent_id: "claude-code",
      display_name: "Claude Code",
      detection_status: "Detected",
      roots: [{ root_id: "claude-root", scope: "User", display_path: "~/.claude/skills" }],
      skills: [{
        name: "frontend-design",
        description: "Design user interfaces",
        license: null,
        location: "~/.claude/skills/frontend-design",
        fingerprint_short: "abc123",
        file_count: 2,
        issues: [],
      }],
      issues: [],
      outcome: "Success",
    },
  ],
};

function renderDetail(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/agents/:agentId" element={<AgentDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

import { useI18nStore } from "../stores/i18nStore";

beforeEach(() => {
  useI18nStore.setState({ lang: "en" });
  useScanStore.setState({ report: null, scanning: false, error: null });
  useMasterRepoStore.setState({ skills: [], fetchMasterSkills: vi.fn(), deleteAgentSkill: vi.fn().mockResolvedValue(true) });
});

describe("AgentDetail", () => {
  it("shows the selected Agent workspace without a second directory", () => {
    useScanStore.setState({ report: reportFixture });

    renderDetail("/agents/claude-code");

    expect(screen.getByRole("heading", { name: "Claude Code" })).toBeVisible();
    expect(screen.getByTitle("~/.claude/skills")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "All Agents" })).not.toBeInTheDocument();
  });

  it("rescans the Agent inventory and refreshes master skill status from the detail page", async () => {
    const scan = vi.fn().mockResolvedValue(undefined);
    const fetchMasterSkills = vi.fn().mockResolvedValue(undefined);
    useScanStore.setState({ report: reportFixture, scan });
    useMasterRepoStore.setState({ fetchMasterSkills });

    renderDetail("/agents/claude-code");
    fetchMasterSkills.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(scan).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(fetchMasterSkills).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Import to Master" })).toBeVisible();
  });

  it("marks a same-name real directory as a local copy and requires confirmation before replacement", () => {
    useScanStore.setState({ report: reportFixture });
    useMasterRepoStore.setState({
      skills: [{ name: "frontend-design", description: "", path: "/master/frontend-design", linked_agents: {} }],
      replaceAgentLocalSkillWithSymlink: vi.fn().mockResolvedValue(true),
    });

    renderDetail("/agents/claude-code");

    fireEvent.click(screen.getByRole("button", { name: "Replace with symlink" }));
    expect(screen.getByText("In Master · Local copy")).toBeVisible();
    expect(screen.getByText(/永久删除/)).toBeVisible();
  });

  it("shows an external symlink with a remove action", () => {
    useScanStore.setState({
      report: {
        ...reportFixture,
        agents: [{
          ...reportFixture.agents[0],
          skills: [{ ...reportFixture.agents[0].skills[0], is_symlink: true, symlink_target: "/elsewhere/frontend-design" }],
        }],
      },
    });
    useMasterRepoStore.setState({
      skills: [{ name: "frontend-design", description: "", path: "/master/frontend-design", linked_agents: {} }],
    });

    renderDetail("/agents/claude-code");

    expect(screen.getByText("External symlink")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Replace with symlink" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove frontend-design from Claude Code" })).toBeVisible();
  });

  it("offers directory recovery for an unknown Agent route", () => {
    useScanStore.setState({ report: reportFixture });

    renderDetail("/agents/unknown");

    expect(screen.getByRole("link", { name: "All Agents" })).toHaveAttribute("href", "/agents");
  });

  it("shows a non-destructive scan error while preserving the selected Agent", () => {
    useScanStore.setState({ report: reportFixture, error: "The scanner is unavailable" });

    renderDetail("/agents/claude-code");

    expect(screen.getByRole("heading", { name: "Claude Code" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(/latest scan failed/i);
  });

  it("offers all-agents and rescan recovery when a scan failure leaves no Agent report", () => {
    const scan = vi.fn().mockResolvedValue(undefined);
    useScanStore.setState({ report: null, error: "The scanner is unavailable", scan });

    renderDetail("/agents/claude-code");

    expect(screen.getByRole("alert")).toHaveTextContent(/latest scan failed/i);
    expect(screen.getByRole("link", { name: "All Agents" })).toHaveAttribute("href", "/agents");

    const retry = screen.getByRole("button", { name: /rescan agents/i });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(scan).toHaveBeenCalledOnce();
  });

  it("sorts Agent skills by recent modification time and by name", () => {
    useScanStore.setState({
      report: {
        ...reportFixture,
        agents: [{
          ...reportFixture.agents[0],
          skills: [
            { ...reportFixture.agents[0].skills[0], name: "zeta", modified_at: 30 },
            { ...reportFixture.agents[0].skills[0], name: "alpha", modified_at: 10 },
            { ...reportFixture.agents[0].skills[0], name: "middle", modified_at: 20 },
          ],
        }],
      },
    });

    const { container } = renderDetail("/agents/claude-code");
    const skillNames = () => [...container.querySelectorAll(".agent-detail__skill-name")].map((item) => item.textContent);

    expect(skillNames()).toEqual(["zeta", "middle", "alpha"]);
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(skillNames()).toEqual(["alpha", "middle", "zeta"]);
  });
});
