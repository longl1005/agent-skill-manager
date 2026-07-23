import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { ScanReport } from "../ipc/types";
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

beforeEach(() => useScanStore.setState({ report: null, scanning: false, error: null }));

describe("AgentDetail", () => {
  it("shows the selected Agent workspace without a second directory", () => {
    useScanStore.setState({ report: reportFixture });

    renderDetail("/agents/claude-code");

    expect(screen.getByRole("heading", { name: "Claude Code" })).toBeVisible();
    expect(screen.getByTitle("~/.claude/skills")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "All Agents" })).not.toBeInTheDocument();
  });

  it("offers directory recovery for an unknown Agent route", () => {
    useScanStore.setState({ report: reportFixture });

    renderDetail("/agents/unknown");

    expect(screen.getByRole("link", { name: "All Agents" })).toHaveAttribute("href", "/agents");
  });
});
